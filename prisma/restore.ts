import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function restore() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('Usage: npx tsx prisma/restore.ts <backup-file>');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`File not found: ${backupFile}`);
    process.exit(1);
  }

  console.log(`Restoring from: ${backupFile}`);
  console.log('WARNING: This will wipe current data!\n');

  const raw = fs.readFileSync(backupFile, 'utf-8');
  const data = JSON.parse(raw);
  const t = data.tables;

  console.log(`Backup taken at: ${data.exportedAt}`);
  console.log('Clearing current data...');

  await prisma.reportLog.deleteMany();
  await prisma.accessRequestDocument.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.contractorItemComment.deleteMany();
  await prisma.checklistResponse.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistSection.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.site.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.user.deleteMany();

  console.log('Restoring data...');

  if (t.users?.length) {
    await prisma.user.createMany({ data: t.users, skipDuplicates: true });
    console.log(`  ✓ Users: ${t.users.length}`);
  }

  if (t.contractors?.length) {
    await prisma.contractor.createMany({
      data: t.contractors,
      skipDuplicates: true,
    });
    console.log(`  ✓ Contractors: ${t.contractors.length}`);
  }

  if (t.identities?.length) {
    await prisma.identity.createMany({
      data: t.identities,
      skipDuplicates: true,
    });
    console.log(`  ✓ Identities: ${t.identities.length}`);
  }

  if (t.sites?.length) {
    await prisma.site.createMany({ data: t.sites, skipDuplicates: true });
    console.log(`  ✓ Sites: ${t.sites.length}`);
  }

  if (t.checklistTemplates?.length) {
    await prisma.checklistTemplate.createMany({
      data: t.checklistTemplates,
      skipDuplicates: true,
    });
  }

  if (t.checklistSections?.length) {
    await prisma.checklistSection.createMany({
      data: t.checklistSections,
      skipDuplicates: true,
    });
  }

  if (t.checklistItems?.length) {
    await prisma.checklistItem.createMany({
      data: t.checklistItems,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ Checklist: ${t.checklistTemplates?.length ?? 0} templates, ${t.checklistSections?.length ?? 0} sections, ${t.checklistItems.length} items`,
    );
  }

  if (t.workOrders?.length) {
    await prisma.workOrder.createMany({
      data: t.workOrders,
      skipDuplicates: true,
    });
    console.log(`  ✓ Work Orders: ${t.workOrders.length}`);
  }

  if (t.workOrderChecklists?.length) {
    await prisma.workOrderChecklist.createMany({
      data: t.workOrderChecklists,
      skipDuplicates: true,
    });
  }

  if (t.checklistResponses?.length) {
    await prisma.checklistResponse.createMany({
      data: t.checklistResponses,
      skipDuplicates: true,
    });
    console.log(`  ✓ Checklist responses: ${t.checklistResponses.length}`);
  }

  if (t.evidence?.length) {
    await prisma.evidence.createMany({
      data: t.evidence,
      skipDuplicates: true,
    });
    console.log(`  ✓ Evidence: ${t.evidence.length}`);
  }

  if (t.contractorItemComments?.length) {
    await prisma.contractorItemComment.createMany({
      data: t.contractorItemComments,
      skipDuplicates: true,
    });
  }

  if (t.auditLogs?.length) {
    await prisma.auditLog.createMany({
      data: t.auditLogs,
      skipDuplicates: true,
    });
  }

  if (t.accessRequests?.length) {
    await prisma.accessRequest.createMany({
      data: t.accessRequests,
      skipDuplicates: true,
    });
  }

  if (t.accessRequestDocuments?.length) {
    await prisma.accessRequestDocument.createMany({
      data: t.accessRequestDocuments,
      skipDuplicates: true,
    });
  }

  if (t.reportLogs?.length) {
    await prisma.reportLog.createMany({
      data: t.reportLogs,
      skipDuplicates: true,
    });
  }

  console.log('\n✓ Restore complete!');
  await prisma.$disconnect();
}

restore().catch(async (err) => {
  console.error('Restore failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
