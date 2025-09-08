import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const reportData: any = {
      type: 'csp-violation',
      endpointId: endpoint.id,
      
      // CSP-specific fields
      documentUri: cspReport['document-uri'] || '',
      violatedDirective: cspReport['violated-directive'] || '',
      effectiveDirective: cspReport['effective-directive'] || '',
      originalPolicy: cspReport['original-policy'] || '',
      disposition: cspReport.disposition || 'enforce',
      rawReport: JSON.stringify(body, null, 2), // Store the complete raw request body
    };

    // Add optional fields only if they have values
    if (cspReport.referrer) reportData.referrer = cspReport.referrer;
    if (cspReport['blocked-uri']) reportData.blockedUri = cspReport['blocked-uri'];
    if (cspReport['line-number']) reportData.lineNumber = cspReport['line-number'];
    if (cspReport['column-number']) reportData.columnNumber = cspReport['column-number'];
    if (cspReport['source-file']) reportData.sourceFile = cspReport['source-file'];
    if (cspReport['status-code']) reportData.statusCode = cspReport['status-code'];
    if (cspReport['script-sample']) reportData.scriptSample = cspReport['script-sample'];
    if (userAgent) reportData.userAgent = userAgent;

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
