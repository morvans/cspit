import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface CSPReport {
  'document-uri'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'original-policy'?: string;
  disposition?: string;
  referrer?: string;
  'blocked-uri'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'source-file'?: string;
  'status-code'?: number;
  'script-sample'?: string;
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  try {
    const body = await request.json();
    const { endpoint: endpointName } = await params;
    
    // CSP reports come in a specific format with a "csp-report" wrapper
    const cspReport = body['csp-report'];
    
    if (!cspReport) {
      return NextResponse.json(
        { error: 'Invalid CSP report format' },
        { status: 400 }
      );
    }

    // Find the endpoint - do not create if it doesn't exist
    const endpoint = await prisma.endpoint.findUnique({
      where: { token: endpointName }
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: `Endpoint token '${endpointName}' not found. Please create the endpoint first.` },
        { status: 404 }
      );
    }

    // Extract user agent from headers
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create the report in the unified reports table
    const reportData = {
      type: 'csp-violation',
      endpointId: endpoint.id,
      url: cspReport['document-uri'] || null, // Use document-uri as the URL for CSP reports
      
      // CSP-specific fields
      documentUri: cspReport['document-uri'] || null,
      violatedDirective: cspReport['violated-directive'] || null,
      effectiveDirective: cspReport['effective-directive'] || null,
      originalPolicy: cspReport['original-policy'] || null,
      disposition: cspReport.disposition || 'enforce',
      rawReport: JSON.stringify(body, null, 2), // Store the complete raw request body
    } as Prisma.ReportUncheckedCreateInput;

    // Add optional fields only if they have values
    if (cspReport.referrer) (reportData as Record<string, unknown>).referrer = cspReport.referrer;
    if (cspReport['blocked-uri']) (reportData as Record<string, unknown>).blockedUri = cspReport['blocked-uri'];
    if (cspReport['line-number']) (reportData as Record<string, unknown>).lineNumber = cspReport['line-number'];
    if (cspReport['column-number']) (reportData as Record<string, unknown>).columnNumber = cspReport['column-number'];
    if (cspReport['source-file']) (reportData as Record<string, unknown>).sourceFile = cspReport['source-file'];
    if (cspReport['status-code']) (reportData as Record<string, unknown>).statusCode = cspReport['status-code'];
    if (cspReport['script-sample']) (reportData as Record<string, unknown>).scriptSample = cspReport['script-sample'];
    if (userAgent) (reportData as Record<string, unknown>).userAgent = userAgent;

    const report = await prisma.report.create({
      data: reportData,
    });

    return NextResponse.json({ success: true, id: report.id, endpoint: endpointName }, { status: 201 });
  } catch (error) {
    console.error('Error saving CSP report:', error);
    return NextResponse.json(
      { error: 'Failed to save CSP report' },
      { status: 500 }
    );
  }
}
