import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
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

    // Base where clause (no type filter) — used for per-type counts
    const baseWhereClause: Prisma.ReportWhereInput = {};

    if (endpointFilter) {
      baseWhereClause.endpoint = { token: endpointFilter };
    }

    if (timeFilter) {
      baseWhereClause.timestamp = { gte: timeFilter };
    }

    // Full where clause with optional type filter — used for the paginated query
    const whereClause: Prisma.ReportWhereInput = { ...baseWhereClause };

    if (reportType === 'csp') {
      whereClause.type = 'csp-violation';
    } else if (reportType === 'generic') {
      whereClause.type = { not: 'csp-violation' };
    }

    // Run data fetch and type counts in parallel
    const [reports, cspCount, allCount] = await Promise.all([
      prisma.report.findMany({
        where: whereClause,
        select: {
          id: true,
          type: true,
          timestamp: true,
          url: true,
          userAgent: true,
          body: true,
          age: true,
          documentUri: true,
          referrer: true,
          violatedDirective: true,
          effectiveDirective: true,
          disposition: true,
          blockedUri: true,
          lineNumber: true,
          columnNumber: true,
          sourceFile: true,
          statusCode: true,
          scriptSample: true,
          endpoint: { select: { id: true, token: true, label: true } },
          // rawReport and originalPolicy excluded — loaded on-demand via GET /api/reports/[id]
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.report.count({ where: { ...baseWhereClause, type: 'csp-violation' } }),
      prisma.report.count({ where: baseWhereClause }),
    ]);

    const genericCount = allCount - cspCount;

    const totalCount =
      reportType === 'csp' ? cspCount :
      reportType === 'generic' ? genericCount :
      allCount;

    const totalPages = Math.ceil(totalCount / limit);

    // Transform reports to match frontend expectations
    const transformedReports = reports.map(report => ({
      id: report.id,
      timestamp: report.timestamp.toISOString(),
      reportType: report.type,
      source: report.type === 'csp-violation' ? 'legacy' : 'reporting-api',
      endpoint: report.endpoint,

      // CSP-specific fields (null for non-CSP reports)
      documentUri: report.documentUri,
      referrer: report.referrer,
      violatedDirective: report.violatedDirective,
      effectiveDirective: report.effectiveDirective,
      disposition: report.disposition,
      blockedUri: report.blockedUri,
      lineNumber: report.lineNumber,
      columnNumber: report.columnNumber,
      sourceFile: report.sourceFile,
      statusCode: report.statusCode,
      scriptSample: report.scriptSample,
      // originalPolicy and rawReport omitted — fetched on-demand via GET /api/reports/[id]

      // Generic report fields (null for CSP reports)
      url: report.url,
      body: report.body,
      age: report.age,
      userAgent: report.userAgent,
    }));

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
