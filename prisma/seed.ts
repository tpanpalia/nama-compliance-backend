import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const sectionsSeed = [
  {
    name: 'HSE & Safety',
    description: 'Worker safety, PPE compliance, equipment condition',
    weight: 0.3,
    defaultWeight: 0.3,
    order: 1,
    items: [
      'Contractor workers compliance with wearing PPE',
      'Condition of equipment used by the contractor',
      'Overall compliance with NAMA HSE standards',
      'Safety signage and barriers properly placed',
      'First aid kit present and accessible',
    ],
  },
  {
    name: 'Technical Installation',
    description: 'Excavation, pipeline installation, technical compliance',
    weight: 0.4,
    defaultWeight: 0.4,
    order: 2,
    items: [
      'Excavation depth and width within specification',
      'Pipeline bedding material meets standards',
      'Joint connections properly sealed',
      'Pressure testing completed and documented',
    ],
  },
  {
    name: 'Process & Communication',
    description: 'Notifications, reports, documentation',
    weight: 0.2,
    defaultWeight: 0.2,
    order: 3,
    items: [
      'Work permit obtained and displayed',
      'Residents and stakeholders notified',
      'Daily progress report submitted',
    ],
  },
  {
    name: 'Site Closure',
    description: 'Site cleaning and reinstatement',
    weight: 0.1,
    defaultWeight: 0.1,
    order: 4,
    items: ['Site fully cleaned and debris removed', 'Road and surface reinstated to original condition'],
  },
];

const contractorsData = [
  {
    contractorId: 'C-00001',
    companyName: 'Al Noor Construction',
    tradeLicense: 'TL-2023-001',
    crNumber: 'CR-2024-001',
    contactName: 'Mohammed Al-Rashdi',
    email: 'info@alnoor.om',
    phone: '+968 2456 7890',
    address: 'Muscat Business District',
  },
  {
    contractorId: 'C-00002',
    companyName: 'Gulf Infrastructure Ltd',
    tradeLicense: 'TL-2023-002',
    crNumber: 'CR-2024-002',
    contactName: 'Fatima Al-Balushi',
    email: 'contact@gulfinfra.om',
    phone: '+968 2456 7891',
    address: 'Sohar Industrial Zone',
  },
  {
    contractorId: 'C-00003',
    companyName: 'United Engineering Co',
    tradeLicense: 'TL-2023-003',
    crNumber: 'CR-2024-003',
    contactName: 'Hassan Al-Lawati',
    email: 'info@unitedeng.om',
    phone: '+968 2456 7892',
    address: 'Salalah Business Center',
  },
  {
    contractorId: 'C-00004',
    companyName: 'Mountain Services LLC',
    tradeLicense: 'TL-2023-004',
    crNumber: 'CR-2024-004',
    contactName: 'Aisha Al-Mahrouqi',
    email: 'services@mountainllc.om',
    phone: '+968 2456 7893',
    address: 'Nizwa, Ad Dakhiliyah',
  },
  {
    contractorId: 'C-00005',
    companyName: 'Coastal Engineering Group',
    tradeLicense: 'TL-2023-005',
    crNumber: 'CR-2024-005',
    contactName: 'Layla Al-Harthy',
    email: 'info@coastaleng.om',
    phone: '+968 2456 7894',
    address: 'Sur, Ash Sharqiyah',
  },
  {
    contractorId: 'C-00006',
    companyName: 'Desert Pipeline Solutions',
    tradeLicense: 'TL-2023-006',
    crNumber: 'CR-2024-006',
    contactName: 'Youssef Al-Kindi',
    email: 'contact@desertpipe.om',
    phone: '+968 2456 7895',
    address: 'Adam, Ad Dakhiliyah',
  },
];

const dAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

function complianceBand(score: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
}

function ratingForScore(score: number, idx: number): 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' {
  const bucket = (idx * 17) % 100;
  if (score >= 92) return bucket < 90 ? 'COMPLIANT' : 'PARTIAL';
  if (score >= 85) return bucket < 75 ? 'COMPLIANT' : bucket < 95 ? 'PARTIAL' : 'NON_COMPLIANT';
  if (score >= 75) return bucket < 55 ? 'COMPLIANT' : bucket < 90 ? 'PARTIAL' : 'NON_COMPLIANT';
  return bucket < 35 ? 'COMPLIANT' : bucket < 80 ? 'PARTIAL' : 'NON_COMPLIANT';
}

async function ensureSite(name: string, location: string, region: string, latitude: number, longitude: number) {
  const existing = await prisma.site.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.site.create({ data: { name, location, region, latitude, longitude } });
}

async function seedApprovedWorkOrder(params: {
  reference: string;
  title: string;
  score: number;
  daysAgo: number;
  contractorId: string;
  siteId: string;
  adminId: string;
  inspectorId: string;
  itemIds: string[];
}) {
  const approvedAt = dAgo(params.daysAgo);
  const submittedAt = dAgo(params.daysAgo + 1);
  const startedAt = dAgo(params.daysAgo + 2);
  const createdAt = dAgo(params.daysAgo + 3);

  const wo = await prisma.workOrder.upsert({
    where: { reference: params.reference },
    update: {
      title: params.title,
      status: 'APPROVED',
      priority: 'MEDIUM',
      siteId: params.siteId,
      contractorId: params.contractorId,
      inspectorId: params.inspectorId,
      createdById: params.adminId,
      approvedById: params.adminId,
      overallScore: params.score,
      complianceBand: complianceBand(params.score),
      isLocked: true,
      startedAt,
      submittedAt,
      approvedAt,
      createdAt,
    },
    create: {
      reference: params.reference,
      title: params.title,
      status: 'APPROVED',
      priority: 'MEDIUM',
      siteId: params.siteId,
      contractorId: params.contractorId,
      inspectorId: params.inspectorId,
      createdById: params.adminId,
      approvedById: params.adminId,
      overallScore: params.score,
      complianceBand: complianceBand(params.score),
      isLocked: true,
      startedAt,
      submittedAt,
      approvedAt,
      createdAt,
    },
  });

  const checklist = await prisma.workOrderChecklist.upsert({
    where: { workOrderId: wo.id },
    update: {
      isSubmitted: true,
      submittedAt,
      lastSavedAt: submittedAt,
    },
    create: {
      workOrderId: wo.id,
      isSubmitted: true,
      submittedAt,
      lastSavedAt: submittedAt,
    },
  });

  for (let i = 0; i < params.itemIds.length; i += 1) {
    const itemId = params.itemIds[i];
    await prisma.checklistResponse.upsert({
      where: {
        checklistId_itemId: {
          checklistId: checklist.id,
          itemId,
        },
      },
      update: {
        rating: ratingForScore(params.score, i),
      },
      create: {
        checklistId: checklist.id,
        itemId,
        rating: ratingForScore(params.score, i),
      },
    });
  }
}

async function seedInProgressWorkOrder(params: {
  reference: string;
  title: string;
  daysAgo: number;
  contractorId: string;
  siteId: string;
  adminId: string;
  inspectorId: string;
}) {
  const startedAt = dAgo(params.daysAgo);
  const createdAt = dAgo(params.daysAgo + 1);

  await prisma.workOrder.upsert({
    where: { reference: params.reference },
    update: {
      title: params.title,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      siteId: params.siteId,
      contractorId: params.contractorId,
      inspectorId: params.inspectorId,
      createdById: params.adminId,
      approvedById: null,
      overallScore: null,
      complianceBand: null,
      isLocked: false,
      startedAt,
      submittedAt: null,
      approvedAt: null,
      createdAt,
    },
    create: {
      reference: params.reference,
      title: params.title,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      siteId: params.siteId,
      contractorId: params.contractorId,
      inspectorId: params.inspectorId,
      createdById: params.adminId,
      startedAt,
      createdAt,
    },
  });
}

async function main(): Promise<void> {
  const hash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nama.om' },
    update: {
      password: hash,
      displayName: 'Ahmed Al-Busaidi',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@nama.om',
      password: hash,
      displayName: 'Ahmed Al-Busaidi',
      role: UserRole.ADMIN,
    },
  });

  const inspector = await prisma.user.upsert({
    where: { email: 'inspector@nama.om' },
    update: {
      password: hash,
      displayName: 'Mohammed Al-Balushi',
      role: UserRole.INSPECTOR,
      isActive: true,
    },
    create: {
      email: 'inspector@nama.om',
      password: hash,
      displayName: 'Mohammed Al-Balushi',
      role: UserRole.INSPECTOR,
    },
  });

  await prisma.regulator.upsert({
    where: { email: 'regulator@apsr.om' },
    update: {},
    create: {
      email: 'regulator@apsr.om',
      password: hash,
      displayName: 'APSR Regulator',
      organisation: 'APSR',
      department: 'Water Services Regulation',
    },
  });

  const sites = await Promise.all([
    ensureSite('Al Khoud Extension', 'Muscat, Oman', 'Muscat', 23.5957, 58.1697),
    ensureSite('Sohar Port Connection', 'Sohar, Oman', 'Al Batinah North', 24.3452, 56.7091),
    ensureSite('Barka Pipeline Ext', 'Barka, Oman', 'Al Batinah South', 23.7042, 57.8861),
    ensureSite('Muscat Industrial Zone', 'Muscat, Oman', 'Muscat', 23.6002, 58.2202),
    ensureSite('Seeb Commercial Area', 'Seeb, Oman', 'Muscat', 23.6744, 58.1656),
    ensureSite('Al Hail North Pipeline', 'Al Hail, Oman', 'Muscat', 23.6431, 58.2058),
    ensureSite('Ruwi District Install', 'Ruwi, Oman', 'Muscat', 23.6009, 58.5457),
    ensureSite('Qurum Heights Project', 'Qurum, Oman', 'Muscat', 23.6143, 58.4892),
  ]);

  await prisma.checklistResponse.deleteMany({});
  await prisma.workOrderChecklist.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.accessRequestDocument.deleteMany({});
  await prisma.accessRequest.updateMany({ data: { contractorId: null } });
  await prisma.contractor.deleteMany({});

  await prisma.checklistTemplate.deleteMany({ where: { name: 'Standard Compliance Inspection' } });

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Standard Compliance Inspection',
      description: 'Default template for water services compliance inspections',
      sections: {
        create: sectionsSeed.map((section) => ({
          name: section.name,
          description: section.description,
          weight: section.weight,
          defaultWeight: section.defaultWeight,
          order: section.order,
          items: {
            create: section.items.map((text, idx) => ({
              text,
              isRequired: true,
              weight: 10,
              order: idx + 1,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { items: true } } },
  });

  for (const c of contractorsData) {
    await prisma.contractor.upsert({
      where: { email: c.email },
      update: {
        companyName: c.companyName,
        tradeLicense: c.tradeLicense,
        crNumber: c.crNumber,
        contactName: c.contactName,
        phone: c.phone,
        address: c.address,
        password: hash,
        isActive: true,
      },
      create: {
        ...c,
        password: hash,
      },
    });
  }

  const contractors = await prisma.contractor.findMany({ orderBy: { contractorId: 'asc' } });
  const contractorMap = new Map(contractors.map((c) => [c.contractorId, c.id]));
  const siteByName = new Map(sites.map((s) => [s.name, s.id]));
  const allItems = template.sections.flatMap((section) => section.items).sort((a, b) => a.order - b.order);
  const itemIds = allItems.map((item) => item.id);

  const alNoorWorkOrders = [
    { reference: 'WD-20260109-0045', score: 87, site: 'Al Khoud Extension', daysAgo: 3 },
    { reference: 'WD-20260106-0038', score: 95, site: 'Sohar Port Connection', daysAgo: 20 },
    { reference: 'WD-20260103-0029', score: 92, site: 'Barka Pipeline Ext', daysAgo: 45 },
    { reference: 'WD-20251228-0021', score: 88, site: 'Muscat Industrial Zone', daysAgo: 70 },
    { reference: 'WD-20251224-0015', score: 91, site: 'Seeb Commercial Area', daysAgo: 95 },
    { reference: 'WD-20251220-0009', score: 94, site: 'Al Hail North Pipeline', daysAgo: 120 },
    { reference: 'WD-20251215-0003', score: 89, site: 'Ruwi District Install', daysAgo: 145 },
    { reference: 'WD-20251210-0001', score: 86, site: 'Qurum Heights Project', daysAgo: 170 },
  ];

  for (const woData of alNoorWorkOrders) {
    await seedApprovedWorkOrder({
      reference: woData.reference,
      title: `${woData.site} Inspection`,
      score: woData.score,
      daysAgo: woData.daysAgo,
      contractorId: contractorMap.get('C-00001')!,
      siteId: siteByName.get(woData.site)!,
      adminId: admin.id,
      inspectorId: inspector.id,
      itemIds,
    });
  }

  const otherApproved: Array<{
    contractorCode: string;
    score: number;
    daysAgo: number;
    reference: string;
    siteName: string;
  }> = [
    { contractorCode: 'C-00002', score: 74, daysAgo: 12, reference: 'WD-20260216-0101', siteName: 'Sohar Port Connection' },
    { contractorCode: 'C-00002', score: 73, daysAgo: 54, reference: 'WD-20260105-0098', siteName: 'Barka Pipeline Ext' },
    { contractorCode: 'C-00002', score: 75, daysAgo: 88, reference: 'WD-20251202-0092', siteName: 'Muscat Industrial Zone' },
    { contractorCode: 'C-00003', score: 80, daysAgo: 18, reference: 'WD-20260210-0110', siteName: 'Al Khoud Extension' },
    { contractorCode: 'C-00003', score: 81, daysAgo: 44, reference: 'WD-20260115-0108', siteName: 'Qurum Heights Project' },
    { contractorCode: 'C-00003', score: 82, daysAgo: 79, reference: 'WD-20251211-0106', siteName: 'Ruwi District Install' },
    { contractorCode: 'C-00003', score: 79, daysAgo: 110, reference: 'WD-20251110-0104', siteName: 'Seeb Commercial Area' },
    { contractorCode: 'C-00004', score: 67, daysAgo: 26, reference: 'WD-20260202-0120', siteName: 'Barka Pipeline Ext' },
    { contractorCode: 'C-00004', score: 69, daysAgo: 67, reference: 'WD-20251223-0119', siteName: 'Muscat Industrial Zone' },
    { contractorCode: 'C-00005', score: 84, daysAgo: 16, reference: 'WD-20260214-0130', siteName: 'Al Hail North Pipeline' },
    { contractorCode: 'C-00005', score: 85, daysAgo: 61, reference: 'WD-20251229-0128', siteName: 'Seeb Commercial Area' },
    { contractorCode: 'C-00005', score: 86, daysAgo: 103, reference: 'WD-20251117-0125', siteName: 'Ruwi District Install' },
    { contractorCode: 'C-00006', score: 78, daysAgo: 205, reference: 'WD-20250808-0201', siteName: 'Sohar Port Connection' },
    { contractorCode: 'C-00006', score: 79, daysAgo: 230, reference: 'WD-20250714-0200', siteName: 'Qurum Heights Project' },
  ];

  for (const wo of otherApproved) {
    await seedApprovedWorkOrder({
      reference: wo.reference,
      title: `${wo.siteName} Inspection`,
      score: wo.score,
      daysAgo: wo.daysAgo,
      contractorId: contractorMap.get(wo.contractorCode)!,
      siteId: siteByName.get(wo.siteName)!,
      adminId: admin.id,
      inspectorId: inspector.id,
      itemIds,
    });
  }

  const desertInProgress = [
    { reference: 'WD-20260220-0301', siteName: 'Al Khoud Extension', daysAgo: 2 },
    { reference: 'WD-20260218-0302', siteName: 'Sohar Port Connection', daysAgo: 4 },
    { reference: 'WD-20260216-0303', siteName: 'Barka Pipeline Ext', daysAgo: 6 },
    { reference: 'WD-20260214-0304', siteName: 'Muscat Industrial Zone', daysAgo: 8 },
    { reference: 'WD-20260212-0305', siteName: 'Seeb Commercial Area', daysAgo: 10 },
    { reference: 'WD-20260210-0306', siteName: 'Al Hail North Pipeline', daysAgo: 12 },
  ];

  for (const wo of desertInProgress) {
    await seedInProgressWorkOrder({
      reference: wo.reference,
      title: `${wo.siteName} Ongoing Inspection`,
      daysAgo: wo.daysAgo,
      contractorId: contractorMap.get('C-00006')!,
      siteId: siteByName.get(wo.siteName)!,
      adminId: admin.id,
      inspectorId: inspector.id,
    });
  }

  console.log('Contractor seed data complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
