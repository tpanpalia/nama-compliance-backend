import { PrismaClient, ChecklistCategory, UserRole, UserStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load root env first, then optional env-specific overrides.
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false })
}

const prisma = new PrismaClient()

// ============================================================
// GOVERNORATES — all 11 Oman regions
// ============================================================
const GOVERNORATES = [
  { code: 'MS', nameEn: 'Muscat' },
  { code: 'DH', nameEn: 'Dhofar' },
  { code: 'MU', nameEn: 'Musandam' },
  { code: 'BU', nameEn: 'Al Buraimi' },
  { code: 'DA', nameEn: 'Ad Dakhiliyah' },
  { code: 'NB', nameEn: 'North Al Batinah' },
  { code: 'SB', nameEn: 'South Al Batinah' },
  { code: 'NS', nameEn: 'North Al Sharqiyah' },
  { code: 'SS', nameEn: 'South Al Sharqiyah' },
  { code: 'DZ', nameEn: 'Ad Dhahirah' },
  { code: 'WU', nameEn: 'Al Wusta' },
]

// ============================================================
// CHECKLIST ITEMS — 14 items across 4 categories
// Weights within each category sum to 100.
// Question text is immutable once seeded — deactivate + create new to change.
// ============================================================
const CHECKLIST_ITEMS = [
  // --- HSE & Safety (3 items) ---
  {
    id: 'HSE-001',
    question: "Contractor workers' compliance with wearing PPE",
    category: ChecklistCategory.HSE,
    weight: 4,
    order: 1,
    mandatory: true,
  },
  {
    id: 'HSE-002',
    question: 'Condition of equipment used by the contractor',
    category: ChecklistCategory.HSE,
    weight: 3,
    order: 2,
    mandatory: true,
  },
  {
    id: 'HSE-003',
    question: 'Overall compliance with Nama HSE standards',
    category: ChecklistCategory.HSE,
    weight: 3,
    order: 3,
    mandatory: true,
  },

  // --- Technical Installation (7 items) ---
  {
    id: 'TECH-001',
    question: 'Compliance of excavation works with specified pipe diameter',
    category: ChecklistCategory.TECHNICAL,
    weight: 2,
    order: 1,
    mandatory: true,
  },
  {
    id: 'TECH-002',
    question: 'Installation of warning tape above pipeline',
    category: ChecklistCategory.TECHNICAL,
    weight: 1,
    order: 2,
    mandatory: true,
  },
  {
    id: 'TECH-003',
    question: 'Sand bedding installation',
    category: ChecklistCategory.TECHNICAL,
    weight: 2,
    order: 3,
    mandatory: true,
  },
  {
    id: 'TECH-004',
    question: 'Ground leveling, soil compaction, removal of rocks',
    category: ChecklistCategory.TECHNICAL,
    weight: 1,
    order: 4,
    mandatory: true,
  },
  {
    id: 'TECH-005',
    question: 'Flushing pipeline after installation and before meter',
    category: ChecklistCategory.TECHNICAL,
    weight: 2,
    order: 5,
    mandatory: true,
  },
  {
    id: 'TECH-006',
    question: 'Installation of marker posts',
    category: ChecklistCategory.TECHNICAL,
    weight: 1,
    order: 6,
    mandatory: true,
  },
  {
    id: 'TECH-007',
    question: 'Installation of identification tag',
    category: ChecklistCategory.TECHNICAL,
    weight: 1,
    order: 7,
    mandatory: true,
  },

  // --- Process & Communication (3 items) ---
  {
    id: 'PROC-001',
    question: 'Notification to Nama before, during and after works',
    category: ChecklistCategory.PROCESS,
    weight: 4,
    order: 1,
    mandatory: true,
  },
  {
    id: 'PROC-002',
    question: 'Monthly technical report submission',
    category: ChecklistCategory.PROCESS,
    weight: 3,
    order: 2,
    mandatory: true,
  },
  {
    id: 'PROC-003',
    question: 'Worker list submission',
    category: ChecklistCategory.PROCESS,
    weight: 3,
    order: 3,
    mandatory: true,
  },

  // --- Site Closure (1 item) ---
  {
    id: 'CLOSE-001',
    question: 'Site cleaning and reinstatement',
    category: ChecklistCategory.CLOSURE,
    weight: 10,
    order: 1,
    mandatory: true,
  },
]

// ============================================================
// DEFAULT SCORING WEIGHTS
// HSE 30% | Technical 40% | Process 20% | Closure 10%
// "Reset to Default" recreates a row with these exact values.
// ============================================================
const DEFAULT_SCORING_WEIGHTS = {
  hsePercent: 30,
  technicalPercent: 40,
  processPercent: 20,
  closurePercent: 10,
}

// ============================================================
// SEED
// ============================================================
async function main() {
  console.log('🌱 Starting seed...\n')

  // 1. Governorates
  console.log('📍 Seeding governorates...')
  await prisma.governorate.createMany({
    data: GOVERNORATES,
    skipDuplicates: true,
  })
  console.log(`   ✓ ${GOVERNORATES.length} governorates\n`)

  // 2. Default admin user
  console.log('👤 Seeding default admin user...')
  const passwordHash = await bcrypt.hash('Admin@NWS2026!', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nama.om' },
    update: {},
    create: {
      email: 'admin@nama.om',
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: {
          employeeId: 'EMP-ADMIN-001',
          fullName: 'System Administrator',
          phone: '+968 00000000',
        },
      },
    },
  })
  console.log(`   ✓ Admin user — ${adminUser.email}`)
  console.log(`   ⚠  Change the default admin password immediately after first login\n`)

  // 3. Default scoring weights
  console.log('⚖️  Seeding default scoring weights...')
  const existingWeights = await prisma.scoringWeight.findFirst({
    where: { effectiveTo: null },
  })
  let scoringWeight = existingWeights
  if (!existingWeights) {
    scoringWeight = await prisma.scoringWeight.create({
      data: {
        ...DEFAULT_SCORING_WEIGHTS,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdBy: adminUser.id,
      },
    })
    console.log(`   ✓ HSE ${DEFAULT_SCORING_WEIGHTS.hsePercent}% | Technical ${DEFAULT_SCORING_WEIGHTS.technicalPercent}% | Process ${DEFAULT_SCORING_WEIGHTS.processPercent}% | Closure ${DEFAULT_SCORING_WEIGHTS.closurePercent}%\n`)
  } else {
    console.log(`   — Active scoring weights already exist, skipping\n`)
  }

  // 4. Checklist items
  console.log('📋 Seeding checklist items...')
  await prisma.checklistItem.createMany({
    data: CHECKLIST_ITEMS,
    skipDuplicates: true,
  })
  const hseCount = CHECKLIST_ITEMS.filter(i => i.category === ChecklistCategory.HSE).length
  const techCount = CHECKLIST_ITEMS.filter(i => i.category === ChecklistCategory.TECHNICAL).length
  const procCount = CHECKLIST_ITEMS.filter(i => i.category === ChecklistCategory.PROCESS).length
  const closeCount = CHECKLIST_ITEMS.filter(i => i.category === ChecklistCategory.CLOSURE).length
  console.log(`   ✓ ${CHECKLIST_ITEMS.length} items — HSE: ${hseCount} | Technical: ${techCount} | Process: ${procCount} | Closure: ${closeCount}\n`)

  // 5. Initial checklist version (snapshot of all active items)
  console.log('📸 Seeding initial checklist version...')
  const existingVersion = await prisma.checklistVersion.findFirst({
    orderBy: { versionNumber: 'desc' },
  })
  if (!existingVersion) {
    const snapshot = CHECKLIST_ITEMS.map(item => ({
      id: item.id,
      question: item.question,
      category: item.category,
      weight: item.weight,
      order: item.order,
      mandatory: item.mandatory,
      isActive: true,
    }))
    await prisma.checklistVersion.create({
      data: {
        itemsSnapshot: snapshot,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdBy: adminUser.id,
      },
    })
    console.log(`   ✓ Version 1 created with ${snapshot.length} items\n`)
  } else {
    console.log(`   — Checklist version already exists (v${existingVersion.versionNumber}), skipping\n`)
  }

  console.log('✅ Seed complete\n')
  console.log('━'.repeat(50))
  console.log('Default admin credentials:')
  console.log('  Email   : admin@nama.om')
  console.log('  Password: Admin@NWS2026!')
  console.log('━'.repeat(50))
  console.log('⚠  Change the admin password before going live.\n')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
