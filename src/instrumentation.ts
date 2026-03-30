export async function register() {
  // Only run in Node.js runtime (not edge), and only on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: prisma } = await import('@/lib/prisma');

    try {
      await prisma.$runCommandRaw({
        createIndexes: 'reports',
        indexes: [
          {
            key: { endpointId: 1, timestamp: -1 },
            name: 'endpointId_timestamp',
          },
          {
            key: { type: 1, timestamp: -1 },
            name: 'type_timestamp',
          },
        ],
      });
    } catch (err) {
      console.error('[startup] Failed to create MongoDB indexes:', err);
    }
  }
}
