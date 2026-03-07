import '../src/config/loadEnv';
import bcrypt from 'bcryptjs';
import { IdentityRole, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const contractorsData = [
  {
    contractorId: 'C-00001',
    companyName: 'Al Noor Construction',
    tradeLicense: 'TL-2023-001',
    crNumber: 'CR-2024-001',
    contactName: 'Mohammed Al-Rashdi',
    email: 'contact@alnoor.om',
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

  await prisma.auditLog.deleteMany();
  await prisma.checklistResponse.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistSection.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.accessRequestDocument.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contractor.deleteMany();

  const admin = await prisma.user.create({
    data: {
      displayName: 'Ahmed Al-Busaidi',
      role: UserRole.ADMIN,
      isActive: true,
      identity: {
        create: {
          email: 'admin@nama.om',
          password: hash,
          role: IdentityRole.ADMIN,
          isActive: true,
        },
      },
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
    const user = await prisma.user.create({
      data: {
        displayName: u.displayName,
        role: u.role,
        isActive: true,
        identity: {
          create: {
            email: u.email,
            password: hash,
            role: IdentityRole.INSPECTOR,
            isActive: true,
          },
        },
      },
    });
    inspectors[u.displayName] = user;
  }

  await prisma.user.create({
    data: {
      displayName: 'APSR Regulator',
      role: UserRole.REGULATOR,
      organisation: 'APSR',
      department: 'Water Services Regulation',
      isActive: true,
      identity: {
        create: {
          email: 'regulator@apsr.om',
          password: hash,
          role: IdentityRole.REGULATOR,
          isActive: true,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      displayName: 'Khalid Al-Farsi',
      role: UserRole.REGULATOR,
      organisation: 'APSR',
      department: 'Compliance Division',
      isActive: true,
      identity: {
        create: {
          email: 'inspector@apsr.om',
          password: hash,
          role: IdentityRole.REGULATOR,
          isActive: true,
        },
      },
    },
  });

  const mobileHash = await bcrypt.hash('mobile123', 10);

  const existingInspectorIdentity = await prisma.identity.findUnique({
    where: { email: 'inspector@nama.om' },
    include: { user: true },
  });

  const inspectorUser =
    existingInspectorIdentity?.user ||
    (await prisma.user.create({
      data: {
        displayName: 'Ahmed Al-Rashid',
        role: UserRole.INSPECTOR,
        isActive: true,
      },
    }));

  await prisma.identity.upsert({
    where: { email: 'inspector@nama.om' },
    update: {
      password: mobileHash,
      role: IdentityRole.INSPECTOR,
      isActive: true,
      userId: inspectorUser.id,
    },
    create: {
      email: 'inspector@nama.om',
      password: mobileHash,
      role: IdentityRole.INSPECTOR,
      isActive: true,
      userId: inspectorUser.id,
    },
  });

  for (const c of contractorsData) {
    await prisma.contractor.create({
      data: {
        contractorId: c.contractorId,
        companyName: c.companyName,
        tradeLicense: c.tradeLicense,
        crNumber: c.crNumber,
        contactName: c.contactName,
        phone: c.phone,
        address: c.address,
        isActive: true,
        identity: {
          create: {
            email: c.email,
            password: hash,
            role: IdentityRole.CONTRACTOR,
            isActive: true,
          },
        },
      },
    });
  }

  const existingContractorIdentity = await prisma.identity.findUnique({
    where: { email: 'contractor@test.com' },
    include: { contractor: true },
  });

  const contractorRecord =
    existingContractorIdentity?.contractor ||
    (await prisma.contractor.create({
      data: {
        contractorId: 'C-00007',
        companyName: 'Al Madina Contracting',
        tradeLicense: 'TL-2026-001',
        crNumber: 'CR-12345',
        contactName: 'Khalid Al-Hinai',
        phone: '+968 9123 4567',
        isActive: true,
      },
    }));

  await prisma.identity.upsert({
    where: { email: 'contractor@test.com' },
    update: {
      password: mobileHash,
      role: IdentityRole.CONTRACTOR,
      isActive: true,
      contractorId: contractorRecord.id,
    },
    create: {
      email: 'contractor@test.com',
      password: mobileHash,
      role: IdentityRole.CONTRACTOR,
      isActive: true,
      contractorId: contractorRecord.id,
    },
  });

  const mobileSites = [
    {
      name: 'Al Khoud Extension',
      location: 'Muscat, Oman',
      latitude: 23.588,
      longitude: 58.1829,
      region: 'Muscat',
    },
    {
      name: 'Seeb Industrial Area',
      location: 'Muscat, Oman',
      latitude: 23.6693,
      longitude: 58.1494,
      region: 'Muscat',
    },
    {
      name: 'Barka Pipeline Project',
      location: 'Al Batinah, Oman',
      latitude: 23.6827,
      longitude: 57.8679,
      region: 'Al Batinah',
    },
    {
      name: 'Sohar Industrial Area',
      location: 'Sohar, Oman',
      latitude: 24.3473,
      longitude: 56.729,
      region: 'Al Batinah',
    },
    {
      name: 'Nizwa Infrastructure',
      location: 'Nizwa, Oman',
      latitude: 22.9333,
      longitude: 57.5333,
      region: 'Ad Dakhiliyah',
    },
  ];

  const mobileSiteMap: Record<string, any> = {};
  for (const siteData of mobileSites) {
    const existingSite = await prisma.site.findFirst({
      where: { name: siteData.name },
    });
    if (existingSite) {
      mobileSiteMap[siteData.name] = existingSite;
    } else {
      mobileSiteMap[siteData.name] = await prisma.site.create({
        data: {
          ...siteData,
          isActive: true,
        },
      });
    }
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
    sites[s.name] = await ensureSite(s.name, s.address, i);
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Nama Standard Inspection Checklist',
      description: 'Standard compliance checklist for all Nama water infrastructure inspections',
      isActive: true,
      version: 1,
    },
  });

  const hse = await prisma.checklistSection.create({
    data: {
      name: 'HSE & Safety',
      weight: 0.3,
      order: 1,
      templateId: template.id,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        text: "Contractor workers' compliance with wearing PPE",
        isRequired: true,
        weight: 10,
        order: 1,
        sectionId: hse.id,
      },
      {
        text: 'Condition of equipment used by the contractor',
        isRequired: true,
        weight: 10,
        order: 2,
        sectionId: hse.id,
      },
      {
        text: 'Overall compliance with Nama HSE standards',
        isRequired: true,
        weight: 10,
        order: 3,
        sectionId: hse.id,
      },
    ],
  });

  const tech = await prisma.checklistSection.create({
    data: {
      name: 'Technical Installation',
      weight: 0.4,
      order: 2,
      templateId: template.id,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        text: 'Compliance of excavation works with specified pipe diameter',
        isRequired: true,
        weight: 4,
        order: 1,
        sectionId: tech.id,
      },
      {
        text: 'Installation of warning tape above pipeline',
        isRequired: true,
        weight: 7,
        order: 2,
        sectionId: tech.id,
      },
      {
        text: 'Sand bedding installation',
        isRequired: true,
        weight: 8,
        order: 3,
        sectionId: tech.id,
      },
      {
        text: 'Ground leveling, soil compaction, removal of rocks',
        isRequired: true,
        weight: 7,
        order: 4,
        sectionId: tech.id,
      },
      {
        text: 'Flushing pipeline after installation and before meter',
        isRequired: true,
        weight: 9,
        order: 5,
        sectionId: tech.id,
      },
      {
        text: 'Installation of marker posts',
        isRequired: true,
        weight: 3,
        order: 6,
        sectionId: tech.id,
      },
      {
        text: 'Installation of identification tag',
        isRequired: true,
        weight: 4,
        order: 7,
        sectionId: tech.id,
      },
    ],
  });

  const process = await prisma.checklistSection.create({
    data: {
      name: 'Process & Communication',
      weight: 0.2,
      order: 3,
      templateId: template.id,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        text: 'Notification to Nama before/during/after works',
        isRequired: true,
        weight: 8,
        order: 1,
        sectionId: process.id,
      },
      {
        text: 'Monthly technical report submission',
        isRequired: true,
        weight: 7,
        order: 2,
        sectionId: process.id,
      },
      {
        text: 'Worker list submission',
        isRequired: true,
        weight: 3,
        order: 3,
        sectionId: process.id,
      },
    ],
  });

  const closure = await prisma.checklistSection.create({
    data: {
      name: 'Site Closure',
      weight: 0.1,
      order: 4,
      templateId: template.id,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        text: 'Site cleaning and reinstatement',
        isRequired: true,
        weight: 3,
        order: 1,
        sectionId: closure.id,
      },
    ],
  });

  const templateWithSections = await prisma.checklistTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
    },
  });

  const contractors: Record<string, any> = {};
  const contractorList = await prisma.contractor.findMany();
  for (const c of contractorList) contractors[c.companyName] = c;

  const now = new Date();
  const submittedRecent = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const submittedRecent2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const submittedOld = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const workOrdersData = [
    { reference: 'WO-20260112-0055', title: 'Mutrah Corniche Extension Inspection', status: 'PENDING', siteKey: 'Mutrah Corniche Extension', contractor: null, inspector: null, createdAt: dateAt('2026-01-12'), updatedAt: dateAt('2026-01-12') },
    { reference: 'WO-20260111-0052', title: 'Azaiba Residential Area Inspection', status: 'PENDING', siteKey: 'Azaiba Residential Area', contractor: null, inspector: null, createdAt: dateAt('2026-01-11'), updatedAt: dateAt('2026-01-11') },
    { reference: 'WO-20260110-0048', title: 'Ibri Commercial Zone Inspection', status: 'ASSIGNED', siteKey: 'Ibri Commercial Zone', contractor: 'Desert Pipeline Solutions', inspector: null, createdAt: dateAt('2026-01-10'), updatedAt: dateAt('2026-01-10') },
    { reference: 'WO-20260109-0045', title: 'Sohar Industrial Area Inspection', status: 'IN_PROGRESS', siteKey: 'Sohar Industrial Area', contractor: 'Gulf Infrastructure Ltd', inspector: 'Sara Al-Hinai', startedAt: dateAt('2026-01-13'), createdAt: dateAt('2026-01-09'), updatedAt: dateAt('2026-01-14') },
    { reference: 'WO-20260109-0044', title: 'Al Khoud Extension Inspection', status: 'INSPECTION_COMPLETED', siteKey: 'Al Khoud Extension', contractor: 'Al Noor Construction', inspector: 'Ahmed Al-Rashid', overallScore: 86, complianceBand: 'GOOD', startedAt: dateAt('2026-01-07'), submittedAt: dateAt('2026-01-09'), approvedAt: dateAt('2026-01-09'), isLocked: true, createdAt: dateAt('2026-01-09'), updatedAt: dateAt('2026-01-09') },
    { reference: 'WO-20260108-0042', title: 'Seeb Industrial Area Inspection', status: 'SUBMITTED', siteKey: 'Seeb Industrial Area', contractor: 'Gulf Infrastructure Ltd', inspector: 'Fatima Al-Balushi', startedAt: dateAt('2026-01-06'), submittedAt: submittedRecent, createdAt: dateAt('2026-01-08'), updatedAt: dateAt('2026-01-08') },
    { reference: 'WO-20260107-0038', title: 'Barka Pipeline Inspection', status: 'INSPECTION_COMPLETED', siteKey: 'Barka Pipeline', contractor: 'United Engineering Co', inspector: 'Ahmed Al-Rashid', overallScore: 92, complianceBand: 'EXCELLENT', startedAt: dateAt('2026-01-05'), submittedAt: dateAt('2026-01-07'), approvedAt: dateAt('2026-01-07'), isLocked: true, createdAt: dateAt('2026-01-07'), updatedAt: dateAt('2026-01-07') },
    { reference: 'WO-20260106-0035', title: 'Sohar Port Connection Inspection', status: 'INSPECTION_COMPLETED', siteKey: 'Sohar Port Connection', contractor: 'Al Noor Construction', inspector: 'Fatima Al-Balushi', overallScore: 95, complianceBand: 'EXCELLENT', startedAt: dateAt('2026-01-04'), submittedAt: dateAt('2026-01-06'), approvedAt: dateAt('2026-01-06'), isLocked: true, createdAt: dateAt('2026-01-06'), updatedAt: dateAt('2026-01-06') },
    { reference: 'WO-20260105-0031', title: 'Sur Coastal Project Inspection', status: 'IN_PROGRESS', siteKey: 'Sur Coastal Project', contractor: 'Coastal Engineering Group', inspector: 'Khalid Al-Hinai', startedAt: dateAt('2026-01-04'), createdAt: dateAt('2026-01-05'), updatedAt: dateAt('2026-01-05') },
    { reference: 'WO-20260104-0029', title: 'Nizwa Infrastructure Inspection', status: 'SUBMITTED', siteKey: 'Nizwa Infrastructure', contractor: 'Mountain Services LLC', inspector: 'Ahmed Al-Rashid', startedAt: dateAt('2026-01-02'), submittedAt: submittedOld, createdAt: dateAt('2026-01-04'), updatedAt: dateAt('2026-01-04') },
    { reference: 'WO-20260103-0025', title: 'Adam Pipeline Extension Inspection', status: 'SUBMITTED', siteKey: 'Adam Pipeline Ext', contractor: 'Desert Pipeline Solutions', inspector: 'Fatima Al-Balushi', startedAt: dateAt('2026-01-01'), submittedAt: submittedRecent2, createdAt: dateAt('2026-01-03'), updatedAt: dateAt('2026-01-03') },
    { reference: 'WO-20260102-0021', title: 'Muscat Business District Inspection', status: 'IN_PROGRESS', siteKey: 'Muscat Business District', contractor: 'Gulf Infrastructure Ltd', inspector: 'Khalid Al-Hinai', startedAt: dateAt('2026-01-01'), createdAt: dateAt('2026-01-02'), updatedAt: dateAt('2026-01-02') },
    { reference: 'WO-20260101-0018', title: 'Salalah Commercial Zone Inspection', status: 'IN_PROGRESS', siteKey: 'Salalah Commercial Zone', contractor: 'Coastal Engineering Group', inspector: 'Ahmed Al-Rashid', startedAt: dateAt('2025-12-31'), createdAt: dateAt('2026-01-01'), updatedAt: dateAt('2026-01-01') },
    { reference: 'WO-20251230-0015', title: 'Ruwi District Installation Inspection', status: 'INSPECTION_COMPLETED', siteKey: 'Ruwi District Installation', contractor: 'United Engineering Co', inspector: 'Fatima Al-Balushi', overallScore: 89, complianceBand: 'GOOD', startedAt: dateAt('2025-12-28'), submittedAt: dateAt('2025-12-30'), approvedAt: dateAt('2025-12-30'), isLocked: true, createdAt: dateAt('2025-12-30'), updatedAt: dateAt('2025-12-30') },
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
        approvedById: data.status === 'INSPECTION_COMPLETED' ? admin.id : null,
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

    const items = templateWithSections.sections
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => s.items.sort((a, b) => a.order - b.order));
    let firstResponseId: string | null = null;

    for (let i = 0; i < items.length; i += 1) {
      const response = await prisma.checklistResponse.create({
        data: {
          checklistId: checklist.id,
          itemId: items[i].id,
          rating: i === 0 ? 'NON_COMPLIANT' : i === 6 || i === 12 ? 'PARTIAL' : 'COMPLIANT',
          comment: i === 0 || i === 6 || i === 12 ? 'Deviation noted during inspection' : null,
        },
      });
      if (!firstResponseId) firstResponseId = response.id;
    }

    await prisma.evidence.create({
      data: {
        workOrderId: wo0044.id,
        checklistResponseId: firstResponseId,
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

  const mobileWorkOrders = [
    {
      reference: 'WO-20260108-M001',
      title: 'Al Khoud Extension Inspection',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      siteKey: 'Al Khoud Extension',
      scheduledDate: new Date('2026-01-12T08:00:00Z'),
      startedAt: new Date('2026-01-08T08:00:00Z'),
      submittedAt: null,
      inspectorId: inspectorUser.id,
    },
    {
      reference: 'WO-20260107-M002',
      title: 'Seeb Industrial Area Inspection',
      status: 'SUBMITTED',
      priority: 'MEDIUM',
      siteKey: 'Seeb Industrial Area',
      scheduledDate: new Date('2026-01-07T08:00:00Z'),
      startedAt: new Date('2026-01-07T08:00:00Z'),
      submittedAt: new Date('2026-01-09T14:00:00Z'),
      inspectorId: inspectorUser.id,
    },
    {
      reference: 'WO-20260105-M003',
      title: 'Barka Pipeline Project Inspection',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      siteKey: 'Barka Pipeline Project',
      scheduledDate: new Date('2026-01-15T08:00:00Z'),
      startedAt: null,
      submittedAt: null,
      inspectorId: null,
    },
    {
      reference: 'WO-20260101-M004',
      title: 'Sohar Industrial Area Inspection',
      status: 'SUBMITTED',
      priority: 'LOW',
      siteKey: 'Sohar Industrial Area',
      scheduledDate: new Date('2026-01-01T08:00:00Z'),
      startedAt: new Date('2026-01-01T08:00:00Z'),
      submittedAt: new Date('2026-01-03T10:00:00Z'),
      inspectorId: inspectorUser.id,
    },
    {
      reference: 'WO-20260103-M005',
      title: 'Nizwa Infrastructure Inspection',
      status: 'ASSIGNED',
      priority: 'LOW',
      siteKey: 'Nizwa Infrastructure',
      scheduledDate: new Date('2026-01-20T08:00:00Z'),
      startedAt: null,
      submittedAt: null,
      inspectorId: null,
    },
    {
      reference: 'WO-20251220-M006',
      title: 'Al Khoud Extension Phase 2',
      status: 'INSPECTION_COMPLETED',
      priority: 'HIGH',
      siteKey: 'Al Khoud Extension',
      scheduledDate: new Date('2025-12-20T08:00:00Z'),
      startedAt: new Date('2025-12-20T08:00:00Z'),
      submittedAt: new Date('2025-12-22T09:00:00Z'),
      approvedAt: new Date('2025-12-22T09:00:00Z'),
      inspectorId: inspectorUser.id,
      overallScore: 87.5,
      complianceBand: 'GOOD',
      isLocked: true,
    },
    {
      reference: 'WO-20251215-M007',
      title: 'Barka Pipeline Phase 1',
      status: 'INSPECTION_COMPLETED',
      priority: 'MEDIUM',
      siteKey: 'Barka Pipeline Project',
      scheduledDate: new Date('2025-12-15T08:00:00Z'),
      startedAt: new Date('2025-12-15T08:00:00Z'),
      submittedAt: new Date('2025-12-17T11:00:00Z'),
      approvedAt: new Date('2025-12-17T11:00:00Z'),
      inspectorId: inspectorUser.id,
      overallScore: 91,
      complianceBand: 'EXCELLENT',
      isLocked: true,
    },
    {
      reference: 'WO-20251210-M008',
      title: 'Seeb Industrial Phase 2',
      status: 'INSPECTION_COMPLETED',
      priority: 'MEDIUM',
      siteKey: 'Seeb Industrial Area',
      scheduledDate: new Date('2025-12-10T08:00:00Z'),
      startedAt: new Date('2025-12-10T08:00:00Z'),
      submittedAt: new Date('2025-12-12T15:00:00Z'),
      approvedAt: new Date('2025-12-12T15:00:00Z'),
      inspectorId: inspectorUser.id,
      overallScore: 78,
      complianceBand: 'GOOD',
      isLocked: true,
    },
  ];

  for (const wo of mobileWorkOrders) {
    await prisma.workOrder.upsert({
      where: { reference: wo.reference },
      update: {},
      create: {
        reference: wo.reference,
        title: wo.title,
        status: wo.status as any,
        priority: wo.priority as any,
        siteId: mobileSiteMap[wo.siteKey].id,
        contractorId: contractorRecord.id,
        inspectorId: wo.inspectorId,
        createdById: admin.id,
        approvedById: wo.status === 'INSPECTION_COMPLETED' ? admin.id : null,
        scheduledDate: wo.scheduledDate,
        startedAt: wo.startedAt,
        submittedAt: wo.submittedAt,
        approvedAt: 'approvedAt' in wo ? (wo as any).approvedAt : null,
        isLocked: 'isLocked' in wo ? Boolean((wo as any).isLocked) : false,
        overallScore: 'overallScore' in wo ? Number((wo as any).overallScore) : null,
        complianceBand: 'complianceBand' in wo ? ((wo as any).complianceBand as any) : null,
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
