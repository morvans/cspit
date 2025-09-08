const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateCspReports() {
  console.log('Starting CSP reports migration...');
  
  try {
    // Get all CSP reports from the old collection
    const cspReports = await prisma.$runCommandRaw({
      find: 'csp_reports',
      filter: {}
    });
    
    if (cspReports.cursor && cspReports.cursor.firstBatch) {
      const reports = cspReports.cursor.firstBatch;
      console.log(`Found ${reports.length} CSP reports to migrate`);
      
      // Transform and insert each CSP report into the unified reports collection
      for (const cspReport of reports) {
        const unifiedReport = {
          type: 'csp-violation',
          timestamp: cspReport.timestamp,
          endpointId: cspReport.endpointId,
          
          // Map CSP-specific fields
          documentUri: cspReport.documentUri,
          referrer: cspReport.referrer,
          violatedDirective: cspReport.violatedDirective,
          effectiveDirective: cspReport.effectiveDirective,
          originalPolicy: cspReport.originalPolicy,
          disposition: cspReport.disposition,
          blockedUri: cspReport.blockedUri,
          lineNumber: cspReport.lineNumber,
          columnNumber: cspReport.columnNumber,
          sourceFile: cspReport.sourceFile,
          statusCode: cspReport.statusCode,
          scriptSample: cspReport.scriptSample,
          userAgent: cspReport.userAgent,
          rawReport: cspReport.rawReport,
          
          // Generic fields will be null for CSP reports
          url: null,
          body: null,
          age: null
        };
        
        // Insert into the unified reports collection
        await prisma.$runCommandRaw({
          insert: 'reports',
          documents: [unifiedReport]
        });
      }
      
      console.log(`Successfully migrated ${reports.length} CSP reports`);
      
      // Drop the old csp_reports collection
      console.log('Dropping old csp_reports collection...');
      await prisma.$runCommandRaw({
        drop: 'csp_reports'
      });
      
      console.log('Migration completed successfully!');
    } else {
      console.log('No CSP reports found to migrate');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateCspReports()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
