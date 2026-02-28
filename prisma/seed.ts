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

const dateAt = (dateStr: string) => new Date(dateStr);

async function ensureSite(name: string, address: string, idx: number) {
  const existing = await prisma.site.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.site.create({
    data: {
      name,
      location: address,
      latitude: 23.5 + idx * 0.01,
      longitude: 58.1 + idx * 0.01,
      region: address.split(',')[0] || 'Oman',
      isActive: true,
    },
  });
}

async function main(): Promise<void> {
  const hash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nama.om' },
    update: { displayName: 'Ahmed Al-Busaidi', password: hash, role: UserRole.ADMIN, isActive: true },
    create: {
      email: 'admin@nama.om',
      password: hash,
      displayName: 'Ahmed Al-Busaidi',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const inspectorUsers = [
    { email: 'ahmed.rashid@nama.om', displayName: 'Ahmed Al-Rashid', role: UserRole.INSPECTOR },
    { email: 'fatima.balushi@nama.om', displayName: 'Fatima Al-Balushi', role: UserRole.INSPECTOR },
    { email: 'sara.hinai@nama.om', displayName: 'Sara Al-Hinai', role: UserRole.INSPECTOR },
    { email: 'khalid.hinai@nama.om', displayName: 'Khalid Al-Hinai', role: UserRole.INSPECTOR },
  ];

  const inspectors: Record<string, any> = {};
  for (const u of inspectorUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.displayName, isActive: true, password: hash },
      create: { ...u, password: hash, isActive: true },
    });
    inspectors[u.displayName] = user;
  }

  await prisma.regulator.upsert({
    where: { email: 'regulator@apsr.om' },
    update: {},
    create: {
      email: 'regulator@apsr.om',
      password: hash,
      displayName: 'APSR Regulator',
      organisation: 'APSR',
      department: 'Water Services Regulation',
      isActive: true,
    },
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
      create: { ...c, password: hash, isActive: true },
    });
  }

  const sitesData = [
    { name: 'Mutrah Corniche Extension', address: 'Muscat, Mutrah' },
    { name: 'Azaiba Residential Area', address: 'Muscat, Azaiba' },
    { name: 'Ibri Commercial Zone', address: 'Ad Dhahirah, Ibri' },
    { name: 'Sohar Industrial Area', address: 'Al Batinah, Sohar' },
    { name: 'Al Khoud Extension', address: 'Muscat, Al Khoud' },
    { name: 'Seeb Industrial Area', address: 'Muscat, Seeb' },
    { name: 'Barka Pipeline', address: 'Al Batinah, Barka' },
    { name: 'Sohar Port Connection', address: 'Al Batinah, Sohar' },
    { name: 'Sur Coastal Project', address: 'Ash Sharqiyah, Sur' },
    { name: 'Nizwa Infrastructure', address: 'Ad Dakhiliyah, Nizwa' },
    { name: 'Adam Pipeline Ext', address: 'Ad Dakhiliyah, Adam' },
    { name: 'Muscat Business District', address: 'Muscat' },
    { name: 'Salalah Commercial Zone', address: 'Dhofar, Salalah' },
    { name: 'Ruwi District Installation', address: 'Muscat, Ruwi' },
  ];

  const sites: Record<string, any> = {};
  for (let i = 0; i < sitesData.length; i += 1) {
    const s = sitesData[i];
    const site = await ensureSite(s.name, s.address, i);
    sites[s.name] = site;
  }

  await prisma.auditLog.deleteMany();
  await prisma.checklistResponse.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.workOrder.deleteMany();
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
            create: section.items.map((text, index) => ({
              text,
              isRequired: true,
              weight: 10,
              order: index + 1,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { items: true } } },
  });

  const contractors: Record<string, any> = {};
  const contractorList = await prisma.contractor.findMany();
  for (const c of contractorList) contractors[c.companyName] = c;

  const now = new Date();
  const submittedRecent = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const submittedRecent2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const submittedOld = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const workOrdersData = [
    {
      reference: 'WO-20260112-0055',
      title: 'Mutrah Corniche Extension Inspection',
      status: 'PENDING',
      siteKey: 'Mutrah Corniche Extension',
      contractor: null,
      inspector: null,
      createdAt: dateAt('2026-01-12'),
      updatedAt: dateAt('2026-01-12'),
    },
    {
      reference: 'WO-20260111-0052',
      title: 'Azaiba Residential Area Inspection',
      status: 'PENDING',
      siteKey: 'Azaiba Residential Area',
      contractor: null,
      inspector: null,
      createdAt: dateAt('2026-01-11'),
      updatedAt: dateAt('2026-01-11'),
    },
    {
      reference: 'WO-20260110-0048',
      title: 'Ibri Commercial Zone Inspection',
      status: 'ASSIGNED',
      siteKey: 'Ibri Commercial Zone',
      contractor: 'Desert Pipeline Solutions',
      inspector: null,
      createdAt: dateAt('2026-01-10'),
      updatedAt: dateAt('2026-01-10'),
    },
    {
      reference: 'WO-20260109-0045',
      title: 'Sohar Industrial Area Inspection',
      status: 'IN_PROGRESS',
      siteKey: 'Sohar Industrial Area',
      contractor: 'Gulf Infrastructure Ltd',
      inspector: 'Sara Al-Hinai',
      startedAt: dateAt('2026-01-13'),
      createdAt: dateAt('2026-01-09'),
      updatedAt: dateAt('2026-01-14'),
    },
    {
      reference: 'WO-20260109-0044',
      title: 'Al Khoud Extension Inspection',
      status: 'APPROVED',
      siteKey: 'Al Khoud Extension',
      contractor: 'Al Noor Construction',
      inspector: 'Ahmed Al-Rashid',
      overallScore: 87,
      complianceBand: 'GOOD',
      startedAt: dateAt('2026-01-07'),
      submittedAt: dateAt('2026-01-09'),
      approvedAt: dateAt('2026-01-09'),
      isLocked: true,
      createdAt: dateAt('2026-01-09'),
      updatedAt: dateAt('2026-01-09'),
    },
    {
      reference: 'WO-20260108-0042',
      title: 'Seeb Industrial Area Inspection',
      status: 'SUBMITTED',
      siteKey: 'Seeb Industrial Area',
      contractor: 'Gulf Infrastructure Ltd',
      inspector: 'Fatima Al-Balushi',
      startedAt: dateAt('2026-01-06'),
      submittedAt: submittedRecent,
      createdAt: dateAt('2026-01-08'),
      updatedAt: dateAt('2026-01-08'),
    },
    {
      reference: 'WO-20260107-0038',
      title: 'Barka Pipeline Inspection',
      status: 'APPROVED',
      siteKey: 'Barka Pipeline',
      contractor: 'United Engineering Co',
      inspector: 'Ahmed Al-Rashid',
      overallScore: 92,
      complianceBand: 'EXCELLENT',
      startedAt: dateAt('2026-01-05'),
      submittedAt: dateAt('2026-01-07'),
      approvedAt: dateAt('2026-01-07'),
      isLocked: true,
      createdAt: dateAt('2026-01-07'),
      updatedAt: dateAt('2026-01-07'),
    },
    {
      reference: 'WO-20260106-0035',
      title: 'Sohar Port Connection Inspection',
      status: 'APPROVED',
      siteKey: 'Sohar Port Connection',
      contractor: 'Al Noor Construction',
      inspector: 'Fatima Al-Balushi',
      overallScore: 95,
      complianceBand: 'EXCELLENT',
      startedAt: dateAt('2026-01-04'),
      submittedAt: dateAt('2026-01-06'),
      approvedAt: dateAt('2026-01-06'),
      isLocked: true,
      createdAt: dateAt('2026-01-06'),
      updatedAt: dateAt('2026-01-06'),
    },
    {
      reference: 'WO-20260105-0031',
      title: 'Sur Coastal Project Inspection',
      status: 'IN_PROGRESS',
      siteKey: 'Sur Coastal Project',
      contractor: 'Coastal Engineering Group',
      inspector: 'Khalid Al-Hinai',
      startedAt: dateAt('2026-01-04'),
      createdAt: dateAt('2026-01-05'),
      updatedAt: dateAt('2026-01-05'),
    },
    {
      reference: 'WO-20260104-0029',
      title: 'Nizwa Infrastructure Inspection',
      status: 'SUBMITTED',
      siteKey: 'Nizwa Infrastructure',
      contractor: 'Mountain Services LLC',
      inspector: 'Ahmed Al-Rashid',
      startedAt: dateAt('2026-01-02'),
      submittedAt: submittedOld,
      createdAt: dateAt('2026-01-04'),
      updatedAt: dateAt('2026-01-04'),
    },
    {
      reference: 'WO-20260103-0025',
      title: 'Adam Pipeline Extension Inspection',
      status: 'SUBMITTED',
      siteKey: 'Adam Pipeline Ext',
      contractor: 'Desert Pipeline Solutions',
      inspector: 'Fatima Al-Balushi',
      startedAt: dateAt('2026-01-01'),
      submittedAt: submittedRecent2,
      createdAt: dateAt('2026-01-03'),
      updatedAt: dateAt('2026-01-03'),
    },
    {
      reference: 'WO-20260102-0021',
      title: 'Muscat Business District Inspection',
      status: 'IN_PROGRESS',
      siteKey: 'Muscat Business District',
      contractor: 'Gulf Infrastructure Ltd',
      inspector: 'Khalid Al-Hinai',
      startedAt: dateAt('2026-01-01'),
      createdAt: dateAt('2026-01-02'),
      updatedAt: dateAt('2026-01-02'),
    },
    {
      reference: 'WO-20260101-0018',
      title: 'Salalah Commercial Zone Inspection',
      status: 'IN_PROGRESS',
      siteKey: 'Salalah Commercial Zone',
      contractor: 'Coastal Engineering Group',
      inspector: 'Ahmed Al-Rashid',
      startedAt: dateAt('2025-12-31'),
      createdAt: dateAt('2026-01-01'),
      updatedAt: dateAt('2026-01-01'),
    },
    {
      reference: 'WO-20251230-0015',
      title: 'Ruwi District Installation Inspection',
      status: 'APPROVED',
      siteKey: 'Ruwi District Installation',
      contractor: 'United Engineering Co',
      inspector: 'Fatima Al-Balushi',
      overallScore: 89,
      complianceBand: 'GOOD',
      startedAt: dateAt('2025-12-28'),
      submittedAt: dateAt('2025-12-30'),
      approvedAt: dateAt('2025-12-30'),
      isLocked: true,
      createdAt: dateAt('2025-12-30'),
      updatedAt: dateAt('2025-12-30'),
    },
  ];

  const createdByRef: Record<string, any> = {};
  for (const woData of workOrdersData) {
    const { siteKey, contractor: contractorName, inspector: inspectorName, ...data } = woData as any;
    const created = await prisma.workOrder.create({
      data: {
        reference: data.reference,
        title: data.title,
        status: data.status as any,
        priority: 'MEDIUM',
        siteId: sites[siteKey].id,
        contractorId: contractorName ? contractors[contractorName]?.id : null,
        inspectorId: inspectorName ? inspectors[inspectorName]?.id : null,
        createdById: admin.id,
        approvedById: data.status === 'APPROVED' ? admin.id : null,
        overallScore: data.overallScore || null,
        complianceBand: data.complianceBand || null,
        isLocked: data.isLocked || false,
        startedAt: data.startedAt || null,
        submittedAt: data.submittedAt || null,
        approvedAt: data.approvedAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    createdByRef[created.reference] = created;
  }

  const wo0044 = createdByRef['WO-20260109-0044'];
  if (wo0044) {
    const checklist = await prisma.workOrderChecklist.create({
      data: {
        workOrderId: wo0044.id,
        isSubmitted: true,
        submittedAt: wo0044.submittedAt || new Date(),
        lastSavedAt: wo0044.submittedAt || new Date(),
      },
    });

    const items = template.sections
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => s.items.sort((a, b) => a.order - b.order));

    for (let i = 0; i < items.length; i += 1) {
      await prisma.checklistResponse.create({
        data: {
          checklistId: checklist.id,
          itemId: items[i].id,
          rating: i % 6 === 0 ? 'PARTIAL' : 'COMPLIANT',
          comment: i % 6 === 0 ? 'Minor deviation corrected on site' : null,
        },
      });
    }

    await prisma.evidence.create({
      data: {
        workOrderId: wo0044.id,
        type: 'PHOTO',
        source: 'INSPECTOR',
        s3Key: `local/${wo0044.reference}/evidence-1.jpg`,
        s3Bucket: 'local-dev',
        fileName: 'inspection-photo-1.jpg',
        fileSize: 120000,
        mimeType: 'image/jpeg',
        latitude: 23.59,
        longitude: 58.17,
        accuracy: 5,
        capturedAt: wo0044.submittedAt || new Date(),
      },
    });
  }

  console.log('Work orders seeded: 14 records');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
