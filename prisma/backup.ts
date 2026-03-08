import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backup() {
  console.log('Starting backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_nama_${timestamp}.json`;
  const outDir = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Fetching all tables...');

  const data = {
    exportedAt: new Date().toISOString(),
    tables: {
      users: await prisma.user.findMany(),
      contractors: await prisma.contractor.findMany(),
      identities: await prisma.identity.findMany(),
      sites: await prisma.site.findMany(),
      checklistTemplates: await prisma.checklistTemplate.findMany(),
      checklistSections: await prisma.checklistSection.findMany(),
      checklistItems: await prisma.checklistItem.findMany(),
      workOrders: await prisma.workOrder.findMany(),
      workOrderChecklists: await prisma.workOrderChecklist.findMany(),
      checklistResponses: await prisma.checklistResponse.findMany(),
      evidence: await prisma.evidence.findMany(),
      contractorItemComments: await prisma.contractorItemComment.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
      accessRequests: await prisma.accessRequest.findMany(),
      accessRequestDocuments: await prisma.accessRequestDocument.findMany(),
      reportLogs: await prisma.reportLog.findMany(),
    },
  };

  console.log('\nRow counts:');
  for (const [table, rows] of Object.entries(data.tables)) {
    console.log(`  ${table.padEnd(30)} ${(rows as unknown[]).length} rows`);
  }

  const totalRows = Object.values(data.tables).reduce(
    (sum, rows) => sum + (rows as unknown[]).length,
    0,
  );

  console.log(`\n  TOTAL: ${totalRows} rows`);

  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');

  const fileSizeKB = Math.round(fs.statSync(outPath).size / 1024);

  console.log(`\n✓ Backup saved to: backups/${filename}`);
  console.log(`  File size: ${fileSizeKB} KB`);
  console.log('\nTo restore this backup, run:');
  console.log(`  npx tsx prisma/restore.ts backups/${filename}`);

  await prisma.$disconnect();
}

backup().catch(async (err) => {
  console.error('Backup failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
