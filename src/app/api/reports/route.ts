import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpointFilter = searchParams.get('endpoint');

    const whereClause = endpointFilter 
      ? { endpoint: { name: endpointFilter } }
      : undefined;

    const reports = await prisma.cspReport.findMany({
      where: whereClause,
      include: {
        endpoint: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching CSP reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CSP reports' },
      { status: 500 }
    );
  }
}
