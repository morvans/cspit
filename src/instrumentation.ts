export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: prisma } = await import('@/lib/prisma');

    // Backfill reportCount on all endpoints from actual report data.
    // This runs once at startup; ongoing writes maintain the counter via increments.
    const reportCounts = await prisma.report.groupBy({
      by: ['endpointId'],
      _count: { _all: true },
    });

    if (reportCounts.length > 0) {
      await Promise.all(
        reportCounts.map(({ endpointId, _count }) =>
          prisma.endpoint.update({
            where: { id: endpointId },
            data: { reportCount: _count._all },
          })
        )
      );
    }
  }
}
