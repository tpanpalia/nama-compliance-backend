import {
  PrismaClient, UserRole, UserStatus, WorkOrderStatus, WorkOrderPriority,
  WorkType, InspectionStatus, ComplianceRating, FileCategory, UploadStatus,
  EvidenceUploaderRole, RatingValue,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true })

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'nws-compliance'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SAMPLE_PHOTOS_DIR = '/Users/tanushreepanpalia/Desktop/sample_photos'
const samplePhotos = fs.readdirSync(SAMPLE_PHOTOS_DIR)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .map(f => path.join(SAMPLE_PHOTOS_DIR, f))

if (samplePhotos.length === 0) {
  console.error('❌ No photos found in', SAMPLE_PHOTOS_DIR)
  process.exit(1)
}

async function uploadEvidence(params: {
  workOrderId: string
  inspectionId: string | null
  checklistItemId: string
  questionSnapshot: string
  uploadedBy: string
  uploadedByRole: EvidenceUploaderRole
  comment: string
  idx: number
}): Promise<void> {
  const photoPath = samplePhotos[params.idx % samplePhotos.length]
  const photoBuffer = fs.readFileSync(photoPath)
  const ext = path.extname(photoPath).slice(1).toLowerCase().replace('jpg', 'jpeg')
  const mimeType = `image/${ext === 'jpeg' ? 'jpeg' : ext}`
  const s3Key = `evidence-photo/${params.workOrderId}/${params.uploadedByRole.toLowerCase()}_${params.checklistItemId}_${params.idx}.${ext === 'jpeg' ? 'jpg' : ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(s3Key, photoBuffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Upload failed ${s3Key}: ${error.message}`)

  const file = await prisma.file.create({
    data: {
      bucket: BUCKET,
      s3Key,
      mimeType,
      category: FileCategory.EVIDENCE_PHOTO,
      uploadStatus: UploadStatus.UPLOADED,
      fileSize: BigInt(photoBuffer.length),
      uploadedBy: params.uploadedBy,
    },
  })

  await prisma.evidence.create({
    data: {
      workOrderId: params.workOrderId,
      inspectionId: params.inspectionId,
      checklistItemId: params.checklistItemId,
      uploadedBy: params.uploadedBy,
      uploadedByRole: params.uploadedByRole,
      fileId: file.id,
      gpsLat: 23.5880 + (Math.random() - 0.5) * 0.01,
      gpsLng: 58.3829 + (Math.random() - 0.5) * 0.01,
      gpsAccuracy: 5,
      comment: params.comment,
    },
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding minimal test data...\n')

  const baseAdmin = await prisma.user.findUnique({ where: { email: 'admin@nama.om' } })
  if (!baseAdmin) { console.error('❌ Run `npm run db:seed` first.'); process.exit(1) }

  const scoringWeight = await prisma.scoringWeight.findFirst({ where: { effectiveTo: null } })
  if (!scoringWeight) { console.error('❌ No active scoring weights. Run `npm run db:seed` first.'); process.exit(1) }

  const checklistVersion = await prisma.checklistVersion.findFirst({ orderBy: { versionNumber: 'desc' } })
  if (!checklistVersion) { console.error('❌ No checklist version. Run `npm run db:seed` first.'); process.exit(1) }

  const checklistItems = await prisma.checklistItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  })

  const passwordHash = await bcrypt.hash('Test@12345', 12)

  // ── Inspector ──────────────────────────────────────────────────────────────
  console.log('👷 Creating inspector...')
  const inspector = await prisma.user.upsert({
    where: { email: 'ahmed.inspector@nama.om' },
    update: {},
    create: {
      email: 'ahmed.inspector@nama.om',
      passwordHash,
      role: UserRole.INSPECTOR,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: { employeeId: 'EMP-INS-001', fullName: 'Ahmed Al-Rashdi', phone: '+968 91234001' },
      },
    },
  })
  console.log(`   ✓ ahmed.inspector@nama.om\n`)

  // ── Contractor ─────────────────────────────────────────────────────────────
  console.log('🏗️  Creating contractor...')
  const contractor = await prisma.user.upsert({
    where: { email: 'khalid@jazeerawater.om' },
    update: {},
    create: {
      email: 'khalid@jazeerawater.om',
      passwordHash,
      role: UserRole.CONTRACTOR,
      status: UserStatus.ACTIVE,
      contractorProfile: {
        create: {
          crNumber: 'CR-1234567',
          companyName: 'Al Jazeera Water Works LLC',
          contactName: 'Khalid Al-Muhairi',
          email: 'khalid@jazeerawater.om',
          phone: '+968 92345001',
          regionsOfOperation: ['MS', 'NB', 'SB'],
        },
      },
    },
  })
  console.log(`   ✓ khalid@jazeerawater.om\n`)

  // ── Regulator ──────────────────────────────────────────────────────────────
  console.log('🏛️  Creating regulator...')
  await prisma.user.upsert({
    where: { email: 'yusuf.regulator@ewra.gov.om' },
    update: {},
    create: {
      email: 'yusuf.regulator@ewra.gov.om',
      passwordHash,
      role: UserRole.REGULATOR,
      status: UserStatus.ACTIVE,
      regulatorProfile: {
        create: {
          fullName: 'Yusuf Al-Lawati',
          phone: '+968 93456001',
          organization: 'EWRA',
          department: 'Water Quality',
        },
      },
    },
  })
  console.log(`   ✓ yusuf.regulator@ewra.gov.om\n`)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const today = new Date()
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d }
  const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
  const fmtId = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

  // ── Work Orders ────────────────────────────────────────────────────────────
  console.log('📋 Creating 5 work orders...\n')

  type WODef = {
    id: string; siteName: string; govCode: string; status: WorkOrderStatus
    allocationDate: Date; targetDate: Date; submissionDate: Date | null
    priority: WorkOrderPriority
    inspection: {
      status: InspectionStatus; hseScore: number | null; technicalScore: number | null
      processScore: number | null; closureScore: number | null; finalScore: number | null
      complianceRating: ComplianceRating | null; submittedAt: Date | null
    } | null
    contractorEvidenceItems: number // how many checklist items get contractor photos (0 = all)
    inspectorEvidence: boolean       // whether inspector photos are added
  }

  const workOrders: WODef[] = [
    {
      id: `WO-${fmtId(daysAgo(20))}-0001`,
      siteName: 'Muscat Hills Residential Supply',
      govCode: 'MS', priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.INSPECTION_COMPLETED,
      allocationDate: daysAgo(20), targetDate: daysAgo(5), submissionDate: daysAgo(12),
      inspection: {
        status: InspectionStatus.SUBMITTED,
        hseScore: 92, technicalScore: 88, processScore: 95, closureScore: 90,
        finalScore: 90.6, complianceRating: ComplianceRating.EXCELLENT,
        submittedAt: daysAgo(8),
      },
      contractorEvidenceItems: 0, // 0 = all 14 items
      inspectorEvidence: true,
    },
    {
      id: `WO-${fmtId(daysAgo(15))}-0002`,
      siteName: 'Al Amerat Zone 5 Housing',
      govCode: 'MS', priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.PENDING_INSPECTION,
      allocationDate: daysAgo(15), targetDate: daysFromNow(10), submissionDate: daysAgo(5),
      inspection: {
        status: InspectionStatus.PENDING,
        hseScore: null, technicalScore: null, processScore: null, closureScore: null,
        finalScore: null, complianceRating: null, submittedAt: null,
      },
      contractorEvidenceItems: 0, // 0 = all 14 items
      inspectorEvidence: false,
    },
    {
      id: `WO-${fmtId(daysAgo(10))}-0003`,
      siteName: 'Sohar Industrial Zone Pipeline',
      govCode: 'NB', priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.IN_PROGRESS,
      allocationDate: daysAgo(10), targetDate: daysFromNow(15), submissionDate: null,
      inspection: null,
      contractorEvidenceItems: 5, // partial — 5 items uploaded so far
      inspectorEvidence: false,
    },
    {
      id: `WO-${fmtId(daysAgo(5))}-0004`,
      siteName: 'Nizwa Heritage District Supply',
      govCode: 'DA', priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.ASSIGNED,
      allocationDate: daysAgo(5), targetDate: daysFromNow(20), submissionDate: null,
      inspection: null,
      contractorEvidenceItems: 0,
      inspectorEvidence: false,
    },
    {
      id: `WO-${fmtId(daysAgo(2))}-0005`,
      siteName: 'Salalah New Township Network',
      govCode: 'DH', priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.UNASSIGNED,
      allocationDate: daysAgo(2), targetDate: daysFromNow(30), submissionDate: null,
      inspection: null,
      contractorEvidenceItems: 0,
      inspectorEvidence: false,
    },
  ]

  // Delete existing evidence + file records for these WOs so re-runs don't hit unique key conflicts
  const woIds = workOrders.map(w => w.id)
  const existingEvidence = await prisma.evidence.findMany({ where: { workOrderId: { in: woIds } }, select: { fileId: true } })
  await prisma.evidence.deleteMany({ where: { workOrderId: { in: woIds } } })
  await prisma.file.deleteMany({ where: { id: { in: existingEvidence.map(e => e.fileId) } } })

  for (const wo of workOrders) {
    const needsInspector = wo.status !== WorkOrderStatus.UNASSIGNED

    await prisma.workOrder.upsert({
      where: { id: wo.id },
      update: {},
      create: {
        id: wo.id,
        contractorCr: 'CR-1234567',
        assignedInspectorId: needsInspector ? inspector.id : null,
        scoringWeightsId: scoringWeight.id,
        governorateCode: wo.govCode,
        siteName: wo.siteName,
        workType: WorkType.HOUSE_CONNECTIONS,
        priority: wo.priority,
        status: wo.status,
        allocationDate: wo.allocationDate,
        targetCompletionDate: wo.targetDate,
        submissionDate: wo.submissionDate,
      },
    })
    console.log(`   ✓ ${wo.id} — ${wo.siteName} [${wo.status}]`)

    // ── Inspection ───────────────────────────────────────────────────────────
    let inspectionId: string | null = null
    if (wo.inspection) {
      const existing = await prisma.inspection.findUnique({ where: { workOrderId: wo.id } })
      if (!existing) {
        const insp = await prisma.inspection.create({
          data: {
            workOrderId: wo.id,
            checklistVersionId: checklistVersion.versionNumber,
            status: wo.inspection.status,
            hseScore: wo.inspection.hseScore,
            technicalScore: wo.inspection.technicalScore,
            processScore: wo.inspection.processScore,
            closureScore: wo.inspection.closureScore,
            finalScore: wo.inspection.finalScore,
            complianceRating: wo.inspection.complianceRating,
            submittedAt: wo.inspection.submittedAt,
          },
        })
        inspectionId = insp.id

        // Responses for submitted inspections
        if (wo.inspection.status === InspectionStatus.SUBMITTED) {
          for (const item of checklistItems) {
            await prisma.inspectionResponse.create({
              data: {
                inspectionId: insp.id,
                checklistItemId: item.id,
                questionSnapshot: item.question,
                rating: RatingValue.COMPLIANT,
                inspectorComments: 'Meets all requirements',
              },
            })
          }
        }
      } else {
        inspectionId = existing.id
      }
    }

    // ── Contractor evidence ──────────────────────────────────────────────────
    const evidenceItems = wo.contractorEvidenceItems === 0
      ? checklistItems
      : checklistItems.slice(0, wo.contractorEvidenceItems)

    if (evidenceItems.length > 0) {
      process.stdout.write(`     📸 Uploading ${evidenceItems.length} contractor photos...`)
      for (let i = 0; i < evidenceItems.length; i++) {
        const item = evidenceItems[i]
        await uploadEvidence({
          workOrderId: wo.id,
          inspectionId,
          checklistItemId: item.id,
          questionSnapshot: item.question,
          uploadedBy: contractor.id,
          uploadedByRole: EvidenceUploaderRole.CONTRACTOR,
          comment: `Contractor evidence — ${item.question}`,
          idx: i,
        })
      }
      console.log(` done`)
    }

    // ── Inspector evidence (for completed WO only) ───────────────────────────
    if (wo.inspectorEvidence && inspectionId) {
      const inspItems = checklistItems.slice(0, 5)
      process.stdout.write(`     📸 Uploading ${inspItems.length} inspector photos...`)
      for (let i = 0; i < inspItems.length; i++) {
        const item = inspItems[i]
        await uploadEvidence({
          workOrderId: wo.id,
          inspectionId,
          checklistItemId: item.id,
          questionSnapshot: item.question,
          uploadedBy: inspector.id,
          uploadedByRole: EvidenceUploaderRole.INSPECTOR,
          comment: `Inspector verification — ${item.question}`,
          idx: i,
        })
      }
      console.log(` done`)
    }

    console.log('')
  }

  console.log('✅ Done!\n')
  console.log('━'.repeat(55))
  console.log('TEST ACCOUNTS  (password: Test@12345)')
  console.log('━'.repeat(55))
  console.log('  Admin      admin@nama.om              (Admin@NWS2026!)')
  console.log('  Inspector  ahmed.inspector@nama.om')
  console.log('  Contractor khalid@jazeerawater.om')
  console.log('  Regulator  yusuf.regulator@ewra.gov.om')
  console.log('━'.repeat(55))
  console.log('WORK ORDERS')
  console.log('━'.repeat(55))
  console.log('  INSPECTION_COMPLETED  Muscat Hills Residential Supply')
  console.log('    → 14 contractor photos + 5 inspector photos + full scores')
  console.log('  PENDING_INSPECTION    Al Amerat Zone 5 Housing')
  console.log('    → 14 contractor photos, awaiting inspector')
  console.log('  IN_PROGRESS           Sohar Industrial Zone Pipeline')
  console.log('    → 5 contractor photos uploaded so far')
  console.log('  ASSIGNED              Nizwa Heritage District Supply')
  console.log('  UNASSIGNED            Salalah New Township Network')
  console.log('━'.repeat(55))
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
