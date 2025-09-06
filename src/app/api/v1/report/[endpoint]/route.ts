import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for the modern Reporting API format
interface ReportingAPIReport {
  type: string;
  age: number;
  url: string;
  user_agent: string;
  body: any;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  try {
    const body = await request.json();
    const { endpoint: endpointName } = await params;
    
    // Modern Reporting API sends an array of reports
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Expected an array of reports' },
        { status: 400 }
      );
    }

    // Find or create the endpoint
    let endpoint = await prisma.endpoint.findUnique({
      where: { name: endpointName }
    });

    if (!endpoint) {
      endpoint = await prisma.endpoint.create({
        data: { name: endpointName }
      });
    }

    // Process each report in the array
    const createdReports = [];
    
    for (const report of body as ReportingAPIReport[]) {
      // Validate required fields
      if (!report.type || !report.url) {
        console.warn('Skipping invalid report - missing type or url:', report);
        continue;
      }

      try {
        // Use dynamic access to avoid TypeScript errors before Prisma client regeneration
        const createdReport = await (prisma as any).report.create({
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
      totalReports: body.length
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing reports:', error);
    return NextResponse.json(
      { error: 'Failed to process reports' },
      { status: 500 }
    );
  }
}
