import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Require authentication
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const endpoints = await prisma.endpoint.findMany({
      select: {
        id: true,
        token: true,
        label: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
      orderBy: {
        label: 'asc',
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

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { label } = await request.json();

    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return NextResponse.json(
        { error: 'Endpoint label is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (label.trim().length > 100) {
      return NextResponse.json(
        { error: 'Endpoint label must be 100 characters or less' },
        { status: 400 }
      );
    }

    const trimmedLabel = label.trim();

    const endpoint = await prisma.endpoint.create({
      data: { label: trimmedLabel },
      select: {
        id: true,
        token: true,
        label: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
    });

    return NextResponse.json(endpoint, { status: 201 });
  } catch (error) {
    console.error('Error creating endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to create endpoint' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get('id');

    if (!endpointId) {
      return NextResponse.json(
        { error: 'Endpoint ID is required' },
        { status: 400 }
      );
    }

    // Check if endpoint exists and get report count
    const endpoint = await prisma.endpoint.findUnique({
      where: { id: endpointId },
      select: {
        id: true,
        label: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint not found' },
        { status: 404 }
      );
    }

    // Delete all reports associated with this endpoint first
    await prisma.cspReport.deleteMany({
      where: { endpointId: endpointId }
    });

    // Then delete the endpoint
    await prisma.endpoint.delete({
      where: { id: endpointId }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Endpoint "${endpoint.label}" and ${endpoint._count.reports} associated reports deleted successfully` 
    });
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to delete endpoint' },
      { status: 500 }
    );
  }
}
