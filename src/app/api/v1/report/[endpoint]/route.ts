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
    
    // Handle both single report objects and arrays of reports
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
    let endpoint = await (prisma as any).endpoint.findUnique({
      where: { name: endpointName }
    });

    if (!endpoint) {
      endpoint = await (prisma as any).endpoint.create({
        data: { name: endpointName }
      });
    }

    // Process each report in the array
    const createdReports = [];
    
    for (const report of reportsArray as ReportingAPIReport[]) {
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
      totalReports: reportsArray.length,
      format: Array.isArray(body) ? 'array' : 'single'
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing reports:', error);
    return NextResponse.json(
      { error: 'Failed to process reports' },
      { status: 500 }
    );
  }
}
