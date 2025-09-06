import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for the modern Reporting API format
interface ReportingAPIReport {
  type: string;
  age: number;
  url: string;
  user_agent: string;
  body: unknown;
}

// Interface for CSP report format
interface CSPReportBody {
  'document-uri'?: string;
  referrer?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'original-policy'?: string;
  disposition?: string;
  'blocked-uri'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'source-file'?: string;
  'status-code'?: number;
  'script-sample'?: string;
}

// Interface for legacy CSP report wrapper
interface LegacyCSPReport {
  'csp-report': CSPReportBody;
}

// Type for Prisma client with dynamic access
interface PrismaWithDynamicAccess {
  endpoint: {
    findUnique: (args: { where: { name: string } }) => Promise<{ id: string; name: string } | null>;
    create: (args: { data: { name: string } }) => Promise<{ id: string; name: string }>;
  };
  cspReport: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  report: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  try {
    const body = await request.json();
    const { endpoint: endpointName } = await params;
    
    // Check if this is a legacy CSP report format
    if (body['csp-report']) {
      // Handle legacy CSP report format - delegate to the legacy CSP endpoint logic
      const cspReport = body['csp-report'];
      const userAgent = request.headers.get('user-agent') || undefined;

      // Find or create the endpoint
      const prismaTyped = prisma as unknown as PrismaWithDynamicAccess;
      let endpoint = await prismaTyped.endpoint.findUnique({
        where: { name: endpointName }
      });

      if (!endpoint) {
        endpoint = await prismaTyped.endpoint.create({
          data: { name: endpointName }
        });
      }

      // Create the legacy CSP report
      const report = await prismaTyped.cspReport.create({
        data: {
          documentUri: cspReport['document-uri'] || '',
          referrer: cspReport.referrer || undefined,
          violatedDirective: cspReport['violated-directive'] || '',
          effectiveDirective: cspReport['effective-directive'] || '',
          originalPolicy: cspReport['original-policy'] || '',
          disposition: cspReport.disposition || 'enforce',
          blockedUri: cspReport['blocked-uri'] || undefined,
          lineNumber: cspReport['line-number'] || undefined,
          columnNumber: cspReport['column-number'] || undefined,
          sourceFile: cspReport['source-file'] || undefined,
          statusCode: cspReport['status-code'] || undefined,
          scriptSample: cspReport['script-sample'] || undefined,
          userAgent,
          rawReport: JSON.stringify(body, null, 2),
          endpointId: endpoint.id,
        },
      });

      return NextResponse.json({ 
        success: true, 
        id: report.id, 
        endpoint: endpointName,
        format: 'legacy-csp'
      }, { status: 201 });
    }

    // Handle modern Reporting API format
    let reportsArray: ReportingAPIReport[];
    
    if (Array.isArray(body)) {
      // Modern Reporting API format - array of reports
      reportsArray = body;
    } else if (typeof body === 'object' && body !== null) {
      // Single report object - wrap it in an array
      reportsArray = [body];
    } else {
      return NextResponse.json(
        { error: 'Expected a report object or an array of reports' },
        { status: 400 }
      );
    }

    // Find or create the endpoint
    const prismaTyped = prisma as unknown as PrismaWithDynamicAccess;
    let endpoint = await prismaTyped.endpoint.findUnique({
      where: { name: endpointName }
    });

    if (!endpoint) {
      endpoint = await prismaTyped.endpoint.create({
        data: { name: endpointName }
      });
    }

    // Process each report in the array
    const createdReports: { id: string }[] = [];
    
    for (const report of reportsArray) {
      // Validate required fields
      if (!report.type || !report.url) {
        console.warn('Skipping invalid modern report - missing type or url:', report);
        continue;
      }

      try {
        // Use dynamic access to avoid TypeScript errors before Prisma client regeneration
        const createdReport = await prismaTyped.report.create({
          data: {
            type: report.type,
            url: report.url,
            userAgent: report.user_agent || undefined,
            body: report.body || null,
            age: report.age || undefined,
            endpointId: endpoint.id,
          },
        });
        
        createdReports.push(createdReport);
      } catch (reportError) {
        console.error('Error saving individual report:', reportError);
        // Continue processing other reports even if one fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      endpoint: endpointName,
      reportsProcessed: createdReports.length,
      totalReports: reportsArray.length,
      format: Array.isArray(body) ? 'modern-array' : 'modern-single'
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing reports:', error);
    return NextResponse.json(
      { error: 'Failed to process reports' },
      { status: 500 }
    );
  }
}
