import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// Define types for the transformed reports
interface TransformedReport {
  id: string;
  timestamp: Date;
  reportType: string;
  source: string;
  endpoint: {
    id: string;
    token: string;
    label: string;
  };
  // CSP-specific fields
  documentUri?: string;
  referrer?: string | null;
  violatedDirective?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  disposition?: string;
  blockedUri?: string | null;
  lineNumber?: number | null;
  columnNumber?: number | null;
  sourceFile?: string | null;
  statusCode?: number | null;
  scriptSample?: string | null;
  userAgent?: string | null;
  rawReport?: string;
  // Generic report fields
  type?: string;
  url?: string;
  body?: unknown;
  age?: number;
}

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

    // Build where clauses for both CSP and generic reports
    const buildWhereClause = (additionalFilters = {}) => {
      const whereClause: any = { ...additionalFilters };
      
      if (endpointFilter) {
        whereClause.endpoint = { token: endpointFilter };
      }
      
      if (timeFilter) {
        whereClause.timestamp = { gte: timeFilter };
      }
      
      return whereClause;
    };

    let totalCspCount = 0;
    let totalGenericCount = 0;
    const allReports: TransformedReport[] = [];

    // Get total counts for pagination (without pagination applied)
    if (!reportType || reportType === 'all' || reportType === 'csp') {
      totalCspCount = await prisma.cspReport.count({
        where: buildWhereClause(),
      });
    }

    if (!reportType || reportType === 'all' || reportType === 'generic') {
      try {
        totalGenericCount = await (prisma as unknown as { report: { count: (args: unknown) => Promise<number> } }).report.count({
          where: buildWhereClause(),
        });
      } catch (error) {
        console.warn('Generic reports table not available yet:', error);
      }
    }

    const totalCount = totalCspCount + totalGenericCount;
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch CSP reports if requested
    if (!reportType || reportType === 'all' || reportType === 'csp') {
      const cspReports = await prisma.cspReport.findMany({
        where: buildWhereClause(),
        include: {
          endpoint: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip: reportType === 'csp' ? skip : 0,
        take: reportType === 'csp' ? limit : undefined,
      });

      // Transform CSP reports to have a consistent structure
      const transformedCspReports: TransformedReport[] = cspReports.map(report => ({
        id: report.id,
        timestamp: report.timestamp,
        reportType: 'csp-violation',
        source: 'legacy',
        endpoint: report.endpoint,
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
        userAgent: report.userAgent,
        rawReport: report.rawReport
      }));

      allReports.push(...transformedCspReports);
    }

    // Fetch generic reports if requested (use dynamic access until Prisma client is regenerated)
    if (!reportType || reportType === 'all' || reportType === 'generic') {
      try {
        const genericReports = await (prisma as unknown as { report: { findMany: (args: unknown) => Promise<unknown[]> } }).report.findMany({
          where: buildWhereClause(),
          include: {
            endpoint: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
          skip: reportType === 'generic' ? skip : 0,
          take: reportType === 'generic' ? limit : undefined,
        });

        // Transform generic reports to have a consistent structure
        const transformedGenericReports = genericReports.map((report: unknown) => ({
          ...(report as Record<string, unknown>),
          reportType: (report as { type: string }).type,
          source: 'reporting-api'
        })) as TransformedReport[];

        allReports.push(...transformedGenericReports);
      } catch (error) {
        // If the generic reports table doesn't exist yet, just continue with CSP reports
        console.warn('Generic reports table not available yet:', error);
      }
    }

    // Sort all reports by timestamp and apply pagination for mixed results
    allReports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Apply pagination when fetching all report types together
    const paginatedReports = reportType === 'all' 
      ? allReports.slice(skip, skip + limit)
      : allReports;

    return NextResponse.json({
      reports: paginatedReports,
      totalCount,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      cspCount: totalCspCount,
      genericCount: totalGenericCount
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
