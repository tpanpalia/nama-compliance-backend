/**
 * Re-populates evidence records for all existing work orders using real evidence_photo/ files.
 * Run AFTER upload-sample-images.ts has created the file records.
 *
 * Usage: npx ts-node scripts/repopulate-evidence.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

async function main() {
  console.log('🔄 Re-populating evidence for existing work orders...\n')

  // Load real evidence_photo file IDs
  const realFiles = await prisma.file.findMany({
    where: { s3Key: { startsWith: 'evidence_photo/' }, uploadStatus: 'UPLOADED' },
    select: { id: true },
  })
  if (realFiles.length === 0) {
    console.error('❌ No evidence_photo file records found. Run: npx ts-node scripts/upload-sample-images.ts first.')
    process.exit(1)
  }
  const fileIds = realFiles.map(f => f.id)
  let fileIndex = 0
  const nextFile = () => { const id = fileIds[fileIndex % fileIds.length]; fileIndex++; return id }
  console.log(`   ✓ Found ${fileIds.length} real evidence_photo files\n`)

  // Load checklist items
  const checklistItems = await prisma.checklistItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  })

  // Load all work orders with their inspections and contractors
  const workOrders = await prisma.workOrder.findMany({
    include: {
      inspection: { select: { id: true, status: true } },
      contractor: { select: { userId: true } },
    },
  })

  console.log(`   Found ${workOrders.length} work orders\n`)

  // Delete ALL existing evidence first (clean slate)
  const deleted = await prisma.evidence.deleteMany({})
  console.log(`   Cleared ${deleted.count} old evidence records\n`)

  let totalCreated = 0

  for (const wo of workOrders) {
    const status = wo.status
    const needsContractorEvidence = ['SUBMITTED', 'PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETED', 'OVERDUE', 'IN_PROGRESS'].includes(status)
    const needsInspectorEvidence = status === 'INSPECTION_COMPLETED' || wo.inspection?.status === 'IN_PROGRESS' || wo.inspection?.status === 'SUBMITTED'

    if (!needsContractorEvidence && !needsInspectorEvidence) continue

    const contractorUserId = wo.contractor?.userId
    const siteName = wo.siteName

    // Contractor evidence
    if (needsContractorEvidence && contractorUserId) {
      const evidenceItems = pickN(checklistItems, Math.min(checklistItems.length, 8 + Math.floor(Math.random() * 7)))
      for (const item of evidenceItems) {
        await prisma.evidence.create({
          data: {
            workOrderId: wo.id,
            checklistItemId: item.id,
            uploadedBy: contractorUserId,
            uploadedByRole: 'CONTRACTOR',
            fileId: nextFile(),
            gpsLat: 23.58 + (Math.random() * 0.2),
            gpsLng: 58.38 + (Math.random() * 0.2),
            gpsAddress: `${siteName}, Oman`,
            comment: Math.random() > 0.5 ? 'Work completed as per specification' : undefined,
            capturedAt: wo.submissionDate ?? wo.allocationDate ?? new Date(),
          },
        })
        totalCreated++
      }
    }

    // Inspector evidence
    if (needsInspectorEvidence && wo.inspection && wo.assignedInspectorId) {
      const evidenceItems = pickN(checklistItems, 5 + Math.floor(Math.random() * 5))
      for (const item of evidenceItems) {
        await prisma.evidence.create({
          data: {
            workOrderId: wo.id,
            inspectionId: wo.inspection.id,
            checklistItemId: item.id,
            uploadedBy: wo.assignedInspectorId,
            uploadedByRole: 'INSPECTOR',
            fileId: nextFile(),
            gpsLat: 23.58 + (Math.random() * 0.2),
            gpsLng: 58.38 + (Math.random() * 0.2),
            gpsAddress: `Inspection at ${siteName}`,
            comment: Math.random() > 0.5 ? 'Verified on site' : undefined,
            capturedAt: new Date(),
          },
        })
        totalCreated++
      }
    }

    console.log(`   ✓ ${wo.id} (${status})`)
  }

  console.log(`\n✅ Created ${totalCreated} evidence records across ${workOrders.length} work orders`)
  console.log('   All evidence now points to real photos from evidence_photo/')
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
