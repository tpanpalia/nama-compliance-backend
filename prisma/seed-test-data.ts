import {
  PrismaClient,
  UserRole,
  UserStatus,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkType,
  InspectionStatus,
  ComplianceRating,
  RatingValue,
  EvidenceUploaderRole,
  FileCategory,
  UploadStatus,
  NotificationType,
  AuditEntityType,
  AuditAction,
  AccessRequestRole,
  AccessRequestStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load root env first, then optional env-specific overrides.
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false })
}

const prisma = new PrismaClient()

// Supabase storage client
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'nws-compliance'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required for uploading photos.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================================
// SAMPLE PHOTOS — mapped to checklist items
// ============================================================
const PHOTOS_DIR = '/Users/tanushreepanpalia/Desktop/sample_photos'

/** Each photo mapped to the checklist item it best represents */
const PHOTO_MAP = [
  { file: 'WhatsApp Image 2026-03-29 at 12.29.48.jpeg',      item: 'TECH-001', desc: 'Excavation trench depth and dimensions' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.48 (1).jpeg',  item: 'TECH-002', desc: 'Blue warning tape installed above pipeline' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.48 (2).jpeg',  item: 'TECH-003', desc: 'Worker preparing sand bedding in trench' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.48 (3).jpeg',  item: 'HSE-003', desc: 'Workers gathered for HSE standards briefing' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.53.jpeg',       item: 'TECH-004', desc: 'Excavation with backhoe — ground leveling' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.54.jpeg',       item: 'HSE-001', desc: 'Workers wearing full PPE — vests and helmets' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.54 (1).jpeg',  item: 'TECH-005', desc: 'Pipeline fittings and connections in trench' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.54 (2).jpeg',  item: 'TECH-006', desc: 'Pipeline laid along residential street — marker area' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.54 (3).jpeg',  item: 'TECH-003', desc: 'Sand bedding along excavation trench' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.55.jpeg',       item: 'HSE-002', desc: 'Safety barriers and traffic cones at site' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.55 (1).jpeg',  item: 'PROC-001', desc: 'Inspector conducting pre-work site briefing' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.55 (2).jpeg',  item: 'HSE-001', desc: 'Team PPE compliance verification' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.55 (3).jpeg',  item: 'HSE-002', desc: 'Road safety barriers and cones setup' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.56.jpeg',       item: 'PROC-003', desc: 'Inspector reviewing worker attendance list' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.56 (1).jpeg',  item: 'PROC-001', desc: 'Notification briefing before works begin' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.56 (2).jpeg',  item: 'CLOSE-001', desc: 'Equipment positioned for site reinstatement' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.56 (3).jpeg',  item: 'PROC-002', desc: 'Inspector reviewing monthly technical report' },
  { file: 'WhatsApp Image 2026-03-29 at 12.29.57.jpeg',       item: 'TECH-007', desc: 'Site area for identification tag installation' },
]

// Pre-read all photo buffers
const photoBuffers: Map<string, Buffer> = new Map()
for (const p of PHOTO_MAP) {
  const fullPath = path.join(PHOTOS_DIR, p.file)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Photo not found: ${fullPath}`)
    process.exit(1)
  }
  photoBuffers.set(p.file, fs.readFileSync(fullPath))
}
console.log(`📷 Loaded ${photoBuffers.size} photos from ${PHOTOS_DIR}\n`)

// ============================================================
// HELPERS
// ============================================================
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Upload a photo buffer to Supabase storage, returns the s3Key */
async function uploadPhoto(s3Key: string, buffer: Buffer): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(s3Key, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) {
    throw new Error(`Upload failed for ${s3Key}: ${error.message}`)
  }
}

/** GPS coordinates for Oman governorate areas */
const GPS_COORDS: Record<string, { lat: number; lng: number }> = {
  MS: { lat: 23.5880, lng: 58.3829 },
  DH: { lat: 17.0194, lng: 54.0924 },
  MU: { lat: 26.1842, lng: 56.2478 },
  BU: { lat: 24.2446, lng: 55.7632 },
  DA: { lat: 22.9333, lng: 57.5333 },
  NB: { lat: 24.3643, lng: 56.7281 },
  SB: { lat: 23.6851, lng: 57.6920 },
  NS: { lat: 22.5667, lng: 59.5289 },
  SS: { lat: 22.5667, lng: 59.1289 },
  DZ: { lat: 23.3000, lng: 56.4500 },
  WU: { lat: 20.5000, lng: 56.5000 },
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🧪 Seeding test data...\n')

  // Ensure base seed data exists
  const baseAdmin = await prisma.user.findUnique({ where: { email: 'admin@nama.om' } })
  if (!baseAdmin) {
    console.error('❌ Base seed data not found. Run `npm run db:seed` first.')
    process.exit(1)
  }

  const scoringWeight = await prisma.scoringWeight.findFirst({ where: { effectiveTo: null } })
  if (!scoringWeight) {
    console.error('❌ No active scoring weights found. Run `npm run db:seed` first.')
    process.exit(1)
  }

  const checklistVersion = await prisma.checklistVersion.findFirst({
    orderBy: { versionNumber: 'desc' },
  })
  if (!checklistVersion) {
    console.error('❌ No checklist version found. Run `npm run db:seed` first.')
    process.exit(1)
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  })

  const passwordHash = await bcrypt.hash('Test@12345', 12)

  // ----------------------------------------------------------
  // 1. ADMIN (test admin)
  // ----------------------------------------------------------
  console.log('🔑 Creating test admin...')
  const testAdmin = await prisma.user.upsert({
    where: { email: 'testadmin@nama.om' },
    update: {},
    create: {
      email: 'testadmin@nama.om',
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      lastLogin: daysAgo(1),
      staffProfile: {
        create: {
          employeeId: 'EMP-ADMIN-002',
          fullName: 'Test Administrator',
          phone: '+968 90000002',
        },
      },
    },
  })
  console.log(`   ✓ testadmin@nama.om\n`)

  // ----------------------------------------------------------
  // 2. INSPECTORS (3)
  // ----------------------------------------------------------
  console.log('👷 Creating inspectors...')
  const inspectorData = [
    { email: 'ahmed.inspector@nama.om', name: 'Ahmed Al-Rashdi', empId: 'EMP-INS-001', phone: '+968 91234001' },
    { email: 'fatma.inspector@nama.om', name: 'Fatma Al-Balushi', empId: 'EMP-INS-002', phone: '+968 91234002' },
    { email: 'saif.inspector@nama.om', name: 'Saif Al-Habsi', empId: 'EMP-INS-003', phone: '+968 91234003' },
  ]

  const inspectors = []
  for (const ins of inspectorData) {
    const user = await prisma.user.upsert({
      where: { email: ins.email },
      update: {},
      create: {
        email: ins.email,
        passwordHash,
        role: UserRole.INSPECTOR,
        status: UserStatus.ACTIVE,
        lastLogin: daysAgo(randomBetween(0, 3)),
        staffProfile: {
          create: {
            employeeId: ins.empId,
            fullName: ins.name,
            phone: ins.phone,
          },
        },
      },
    })
    inspectors.push(user)
  }
  console.log(`   ✓ ${inspectors.length} inspectors\n`)

  // ----------------------------------------------------------
  // 3. CONTRACTORS (4)
  // ----------------------------------------------------------
  console.log('🏗️  Creating contractors...')
  const contractorData = [
    { cr: 'CR-1234567', company: 'Al Jazeera Water Works LLC', contact: 'Khalid Al-Muhairi', email: 'khalid@jazeerawater.om', phone: '+968 92345001', regions: ['MS', 'NB', 'SB'] },
    { cr: 'CR-2345678', company: 'Oman Pipeline Services SAOC', contact: 'Sara Al-Farsi', email: 'sara@omanpipeline.om', phone: '+968 92345002', regions: ['MS', 'DA', 'DZ'] },
    { cr: 'CR-3456789', company: 'Gulf Utilities Contracting', contact: 'Mohammed Al-Kindi', email: 'mohammed@gulfutilities.om', phone: '+968 92345003', regions: ['DH', 'WU', 'SS'] },
    { cr: 'CR-4567890', company: 'National Infra Solutions LLC', contact: 'Amina Al-Siyabi', email: 'amina@nationalinfra.om', phone: '+968 92345004', regions: ['MU', 'BU', 'NS'] },
  ]

  const contractors = []
  for (const c of contractorData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash,
        role: UserRole.CONTRACTOR,
        status: UserStatus.ACTIVE,
        lastLogin: daysAgo(randomBetween(0, 5)),
        contractorProfile: {
          create: {
            crNumber: c.cr,
            companyName: c.company,
            contactName: c.contact,
            email: c.email,
            phone: c.phone,
            regionsOfOperation: c.regions,
          },
        },
      },
    })
    contractors.push({ user, cr: c.cr })
  }
  console.log(`   ✓ ${contractors.length} contractors\n`)

  // ----------------------------------------------------------
  // 4. REGULATORS (2)
  // ----------------------------------------------------------
  console.log('🏛️  Creating regulators...')
  const regulatorData = [
    { email: 'yusuf.regulator@ewra.gov.om', name: 'Yusuf Al-Lawati', empId: 'REG-001', org: 'EWRA', dept: 'Water Quality', position: 'Senior Analyst', phone: '+968 93456001' },
    { email: 'mariam.regulator@ewra.gov.om', name: 'Mariam Al-Zadjali', empId: 'REG-002', org: 'EWRA', dept: 'Compliance', position: 'Director', phone: '+968 93456002' },
  ]

  const regulators = []
  for (const r of regulatorData) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        email: r.email,
        passwordHash,
        role: UserRole.REGULATOR,
        status: UserStatus.ACTIVE,
        lastLogin: daysAgo(randomBetween(0, 7)),
        regulatorProfile: {
          create: {
            employeeId: r.empId,
            fullName: r.name,
            phone: r.phone,
            organization: r.org,
            department: r.dept,
            position: r.position,
          },
        },
      },
    })
    regulators.push(user)
  }
  console.log(`   ✓ ${regulators.length} regulators\n`)

  // ----------------------------------------------------------
  // 5. WORK ORDERS (24) — ALL 8 statuses, 3 per status
  // ----------------------------------------------------------
  console.log('📋 Creating work orders...')
  const governorateCodes = ['MS', 'DH', 'MU', 'BU', 'DA', 'NB', 'SB', 'NS', 'SS', 'DZ', 'WU']
  const siteNames = [
    // UNASSIGNED (3)
    'Al Hail South Network Upgrade',
    'Ghubra Industrial Water Line',
    'Wadi Kabir New Connection',
    // ASSIGNED (3)
    'Qurum Heights Water Extension',
    'Bausher Commercial District',
    'Muscat Hills Residential Supply',
    // IN_PROGRESS (3)
    'Al Amerat Zone 5 Housing',
    'Rustaq Valley Connection Line',
    'Barka North Expansion Project',
    // SUBMITTED (3)
    'Ibri Municipal Connection Point',
    'Salalah New Township Water Network',
    'Sur Coastal Housing Development',
    // PENDING_INSPECTION (3)
    'Sohar Industrial Zone Pipeline',
    'Nizwa Heritage District Supply Line',
    'Seeb Residential Zone 4 Connection',
    // INSPECTION_IN_PROGRESS (3)
    'Ruwi Main Pipeline Extension',
    'Al Khuwair Water Connection - Block 240',
    'Mawaleh South Water Network',
    // INSPECTION_COMPLETED (3)
    'Azaiba Beachfront Pipeline',
    'Al Mouj Residential Connection',
    'Ghala Heights Water Supply',
    // OVERDUE (3)
    'Darsait Old Town Water Rehab',
    'Muttrah Corniche Extension',
    'Wattayah Commercial Supply Line',
  ]

  type WOConfig = {
    daysBack: number
    targetDays: number
    status: WorkOrderStatus
    inspStatus: InspectionStatus | null
    hasScores: boolean
    evidenceCount: number // how many checklist items get evidence photos
  }

  const woConfigs: WOConfig[] = [
    // UNASSIGNED (3) — no evidence
    { daysBack: 1, targetDays: 30, status: WorkOrderStatus.UNASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },
    { daysBack: 2, targetDays: 25, status: WorkOrderStatus.UNASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },
    { daysBack: 3, targetDays: 35, status: WorkOrderStatus.UNASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },

    // ASSIGNED (3) — no evidence yet
    { daysBack: 5, targetDays: 30, status: WorkOrderStatus.ASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },
    { daysBack: 4, targetDays: 25, status: WorkOrderStatus.ASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },
    { daysBack: 6, targetDays: 35, status: WorkOrderStatus.ASSIGNED, inspStatus: null, hasScores: false, evidenceCount: 0 },

    // IN_PROGRESS (3) — contractor uploading some evidence
    { daysBack: 10, targetDays: 30, status: WorkOrderStatus.IN_PROGRESS, inspStatus: null, hasScores: false, evidenceCount: 4 },
    { daysBack: 8, targetDays: 25, status: WorkOrderStatus.IN_PROGRESS, inspStatus: null, hasScores: false, evidenceCount: 3 },
    { daysBack: 12, targetDays: 30, status: WorkOrderStatus.IN_PROGRESS, inspStatus: null, hasScores: false, evidenceCount: 2 },

    // SUBMITTED (3) — contractor uploaded all evidence
    { daysBack: 15, targetDays: 25, status: WorkOrderStatus.SUBMITTED, inspStatus: null, hasScores: false, evidenceCount: 14 },
    { daysBack: 14, targetDays: 20, status: WorkOrderStatus.SUBMITTED, inspStatus: null, hasScores: false, evidenceCount: 14 },
    { daysBack: 16, targetDays: 30, status: WorkOrderStatus.SUBMITTED, inspStatus: null, hasScores: false, evidenceCount: 14 },

    // PENDING_INSPECTION (3) — full contractor evidence, inspection not started
    { daysBack: 20, targetDays: 30, status: WorkOrderStatus.PENDING_INSPECTION, inspStatus: InspectionStatus.PENDING, hasScores: false, evidenceCount: 14 },
    { daysBack: 18, targetDays: 25, status: WorkOrderStatus.PENDING_INSPECTION, inspStatus: InspectionStatus.PENDING, hasScores: false, evidenceCount: 14 },
    { daysBack: 22, targetDays: 30, status: WorkOrderStatus.PENDING_INSPECTION, inspStatus: InspectionStatus.PENDING, hasScores: false, evidenceCount: 14 },

    // INSPECTION_IN_PROGRESS (3) — inspector actively inspecting
    { daysBack: 25, targetDays: 35, status: WorkOrderStatus.INSPECTION_IN_PROGRESS, inspStatus: InspectionStatus.IN_PROGRESS, hasScores: false, evidenceCount: 14 },
    { daysBack: 23, targetDays: 30, status: WorkOrderStatus.INSPECTION_IN_PROGRESS, inspStatus: InspectionStatus.IN_PROGRESS, hasScores: false, evidenceCount: 14 },
    { daysBack: 27, targetDays: 35, status: WorkOrderStatus.INSPECTION_IN_PROGRESS, inspStatus: InspectionStatus.IN_PROGRESS, hasScores: false, evidenceCount: 14 },

    // INSPECTION_COMPLETED (3) — full scores, full evidence
    { daysBack: 40, targetDays: 30, status: WorkOrderStatus.INSPECTION_COMPLETED, inspStatus: InspectionStatus.SUBMITTED, hasScores: true, evidenceCount: 14 },
    { daysBack: 35, targetDays: 25, status: WorkOrderStatus.INSPECTION_COMPLETED, inspStatus: InspectionStatus.SUBMITTED, hasScores: true, evidenceCount: 14 },
    { daysBack: 45, targetDays: 30, status: WorkOrderStatus.INSPECTION_COMPLETED, inspStatus: InspectionStatus.SUBMITTED, hasScores: true, evidenceCount: 14 },

    // OVERDUE (3) — past target, some evidence
    { daysBack: 40, targetDays: 10, status: WorkOrderStatus.OVERDUE, inspStatus: null, hasScores: false, evidenceCount: 5 },
    { daysBack: 35, targetDays: 5, status: WorkOrderStatus.OVERDUE, inspStatus: null, hasScores: false, evidenceCount: 3 },
    { daysBack: 50, targetDays: 15, status: WorkOrderStatus.OVERDUE, inspStatus: null, hasScores: false, evidenceCount: 0 },
  ]

  const priorities = [WorkOrderPriority.LOW, WorkOrderPriority.MEDIUM, WorkOrderPriority.HIGH, WorkOrderPriority.CRITICAL]

  type CreatedWO = {
    id: string
    config: WOConfig
    contractorIdx: number
    inspectorIdx: number
    govCode: string
  }
  const createdWorkOrders: CreatedWO[] = []

  for (let i = 0; i < woConfigs.length; i++) {
    const cfg = woConfigs[i]
    const allocDate = daysAgo(cfg.daysBack)
    const woId = `WO-${formatDate(allocDate)}-${String(i + 1).padStart(4, '0')}`
    const contractorIdx = i % contractors.length
    const inspectorIdx = i % inspectors.length
    const govCode = governorateCodes[i % governorateCodes.length]
    const needsInspector = cfg.status !== WorkOrderStatus.UNASSIGNED

    const hasSubmission =
      cfg.status === WorkOrderStatus.SUBMITTED ||
      cfg.status === WorkOrderStatus.PENDING_INSPECTION ||
      cfg.status === WorkOrderStatus.INSPECTION_IN_PROGRESS ||
      cfg.status === WorkOrderStatus.INSPECTION_COMPLETED

    await prisma.workOrder.upsert({
      where: { id: woId },
      update: {},
      create: {
        id: woId,
        contractorCr: contractors[contractorIdx].cr,
        assignedInspectorId: needsInspector ? inspectors[inspectorIdx].id : null,
        scoringWeightsId: scoringWeight.id,
        governorateCode: govCode,
        siteName: siteNames[i],
        description: `Test work order for ${siteNames[i]}. Status: ${cfg.status}.`,
        workType: WorkType.HOUSE_CONNECTIONS,
        priority: priorities[i % priorities.length],
        status: cfg.status,
        allocationDate: allocDate,
        targetCompletionDate: daysFromNow(cfg.targetDays - cfg.daysBack),
        submissionDate: hasSubmission ? daysAgo(cfg.daysBack - 5) : null,
      },
    })

    createdWorkOrders.push({ id: woId, config: cfg, contractorIdx, inspectorIdx, govCode })
  }

  const statusCounts: Record<string, number> = {}
  for (const wo of createdWorkOrders) {
    statusCounts[wo.config.status] = (statusCounts[wo.config.status] || 0) + 1
  }
  console.log(`   ✓ ${createdWorkOrders.length} work orders`)
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`     - ${status}: ${count}`)
  }
  console.log('')

  // ----------------------------------------------------------
  // 6. INSPECTIONS (for WOs in inspection phase)
  // ----------------------------------------------------------
  console.log('🔍 Creating inspections...')
  let inspectionCount = 0

  const scoreTemplates = [
    { hse: 92, tech: 88, proc: 95, close: 90, rating: ComplianceRating.EXCELLENT },
    { hse: 78, tech: 82, proc: 75, close: 80, rating: ComplianceRating.GOOD },
    { hse: 55, tech: 60, proc: 50, close: 45, rating: ComplianceRating.FAIR },
  ]

  for (const wo of createdWorkOrders) {
    if (!wo.config.inspStatus) continue

    const scoreTemplate = wo.config.hasScores ? scoreTemplates[inspectionCount % scoreTemplates.length] : null
    const finalScore = scoreTemplate
      ? (scoreTemplate.hse * 0.3 + scoreTemplate.tech * 0.4 + scoreTemplate.proc * 0.2 + scoreTemplate.close * 0.1)
      : null

    await prisma.inspection.create({
      data: {
        workOrderId: wo.id,
        checklistVersionId: checklistVersion.versionNumber,
        hseScore: scoreTemplate?.hse ?? null,
        technicalScore: scoreTemplate?.tech ?? null,
        processScore: scoreTemplate?.proc ?? null,
        closureScore: scoreTemplate?.close ?? null,
        finalScore: finalScore ? Number(finalScore.toFixed(2)) : null,
        complianceRating: scoreTemplate?.rating ?? null,
        status: wo.config.inspStatus,
        submittedAt: wo.config.inspStatus === InspectionStatus.SUBMITTED ? daysAgo(wo.config.daysBack - 8) : null,
      },
    })
    inspectionCount++
  }
  console.log(`   ✓ ${inspectionCount} inspections\n`)

  // ----------------------------------------------------------
  // 7. INSPECTION RESPONSES (for in-progress and completed inspections)
  // ----------------------------------------------------------
  console.log('📝 Creating inspection responses...')
  let responseCount = 0

  function getRatingForScore(score: number): RatingValue {
    if (score >= 80) return RatingValue.COMPLIANT
    if (score >= 55) return RatingValue.PARTIAL
    return RatingValue.NON_COMPLIANT
  }

  const inspectorComments: Record<string, string[]> = {
    COMPLIANT: ['Meets all requirements', 'Well executed', 'No issues found', 'Properly installed', 'Excellent condition'],
    PARTIAL: ['Minor deviations noted', 'Needs minor corrections', 'Partially meets requirements', 'Some improvements needed'],
    NON_COMPLIANT: ['Does not meet standards', 'Requires rework', 'Significant issues found', 'Not acceptable'],
  }

  let scoreIdx = 0
  for (const wo of createdWorkOrders) {
    if (wo.config.inspStatus !== InspectionStatus.IN_PROGRESS && wo.config.inspStatus !== InspectionStatus.SUBMITTED) continue

    const inspection = await prisma.inspection.findUnique({ where: { workOrderId: wo.id } })
    if (!inspection) continue

    const scoreTemplate = wo.config.hasScores ? scoreTemplates[scoreIdx % scoreTemplates.length] : null
    const categoryScoreMap: Record<string, number> = {
      HSE: scoreTemplate?.hse ?? 70,
      TECHNICAL: scoreTemplate?.tech ?? 70,
      PROCESS: scoreTemplate?.proc ?? 70,
      CLOSURE: scoreTemplate?.close ?? 70,
    }

    for (const item of checklistItems) {
      const catScore = categoryScoreMap[item.category] ?? 70
      const rating = getRatingForScore(catScore + randomBetween(-15, 15))
      const comments = inspectorComments[rating]

      await prisma.inspectionResponse.create({
        data: {
          inspectionId: inspection.id,
          checklistItemId: item.id,
          questionSnapshot: item.question,
          rating,
          inspectorComments: randomElement(comments),
        },
      })
      responseCount++
    }
    scoreIdx++
  }
  console.log(`   ✓ ${responseCount} responses\n`)

  // ----------------------------------------------------------
  // 8. FILES & EVIDENCE — upload real photos to Supabase
  // ----------------------------------------------------------
  console.log('📸 Uploading photos and creating evidence...')
  let fileCount = 0
  let evidenceCount = 0
  let uploadCount = 0

  // Build a lookup: checklist item id → list of photos for it
  const photosForItem: Record<string, typeof PHOTO_MAP> = {}
  for (const p of PHOTO_MAP) {
    if (!photosForItem[p.item]) photosForItem[p.item] = []
    photosForItem[p.item].push(p)
  }

  for (const wo of createdWorkOrders) {
    if (wo.config.evidenceCount === 0) continue

    const gps = GPS_COORDS[wo.govCode] || GPS_COORDS['MS']
    const inspection = await prisma.inspection.findUnique({ where: { workOrderId: wo.id } }).catch(() => null)

    // Pick checklist items to attach evidence to (up to evidenceCount)
    const itemsForEvidence = checklistItems.slice(0, wo.config.evidenceCount)

    for (const item of itemsForEvidence) {
      // Pick a photo mapped to this checklist item (cycle through available ones)
      const availablePhotos = photosForItem[item.id]
      if (!availablePhotos || availablePhotos.length === 0) continue
      const photo = availablePhotos[fileCount % availablePhotos.length]
      const buffer = photoBuffers.get(photo.file)!

      // Upload to Supabase with unique key
      const s3Key = `evidence-photo/${wo.id}/${item.id}_${fileCount}.jpg`
      await uploadPhoto(s3Key, buffer)
      uploadCount++

      // Create file record
      const file = await prisma.file.create({
        data: {
          bucket: BUCKET,
          s3Key,
          mimeType: 'image/jpeg',
          category: FileCategory.EVIDENCE_PHOTO,
          uploadStatus: UploadStatus.UPLOADED,
          fileSize: BigInt(buffer.length),
          uploadedBy: contractors[wo.contractorIdx].user.id,
          uploadedAt: daysAgo(wo.config.daysBack - 2),
        },
      })
      fileCount++

      // Create evidence record (contractor evidence)
      await prisma.evidence.create({
        data: {
          workOrderId: wo.id,
          inspectionId: inspection?.id ?? null,
          checklistItemId: item.id,
          uploadedBy: contractors[wo.contractorIdx].user.id,
          uploadedByRole: EvidenceUploaderRole.CONTRACTOR,
          fileId: file.id,
          gpsLat: gps.lat + (Math.random() - 0.5) * 0.01,
          gpsLng: gps.lng + (Math.random() - 0.5) * 0.01,
          gpsAccuracy: randomBetween(3, 15),
          comment: photo.desc,
          capturedAt: daysAgo(wo.config.daysBack - 2),
        },
      })
      evidenceCount++
    }

    // Inspector evidence for in-progress/completed inspections (5 key items)
    if (inspection && (wo.config.inspStatus === InspectionStatus.IN_PROGRESS || wo.config.inspStatus === InspectionStatus.SUBMITTED)) {
      const inspEvidenceItems = checklistItems.slice(0, 5) // HSE + first 2 TECH items
      for (const item of inspEvidenceItems) {
        const availablePhotos = photosForItem[item.id]
        if (!availablePhotos || availablePhotos.length === 0) continue
        const photo = availablePhotos[0]
        const buffer = photoBuffers.get(photo.file)!

        const s3Key = `evidence-photo/${wo.id}/inspector_${item.id}_${fileCount}.jpg`
        await uploadPhoto(s3Key, buffer)
        uploadCount++

        const file = await prisma.file.create({
          data: {
            bucket: BUCKET,
            s3Key,
            mimeType: 'image/jpeg',
            category: FileCategory.EVIDENCE_PHOTO,
            uploadStatus: UploadStatus.UPLOADED,
            fileSize: BigInt(buffer.length),
            uploadedBy: inspectors[wo.inspectorIdx].id,
            uploadedAt: daysAgo(wo.config.daysBack - 4),
          },
        })
        fileCount++

        await prisma.evidence.create({
          data: {
            workOrderId: wo.id,
            inspectionId: inspection.id,
            checklistItemId: item.id,
            uploadedBy: inspectors[wo.inspectorIdx].id,
            uploadedByRole: EvidenceUploaderRole.INSPECTOR,
            fileId: file.id,
            gpsLat: gps.lat + (Math.random() - 0.5) * 0.01,
            gpsLng: gps.lng + (Math.random() - 0.5) * 0.01,
            gpsAccuracy: randomBetween(3, 10),
            comment: `Inspector verification — ${photo.desc}`,
            capturedAt: daysAgo(wo.config.daysBack - 4),
          },
        })
        evidenceCount++
      }
    }

    // Progress indicator
    if (uploadCount % 20 === 0) {
      console.log(`     ... ${uploadCount} photos uploaded`)
    }
  }
  console.log(`   ✓ ${uploadCount} photos uploaded to Supabase`)
  console.log(`   ✓ ${fileCount} file records, ${evidenceCount} evidence records\n`)

  // ----------------------------------------------------------
  // 9. ACCESS REQUESTS (5)
  // ----------------------------------------------------------
  console.log('📝 Creating access requests...')
  const accessRequests = [
    { name: 'Hassan Al-Harthi', email: 'hassan@newcontractor.om', phone: '+968 94567001', role: AccessRequestRole.CONTRACTOR, cr: 'CR-9876543', status: AccessRequestStatus.PENDING },
    { name: 'Layla Al-Busaidi', email: 'layla@bluewater.om', phone: '+968 94567002', role: AccessRequestRole.CONTRACTOR, cr: 'CR-8765432', status: AccessRequestStatus.PENDING },
    { name: 'Nasser Al-Wahaibi', email: 'nasser@govwater.gov.om', phone: '+968 94567003', role: AccessRequestRole.REGULATOR, org: 'Ministry of Water', status: AccessRequestStatus.APPROVED },
    { name: 'Aisha Al-Maskari', email: 'aisha@govinfra.gov.om', phone: '+968 94567004', role: AccessRequestRole.REGULATOR, org: 'Infra Authority', status: AccessRequestStatus.REJECTED },
    { name: 'Omar Al-Rawahi', email: 'omar@desertpipes.om', phone: '+968 94567005', role: AccessRequestRole.CONTRACTOR, cr: 'CR-7654321', status: AccessRequestStatus.PENDING },
  ]

  for (let i = 0; i < accessRequests.length; i++) {
    const ar = accessRequests[i]
    const reqDate = daysAgo(randomBetween(1, 15))
    const reqId = `REQ-${formatDate(reqDate)}-${String(i + 1).padStart(4, '0')}`

    await prisma.accessRequest.upsert({
      where: { id: reqId },
      update: {},
      create: {
        id: reqId,
        applicantName: ar.name,
        email: ar.email,
        phone: ar.phone,
        roleRequested: ar.role,
        contractorCr: ar.cr ?? null,
        organization: ar.org ?? null,
        status: ar.status,
        reviewedBy: ar.status !== AccessRequestStatus.PENDING ? baseAdmin.id : null,
        reviewedAt: ar.status !== AccessRequestStatus.PENDING ? daysAgo(randomBetween(0, 3)) : null,
        rejectionReason: ar.status === AccessRequestStatus.REJECTED ? 'Incomplete documentation' : null,
        requestDate: reqDate,
      },
    })
  }
  console.log(`   ✓ ${accessRequests.length} access requests\n`)

  // ----------------------------------------------------------
  // 10. NOTIFICATIONS
  // ----------------------------------------------------------
  console.log('🔔 Creating notifications...')
  const notifications: Array<{
    userId: string
    type: NotificationType
    title: string
    message: string
    isRead: boolean
    workOrderId?: string
  }> = []

  for (const wo of createdWorkOrders) {
    if (wo.config.status !== WorkOrderStatus.UNASSIGNED) {
      notifications.push({
        userId: inspectors[wo.inspectorIdx].id,
        type: NotificationType.WORK_ORDER_ASSIGNED,
        title: 'New Work Order Assigned',
        message: `Work order ${wo.id} has been assigned to you.`,
        isRead: wo.config.daysBack > 10,
        workOrderId: wo.id,
      })
    }

    const woSubmitted =
      wo.config.status === WorkOrderStatus.SUBMITTED ||
      wo.config.status === WorkOrderStatus.PENDING_INSPECTION ||
      wo.config.status === WorkOrderStatus.INSPECTION_IN_PROGRESS ||
      wo.config.status === WorkOrderStatus.INSPECTION_COMPLETED
    if (woSubmitted) {
      notifications.push({
        userId: inspectors[wo.inspectorIdx].id,
        type: NotificationType.WORK_ORDER_SUBMITTED,
        title: 'Work Order Submitted',
        message: `Contractor has submitted work order ${wo.id}. Ready for inspection.`,
        isRead: wo.config.daysBack > 15,
        workOrderId: wo.id,
      })
    }

    if (wo.config.status === WorkOrderStatus.INSPECTION_COMPLETED) {
      notifications.push({
        userId: contractors[wo.contractorIdx].user.id,
        type: NotificationType.INSPECTION_COMPLETED,
        title: 'Inspection Completed',
        message: `Inspection for ${wo.id} is complete. View your score in the dashboard.`,
        isRead: false,
        workOrderId: wo.id,
      })
    }
  }

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        workOrderId: n.workOrderId ?? null,
      },
    })
  }
  console.log(`   ✓ ${notifications.length} notifications\n`)

  // ----------------------------------------------------------
  // 11. AUDIT LOGS
  // ----------------------------------------------------------
  console.log('📜 Creating audit logs...')
  let auditCount = 0

  for (const wo of createdWorkOrders) {
    await prisma.auditLog.create({
      data: {
        performedBy: testAdmin.id,
        entityType: AuditEntityType.WORK_ORDER,
        entityId: wo.id,
        action: AuditAction.CREATED,
        metadata: { contractorCr: contractors[wo.contractorIdx].cr },
        createdAt: daysAgo(wo.config.daysBack),
      },
    })
    auditCount++

    if (wo.config.status !== WorkOrderStatus.UNASSIGNED) {
      await prisma.auditLog.create({
        data: {
          performedBy: testAdmin.id,
          entityType: AuditEntityType.WORK_ORDER,
          entityId: wo.id,
          action: AuditAction.ASSIGNED,
          metadata: { inspectorId: inspectors[wo.inspectorIdx].id },
          createdAt: daysAgo(wo.config.daysBack - 1),
        },
      })
      auditCount++
    }

    const wasSubmitted =
      wo.config.status === WorkOrderStatus.SUBMITTED ||
      wo.config.status === WorkOrderStatus.PENDING_INSPECTION ||
      wo.config.status === WorkOrderStatus.INSPECTION_IN_PROGRESS ||
      wo.config.status === WorkOrderStatus.INSPECTION_COMPLETED
    if (wasSubmitted) {
      await prisma.auditLog.create({
        data: {
          performedBy: contractors[wo.contractorIdx].user.id,
          entityType: AuditEntityType.WORK_ORDER,
          entityId: wo.id,
          action: AuditAction.SUBMITTED,
          createdAt: daysAgo(wo.config.daysBack - 5),
        },
      })
      auditCount++
    }

    const inspectionStarted =
      wo.config.status === WorkOrderStatus.INSPECTION_IN_PROGRESS ||
      wo.config.status === WorkOrderStatus.INSPECTION_COMPLETED
    if (inspectionStarted) {
      await prisma.auditLog.create({
        data: {
          performedBy: inspectors[wo.inspectorIdx].id,
          entityType: AuditEntityType.INSPECTION,
          entityId: wo.id,
          action: AuditAction.INSPECTION_STARTED,
          createdAt: daysAgo(wo.config.daysBack - 6),
        },
      })
      auditCount++
    }

    if (wo.config.status === WorkOrderStatus.INSPECTION_COMPLETED) {
      await prisma.auditLog.create({
        data: {
          performedBy: inspectors[wo.inspectorIdx].id,
          entityType: AuditEntityType.INSPECTION,
          entityId: wo.id,
          action: AuditAction.INSPECTION_COMPLETED,
          createdAt: daysAgo(wo.config.daysBack - 8),
        },
      })
      auditCount++
    }
  }

  for (const c of contractors) {
    await prisma.auditLog.create({
      data: {
        performedBy: testAdmin.id,
        entityType: AuditEntityType.USER,
        entityId: c.user.id,
        action: AuditAction.REGISTERED,
        metadata: { role: 'CONTRACTOR', cr: c.cr },
        createdAt: daysAgo(60),
      },
    })
    auditCount++
  }
  console.log(`   ✓ ${auditCount} audit log entries\n`)

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------
  console.log('✅ Test data seeding complete!\n')
  console.log('━'.repeat(60))
  console.log('TEST ACCOUNTS (all use password: Test@12345)')
  console.log('━'.repeat(60))
  console.log('')
  console.log('  ADMIN:')
  console.log('    Test Administrator         → testadmin@nama.om')
  console.log('    System Administrator       → admin@nama.om (password: Admin@NWS2026!)')
  console.log('')
  console.log('  INSPECTORS:')
  for (const ins of inspectorData) {
    console.log(`    ${ins.name.padEnd(25)} → ${ins.email}`)
  }
  console.log('')
  console.log('  CONTRACTORS:')
  for (const c of contractorData) {
    console.log(`    ${c.company.padEnd(35)} → ${c.email}`)
  }
  console.log('')
  console.log('  REGULATORS:')
  for (const r of regulatorData) {
    console.log(`    ${r.name.padEnd(25)} → ${r.email}`)
  }
  console.log('')
  console.log('━'.repeat(60))
  console.log('WORK ORDERS — 24 total (3 per status)')
  console.log('━'.repeat(60))
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status.padEnd(30)} ${count}`)
  }
  console.log('')
  console.log('━'.repeat(60))
  console.log('DATA TOTALS')
  console.log('━'.repeat(60))
  console.log(`  Users:              ${1 + inspectors.length + contractors.length + regulators.length} (+ 1 base admin)`)
  console.log(`  Work Orders:        ${createdWorkOrders.length}`)
  console.log(`  Inspections:        ${inspectionCount}`)
  console.log(`  Responses:          ${responseCount}`)
  console.log(`  Photos uploaded:    ${uploadCount}`)
  console.log(`  File records:       ${fileCount}`)
  console.log(`  Evidence records:   ${evidenceCount}`)
  console.log(`  Access Requests:    ${accessRequests.length}`)
  console.log(`  Notifications:      ${notifications.length}`)
  console.log(`  Audit Logs:         ${auditCount}`)
  console.log('━'.repeat(60))
}

main()
  .catch(e => {
    console.error('❌ Test data seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
