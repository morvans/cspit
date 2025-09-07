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

    // Find or create the endpoint
    let endpoint = await prisma.endpoint.findUnique({
      where: { token: endpointName }
    });

    if (!endpoint) {
      endpoint = await prisma.endpoint.create({
        data: { label: endpointName }
      });
    }

    // Extract user agent from headers
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create the report in the database
    const report = await prisma.cspReport.create({
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
        rawReport: JSON.stringify(body, null, 2), // Store the complete raw request body
        endpointId: endpoint.id,
      },
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
