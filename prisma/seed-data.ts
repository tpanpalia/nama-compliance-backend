/**
 * Seed script: Creates users + 100 work orders across all statuses with realistic data.
 * Self-contained — only requires seed.ts to have run first (governorates, admin, checklist, weights).
 *
 * Run sequence:
 *   1. npx prisma db push --force-reset
 *   2. npx ts-node prisma/seed.ts
 *   3. npx ts-node prisma/seed-data.ts
 */
import { PrismaClient, WorkOrderStatus, WorkOrderPriority, InspectionStatus, RatingValue, ComplianceRating, ChecklistCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}
function pad4(n: number): string { return String(n).padStart(4, '0') }
function fmtDate(d: Date): string { return d.toISOString().split('T')[0].replace(/-/g, '') }

const SITE_NAMES = [
  'Al Khuwair Phase 2', 'Sur District 5', 'Salalah Gardens', 'Sohar Port Area',
  'Nizwa Heritage District', 'Barka Extension', 'Ibri New Town', 'Rustaq Springs',
  'Al Amerat Heights', 'Seeb Coastal Road', 'Muscat Hills', 'Al Khoud Industrial',
  'Ruwi Business Park', 'Qurum Beach Villas', 'Al Ghubra Extension', 'Wadi Kabir Phase 3',
  'Muttrah Port Zone', 'Bausher Ridge', 'Al Hail North', 'MQ Gardens',
  'Shinas Waterfront', 'Khasab Bay', 'Saham Extension', 'Liwa Development',
  'Bidiya Coastal', 'Jaalan Phase 1', 'Ibra Central', 'Duqm Port Area',
  'Haima Desert Camp', 'Adam Gateway', 'Bahla Heritage', 'Manah Extension',
  'Sumail Valley', 'Bidbid Junction', 'Izki Springs', 'Tanuf Industrial',
  'Al Mudhaibi Phase 2', 'Sinaw Market Area', 'Masirah Island', 'Jalan Bani Bu Ali',
]

const DESCRIPTIONS = [
  'House connection for new residential building',
  'Water pipeline extension to industrial zone',
  'Residential water connection installation',
  'Commercial water supply connection',
  'Pipeline repair and replacement works',
  'New meter installation and connection',
  'Emergency pipeline repair works',
  'Network extension to housing development',
  'Water main connection for school complex',
  'Pipeline upgrade and modernization',
]

const GOV_CODES = ['MS', 'DH', 'MU', 'BU', 'DA', 'NB', 'SB', 'NS', 'SS', 'DZ', 'WU']
const PRIORITIES: WorkOrderPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const RATING_VALUES: RatingValue[] = ['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT']
const RATING_NUMERIC: Record<RatingValue, number> = { COMPLIANT: 1.0, PARTIAL: 0.5, NON_COMPLIANT: 0.0 }

const STATUS_DISTRIBUTION: { status: WorkOrderStatus; count: number }[] = [
  { status: 'UNASSIGNED', count: 8 },
  { status: 'ASSIGNED', count: 10 },
  { status: 'IN_PROGRESS', count: 12 },
  { status: 'SUBMITTED', count: 10 },
  { status: 'PENDING_INSPECTION', count: 10 },
  { status: 'INSPECTION_IN_PROGRESS', count: 8 },
  { status: 'INSPECTION_COMPLETED', count: 35 },
  { status: 'OVERDUE', count: 7 },
]

// ─── User Definitions ───────────────────────────────────────────────────────

const USERS = {
  inspectors: [
    { email: 'inspector1@nama.om', employeeId: 'EMP-INS-001', fullName: 'Fatma Al-Rashidi', phone: '+968 91234001' },
    { email: 'inspector2@nama.om', employeeId: 'EMP-INS-002', fullName: 'Saif Al-Hinai', phone: '+968 91234002' },
    { email: 'inspector3@nama.om', employeeId: 'EMP-INS-003', fullName: 'Ahmed Al-Busaidi', phone: '+968 91234003' },
  ],
  contractors: [
    { email: 'contractor1@nama.om', crNumber: 'CR-1234567', companyName: 'Al Jazeera Water Works LLC', contactName: 'Khalid Al-Farsi', phone: '+968 92345001', regions: ['Muscat', 'North Al Batinah'] },
    { email: 'contractor2@nama.om', crNumber: 'CR-2345678', companyName: 'Oman Pipeline Services SAOC', contactName: 'Sara Al-Lawati', phone: '+968 92345002', regions: ['Muscat', 'Ad Dakhiliyah'] },
    { email: 'contractor3@nama.om', crNumber: 'CR-3456789', companyName: 'Gulf Utilities Contracting', contactName: 'Mohammed Al-Balushi', phone: '+968 92345003', regions: ['Dhofar', 'Al Wusta'] },
    { email: 'contractor4@nama.om', crNumber: 'CR-4567890', companyName: 'National Infra Solutions LLC', contactName: 'Amina Al-Kindi', phone: '+968 92345004', regions: ['South Al Batinah', 'Ad Dhahirah'] },
    { email: 'contractor5@nama.om', crNumber: 'CR-9876543', companyName: 'Hassan Water Engineering', contactName: 'Hassan Al-Harthi', phone: '+968 92345005', regions: ['North Al Sharqiyah', 'South Al Sharqiyah'] },
  ],
  regulators: [
    { email: 'regulator1@nama.om', fullName: 'Mariam Al-Maskari', phone: '+968 93456001', organization: 'EWRA', department: 'Compliance' },
    { email: 'regulator2@nama.om', fullName: 'Yusuf Al-Rawahi', phone: '+968 93456002', organization: 'EWRA', department: 'Oversight' },
  ],
  admins: [
    { email: 'admin2@nama.om', employeeId: 'EMP-ADM-002', fullName: 'Test Admin', phone: '+968 90000002' },
  ],
}

async function main() {
  console.log('🌱 Starting full data seed...\n')

  const passwordHash = await bcrypt.hash('Test@12345', 12)

  // ─── Create Users ─────────────────────────────────────────────────────────

  console.log('👤 Creating users...')

  // Admins
  for (const admin of USERS.admins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        email: admin.email, passwordHash, role: 'ADMIN', status: 'ACTIVE',
        staffProfile: { create: { employeeId: admin.employeeId, fullName: admin.fullName, phone: admin.phone } },
      },
    })
  }
  console.log(`   ✓ ${USERS.admins.length} admins`)

  // Inspectors
  const inspectorUsers: { id: string }[] = []
  for (const ins of USERS.inspectors) {
    const user = await prisma.user.upsert({
      where: { email: ins.email },
      update: {},
      create: {
        email: ins.email, passwordHash, role: 'INSPECTOR', status: 'ACTIVE',
        staffProfile: { create: { employeeId: ins.employeeId, fullName: ins.fullName, phone: ins.phone } },
      },
    })
    inspectorUsers.push({ id: user.id })
  }
  console.log(`   ✓ ${USERS.inspectors.length} inspectors`)

  // Contractors
  const contractorProfiles: { crNumber: string; userId: string }[] = []
  for (const con of USERS.contractors) {
    const user = await prisma.user.upsert({
      where: { email: con.email },
      update: {},
      create: {
        email: con.email, passwordHash, role: 'CONTRACTOR', status: 'ACTIVE',
        contractorProfile: {
          create: {
            crNumber: con.crNumber, companyName: con.companyName, contactName: con.contactName,
            email: con.email, phone: con.phone, regionsOfOperation: con.regions,
          },
        },
      },
    })
    contractorProfiles.push({ crNumber: con.crNumber, userId: user.id })
  }
  console.log(`   ✓ ${USERS.contractors.length} contractors`)

  // Regulators
  for (const reg of USERS.regulators) {
    await prisma.user.upsert({
      where: { email: reg.email },
      update: {},
      create: {
        email: reg.email, passwordHash, role: 'REGULATOR', status: 'ACTIVE',
        regulatorProfile: { create: { fullName: reg.fullName, phone: reg.phone, organization: reg.organization, department: reg.department } },
      },
    })
  }
  console.log(`   ✓ ${USERS.regulators.length} regulators\n`)

  // ─── Load Sample Files (uploaded by upload-sample-images.ts) ──────────────

  console.log('📁 Loading sample evidence files...')
  const sampleFiles = await prisma.file.findMany({
    where: { s3Key: { startsWith: 'sample/' }, uploadStatus: 'UPLOADED' },
    select: { id: true },
  })
  if (sampleFiles.length === 0) {
    console.error('❌ No sample files found. Run: npx ts-node scripts/upload-sample-images.ts first.')
    process.exit(1)
  }
  const fileIds = sampleFiles.map(f => f.id)
  console.log(`   ✓ Found ${fileIds.length} sample files (reusing across all work orders)\n`)

  // ─── Load Prerequisites ───────────────────────────────────────────────────

  const scoringWeight = await prisma.scoringWeight.findFirst({ where: { effectiveTo: null }, select: { id: true } })
  const checklistVersion = await prisma.checklistVersion.findFirst({ where: { effectiveTo: null }, select: { versionNumber: true } })
  const checklistItems = await prisma.checklistItem.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { order: 'asc' }] })

  if (!scoringWeight || !checklistVersion) {
    console.error('❌ Missing scoring weights or checklist version. Run prisma/seed.ts first.')
    process.exit(1)
  }

  // ─── Create Work Orders ───────────────────────────────────────────────────

  let woIndex = 0
  let fileIndex = 0
  const nextFile = () => { const id = fileIds[fileIndex % fileIds.length]; fileIndex++; return id }

  for (const { status, count } of STATUS_DISTRIBUTION) {
    console.log(`📝 Creating ${count} ${status} work orders...`)

    for (let i = 0; i < count; i++) {
      woIndex++
      const allocationDate = randomDate(new Date('2025-01-01'), new Date('2026-03-15'))
      const targetDate = new Date(allocationDate.getTime() + (30 + Math.random() * 60) * 24 * 60 * 60 * 1000)
      const woId = `WO-${fmtDate(allocationDate)}-${pad4(woIndex)}`
      const contractor = pick(contractorProfiles)
      const inspector = pick(inspectorUsers)
      const govCode = pick(GOV_CODES)
      const priority = pick(PRIORITIES)
      const siteName = pick(SITE_NAMES)
      const description = pick(DESCRIPTIONS)

      const needsContractor = status !== 'UNASSIGNED'
      const needsInspector = ['PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETED'].includes(status)
      const needsInspection = ['PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETED'].includes(status)
      const needsContractorEvidence = ['SUBMITTED', 'PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETED', 'OVERDUE'].includes(status)
      const needsInspectorEvidence = status === 'INSPECTION_COMPLETED'
      const needsResponses = ['INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETED'].includes(status)
      const submissionDate = needsContractorEvidence ? randomDate(allocationDate, targetDate) : null

      // Calculate inspection deadline from submission date (same rules as backend)
      let inspectionDeadline: Date | null = null
      if (submissionDate) {
        const day = submissionDate.getDate()
        if (day <= 25) {
          inspectionDeadline = new Date(submissionDate.getFullYear(), submissionDate.getMonth() + 1, 0)
        } else {
          const lastDay = new Date(submissionDate.getFullYear(), submissionDate.getMonth() + 1, 0)
          inspectionDeadline = new Date(lastDay.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
        // For OVERDUE WOs: force deadline to be in the past
        if (status === 'OVERDUE') {
          inspectionDeadline = new Date(submissionDate.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days after submission (guaranteed past)
        }
      }

      await prisma.workOrder.create({
        data: {
          id: woId,
          governorateCode: govCode,
          siteName,
          description,
          priority,
          workType: 'HOUSE_CONNECTIONS',
          status,
          allocationDate,
          targetCompletionDate: targetDate,
          scoringWeightsId: scoringWeight.id,
          contractorCr: needsContractor ? contractor.crNumber : null,
          assignedInspectorId: needsInspector ? inspector.id : null,
          submissionDate,
          inspectionDeadline,
        },
      })

      // Contractor evidence
      if (needsContractorEvidence) {
        const evidenceItems = pickN(checklistItems, Math.min(checklistItems.length, 8 + Math.floor(Math.random() * 7)))
        for (const item of evidenceItems) {
          await prisma.evidence.create({
            data: {
              workOrderId: woId,
              checklistItemId: item.id,
              uploadedBy: contractor.userId,
              uploadedByRole: 'CONTRACTOR',
              fileId: nextFile(),
              gpsLat: 23.58 + (Math.random() * 0.2),
              gpsLng: 58.38 + (Math.random() * 0.2),
              gpsAddress: `${siteName}, ${GOV_CODES.indexOf(govCode) + 1} Block, Oman`,
              comment: Math.random() > 0.5 ? 'Work completed as per specification' : undefined,
              capturedAt: submissionDate ?? new Date(),
            },
          })
        }
      }

      // Inspection
      if (needsInspection) {
        const inspectionStatus: InspectionStatus =
          status === 'PENDING_INSPECTION' ? 'PENDING' :
          status === 'INSPECTION_IN_PROGRESS' ? 'IN_PROGRESS' : 'SUBMITTED'

        const responses: { itemId: string; rating: RatingValue; category: ChecklistCategory; weight: number }[] = []
        if (needsResponses) {
          for (const item of checklistItems) {
            const rand = Math.random()
            let rating: RatingValue
            if (status === 'INSPECTION_COMPLETED') {
              rating = rand < 0.6 ? 'COMPLIANT' : rand < 0.85 ? 'PARTIAL' : 'NON_COMPLIANT'
            } else {
              rating = rand < 0.4 ? 'COMPLIANT' : rand < 0.7 ? 'PARTIAL' : 'NON_COMPLIANT'
            }
            responses.push({ itemId: item.id, rating, category: item.category, weight: item.weight })
          }
        }

        let hseScore = 0, technicalScore = 0, processScore = 0, closureScore = 0, finalScore = 0
        let complianceRating: ComplianceRating = 'POOR'

        if (status === 'INSPECTION_COMPLETED') {
          const calcCategoryScore = (cat: ChecklistCategory) => {
            const items = responses.filter(r => r.category === cat)
            if (items.length === 0) return 0
            const totalWeight = items.reduce((s, r) => s + r.weight, 0)
            const weightedSum = items.reduce((s, r) => s + RATING_NUMERIC[r.rating] * r.weight, 0)
            return Math.round((weightedSum / totalWeight) * 1000) / 10
          }

          hseScore = calcCategoryScore('HSE')
          technicalScore = calcCategoryScore('TECHNICAL')
          processScore = calcCategoryScore('PROCESS')
          closureScore = calcCategoryScore('CLOSURE')
          finalScore = Math.round((hseScore * 30 + technicalScore * 40 + processScore * 20 + closureScore * 10) / 100 * 10) / 10
          complianceRating = finalScore >= 90 ? 'EXCELLENT' : finalScore >= 80 ? 'GOOD' : finalScore >= 70 ? 'FAIR' : 'POOR'
        }

        const inspectionSubmittedAt = status === 'INSPECTION_COMPLETED'
          ? randomDate(submissionDate ?? allocationDate, new Date('2026-03-31'))
          : null

        const inspection = await prisma.inspection.create({
          data: {
            workOrderId: woId,
            checklistVersionId: checklistVersion.versionNumber,
            status: inspectionStatus,
            ...(status === 'INSPECTION_COMPLETED' ? {
              hseScore, technicalScore, processScore, closureScore, finalScore,
              complianceRating,
              submittedAt: inspectionSubmittedAt,
            } : {}),
          },
        })

        if (needsResponses) {
          for (const resp of responses) {
            const item = checklistItems.find(c => c.id === resp.itemId)!
            await prisma.inspectionResponse.create({
              data: {
                inspectionId: inspection.id,
                checklistItemId: resp.itemId,
                questionSnapshot: item.question,
                rating: resp.rating,
                inspectorComments: Math.random() > 0.4
                  ? pick(['Good work', 'Needs improvement', 'Meets standards', 'Minor issues noted', 'Well maintained', 'Below expectations', 'Acceptable quality'])
                  : null,
              },
            })
          }
        }

        if (needsInspectorEvidence) {
          const evidenceItems = pickN(checklistItems, 5 + Math.floor(Math.random() * 5))
          for (const item of evidenceItems) {
            await prisma.evidence.create({
              data: {
                workOrderId: woId,
                inspectionId: inspection.id,
                checklistItemId: item.id,
                uploadedBy: inspector.id,
                uploadedByRole: 'INSPECTOR',
                fileId: nextFile(),
                gpsLat: 23.58 + (Math.random() * 0.2),
                gpsLng: 58.38 + (Math.random() * 0.2),
                gpsAddress: `Inspection at ${siteName}`,
                comment: Math.random() > 0.5 ? 'Verified on site' : undefined,
                capturedAt: inspectionSubmittedAt ?? new Date(),
              },
            })
          }
        }
      }
    }
    console.log(`   ✓ ${count} ${status} work orders created`)
  }

  // Summary
  const totalWOs = await prisma.workOrder.count()
  const totalInspections = await prisma.inspection.count()
  const totalResponses = await prisma.inspectionResponse.count()
  const totalEvidence = await prisma.evidence.count()
  const totalUsers = await prisma.user.count()

  console.log('\n✅ Seed complete!')
  console.log(`   Users:        ${totalUsers}`)
  console.log(`   Work Orders:  ${totalWOs}`)
  console.log(`   Inspections:  ${totalInspections}`)
  console.log(`   Responses:    ${totalResponses}`)
  console.log(`   Evidence:     ${totalEvidence}`)
  console.log('\n📋 Credentials (all except admin@nama.om):')
  console.log('   Password: Test@12345')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
