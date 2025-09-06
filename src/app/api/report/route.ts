import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // CSP reports come in a specific format with a "csp-report" wrapper
    const cspReport = body['csp-report'];
    
    if (!cspReport) {
      return NextResponse.json(
        { error: 'Invalid CSP report format' },
        { status: 400 }
      );
    }

    // Extract user agent from headers
    const userAgent = request.headers.get('user-agent') || undefined;

    // Find or create a default endpoint for legacy reports
    let endpoint = await (prisma as unknown as { endpoint: { findUnique: (args: { where: { name: string } }) => Promise<{ id: string; name: string } | null>; create: (args: { data: { name: string } }) => Promise<{ id: string; name: string }> } }).endpoint.findUnique({
      where: { name: 'default' }
    });

    if (!endpoint) {
      endpoint = await (prisma as unknown as { endpoint: { findUnique: (args: { where: { name: string } }) => Promise<{ id: string; name: string } | null>; create: (args: { data: { name: string } }) => Promise<{ id: string; name: string }> } }).endpoint.create({
        data: { name: 'default' }
      });
    }

    // Create the report in the database
    const report = await (prisma as unknown as { cspReport: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }> } }).cspReport.create({
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

    return NextResponse.json({ success: true, id: report.id }, { status: 201 });
  } catch (error) {
    console.error('Error saving CSP report:', error);
    return NextResponse.json(
      { error: 'Failed to save CSP report' },
      { status: 500 }
    );
  }
}
