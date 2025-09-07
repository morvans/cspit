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

    const allReports: TransformedReport[] = [];

    // Fetch CSP reports if requested
    if (!reportType || reportType === 'all' || reportType === 'csp') {
      const cspWhereClause = endpointFilter 
        ? { endpoint: { token: endpointFilter } }
        : undefined;

      const cspReports = await prisma.cspReport.findMany({
        where: cspWhereClause,
        include: {
          endpoint: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
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
        const genericWhereClause = endpointFilter 
          ? { endpoint: { token: endpointFilter } }
          : undefined;

        const genericReports = await (prisma as unknown as { report: { findMany: (args: unknown) => Promise<unknown[]> } }).report.findMany({
          where: genericWhereClause,
          include: {
            endpoint: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
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

    // Sort all reports by timestamp
    allReports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      reports: allReports,
      totalCount: allReports.length,
      cspCount: allReports.filter(r => r.source === 'legacy').length,
      genericCount: allReports.filter(r => r.source === 'reporting-api').length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
