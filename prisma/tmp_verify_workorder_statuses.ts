import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRawUnsafe('SELECT status, COUNT(*)::int AS count FROM "WorkOrder" GROUP BY status ORDER BY status');
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
