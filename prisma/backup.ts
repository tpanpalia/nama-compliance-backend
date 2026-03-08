import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ANON_KEY!
);

const TABLES = {
  users: 'User',
  contractors: 'Contractor',
  identities: 'Identity',
  sites: 'Site',
  checklistTemplates: 'ChecklistTemplate',
  checklistSections: 'ChecklistSection',
  checklistItems: 'ChecklistItem',
  workOrders: 'WorkOrder',
  workOrderChecklists: 'WorkOrderChecklist',
  checklistResponses: 'ChecklistResponse',
  evidence: 'Evidence',
  contractorItemComments: 'ContractorItemComment',
  auditLogs: 'AuditLog',
  accessRequests: 'AccessRequest',
  accessRequestDocuments: 'AccessRequestDocument',
  reportLogs: 'ReportLog',
} as const;

async function fetchAll(table: string) {
  const rows: unknown[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function backup() {
  console.log('Starting backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_nama_${timestamp}.json`;
  const outDir = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Fetching all tables...');

  const tables = {} as Record<string, unknown[]>;

  for (const [key, table] of Object.entries(TABLES)) {
    tables[key] = await fetchAll(table);
  }

  const data = {
    exportedAt: new Date().toISOString(),
    tables,
  };

  console.log('\nRow counts:');
  for (const [table, rows] of Object.entries(data.tables)) {
    console.log(`  ${table.padEnd(30)} ${rows.length} rows`);
  }

  const totalRows = Object.values(data.tables).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`\n  TOTAL: ${totalRows} rows`);

  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  const fileSizeKB = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`\n✓ Backup saved to: backups/${filename}`);
  console.log(`  File size: ${fileSizeKB} KB`);
  console.log('\nTo restore this backup, run:');
  console.log(`  npx tsx prisma/restore.ts backups/${filename}`);
}

backup().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
