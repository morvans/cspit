import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpointFilter = searchParams.get('endpoint');
    const reportType = searchParams.get('type'); // 'csp', 'generic', or 'all' (default)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;
    
    // Time filter parameter
    const timeRange = searchParams.get('timeRange') || 'last_1h';
    
    // Calculate time filter based on timeRange
    let timeFilter: Date | undefined;
    const now = new Date();
    
    switch (timeRange) {
      case 'last_30m':
        timeFilter = new Date(now.getTime() - 30 * 60 * 1000);
        break;
      case 'last_1h':
        timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last_24h':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last_7d':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30d':
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        timeFilter = undefined;
        break;
    }

    // Build where clause for unified reports
    const whereClause: any = {};
    
    if (endpointFilter) {
      whereClause.endpoint = { token: endpointFilter };
    }
    
    if (timeFilter) {
      whereClause.timestamp = { gte: timeFilter };
    }
    
    // Add report type filter
    if (reportType === 'csp') {
      whereClause.type = 'csp-violation';
    } else if (reportType === 'generic') {
      whereClause.type = { not: 'csp-violation' };
    }
    // If reportType is 'all' or undefined, don't add type filter

    // Get total count for pagination
    const totalCount = await prisma.report.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Fetch reports with pagination
    const reports = await prisma.report.findMany({
      where: whereClause,
      include: {
        endpoint: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take: limit,
    });

    // Transform reports to match frontend expectations
    const transformedReports = reports.map(report => ({
      id: report.id,
      timestamp: report.timestamp.toISOString(),
      reportType: report.type,
      source: report.type === 'csp-violation' ? 'legacy' : 'reporting-api',
      endpoint: report.endpoint,
      
      // CSP-specific fields (will be null for non-CSP reports)
      documentUri: report.documentUri,
      referrer: report.referrer,
      violatedDirective: report.violatedDirective,
      effectiveDirective: report.effectiveDirective,
      originalPolicy: report.originalPolicy,
      disposition: report.disposition,
      blockedUri: report.blockedUri,
      lineNumber: report.lineNumber,
      columnNumber: report.columnNumber,
      sourceFile: report.sourceFile,
      statusCode: report.statusCode,
      scriptSample: report.scriptSample,
      rawReport: report.rawReport,
      
      // Generic report fields (will be null for CSP reports)
      url: report.url,
      body: report.body,
      age: report.age,
      userAgent: report.userAgent,
    }));

    // Calculate counts by type
    const cspCount = await prisma.report.count({
      where: {
        ...whereClause,
        type: 'csp-violation'
      }
    });

    const genericCount = await prisma.report.count({
      where: {
        ...whereClause,
        type: { not: 'csp-violation' }
      }
    });

    return NextResponse.json({
      reports: transformedReports,
      totalCount,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      cspCount,
      genericCount
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
