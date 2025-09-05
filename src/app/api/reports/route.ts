import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const reports = await prisma.cspReport.findMany({
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
