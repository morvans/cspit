import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const endpoints = await prisma.endpoint.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(endpoints);
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch endpoints' },
      { status: 500 }
    );
  }
}
