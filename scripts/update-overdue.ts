/**
 * Cron script: Update overdue work orders
 *
 * Finds work orders where inspection_deadline has passed and status
 * is not INSPECTION_COMPLETED or already OVERDUE, then marks them OVERDUE.
 *
 * Run manually:   npx ts-node scripts/update-overdue.ts
 * Run via cron:    0 0 * * * cd /path/to/project && npx ts-node scripts/update-overdue.ts
 * Run every hour:  0 * * * * cd /path/to/project && npx ts-node scripts/update-overdue.ts
 *
 * Platform-independent — works on any server with Node.js.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  console.log(`[${now.toISOString()}] Checking for overdue work orders...`)

  const result = await prisma.workOrder.updateMany({
    where: {
      inspectionDeadline: { lt: now },
      status: { notIn: ['INSPECTION_COMPLETED', 'OVERDUE'] },
    },
    data: { status: 'OVERDUE' },
  })

  console.log(`[${now.toISOString()}] Updated ${result.count} work order(s) to OVERDUE`)
}

main()
  .catch((e) => { console.error('Failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
