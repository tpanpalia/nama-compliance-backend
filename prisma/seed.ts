import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import { generateRequestId } from '../src/types';

const prisma = new PrismaClient();

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

  const site1 = await prisma.site.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Al Khoud Extension',
      location: 'Muscat, Oman',
      latitude: 23.5957,
      longitude: 58.1697,
      region: 'Muscat',
    },
  });

  const site2 = await prisma.site.upsert({
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Seeb Industrial Area',
      location: 'Seeb, Oman',
      latitude: 23.6681,
      longitude: 58.1896,
      region: 'Muscat',
    },
  });

  const site3 = await prisma.site.upsert({
    where: { id: '33333333-3333-3333-3333-333333333333' },
    update: {},
    create: {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Barka Pipeline Project',
      location: 'Barka, Oman',
      latitude: 23.6819,
      longitude: 57.8654,
      region: 'Al Batinah',
    },
  });

  await prisma.checklistResponse.deleteMany({});
  await prisma.checklistTemplate.deleteMany({ where: { name: 'Standard Compliance Inspection' } });

  const sections = [
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

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Standard Compliance Inspection',
      description: 'Default template for water services compliance inspections',
      sections: {
        create: sections.map((section) => ({
          name: section.name,
          description: section.description,
          weight: section.weight,
          defaultWeight: section.defaultWeight,
          order: section.order,
          items: {
            create: section.items.map((text, index) => ({
              text,
              weight: 10,
              order: index + 1,
            })),
          },
        })),
      },
    },
  });

  const contractor = await prisma.contractor.upsert({
    where: { email: 'contractor@test.com' },
    update: {
      password: hash,
      contractorId: 'C-00001',
      companyName: 'Al Noor Construction',
      tradeLicense: 'TL-001',
      crNumber: 'CR-001',
      contactName: 'Ali Al-Rashdi',
      phone: '+96891234567',
      isActive: true,
    },
    create: {
      contractorId: 'C-00001',
      companyName: 'Al Noor Construction',
      tradeLicense: 'TL-001',
      crNumber: 'CR-001',
      contactName: 'Ali Al-Rashdi',
      email: 'contractor@test.com',
      password: hash,
      phone: '+96891234567',
    },
  });

  await prisma.workOrder.upsert({
    where: { reference: 'INS-2026-00001' },
    update: {},
    create: {
      reference: 'INS-2026-00001',
      title: 'Inspect hydrant chamber integrity',
      description: 'Initial safety and technical check for site zone A',
      status: WorkOrderStatus.PENDING,
      priority: WorkOrderPriority.HIGH,
      siteId: site1.id,
      createdById: admin.id,
    },
  });

  await prisma.workOrder.upsert({
    where: { reference: 'INS-2026-00002' },
    update: {},
    create: {
      reference: 'INS-2026-00002',
      title: 'Pipeline segment pressure retest',
      description: 'Follow-up verification after contractor correction',
      status: WorkOrderStatus.IN_PROGRESS,
      priority: WorkOrderPriority.CRITICAL,
      siteId: site2.id,
      contractorId: contractor.id,
      inspectorId: inspector.id,
      createdById: admin.id,
      startedAt: new Date(),
    },
  });

  await prisma.workOrder.upsert({
    where: { reference: 'INS-2026-00003' },
    update: {},
    create: {
      reference: 'INS-2026-00003',
      title: 'Final compliance check - Barka segment',
      description: 'Submission-ready review',
      status: WorkOrderStatus.SUBMITTED,
      priority: WorkOrderPriority.MEDIUM,
      siteId: site3.id,
      contractorId: contractor.id,
      inspectorId: inspector.id,
      createdById: admin.id,
      submittedAt: new Date(),
      overallScore: 84,
      complianceBand: 'GOOD',
    },
  });

  const daysAgo = (days: number) => {
    const d = new Date('2026-01-12');
    d.setDate(d.getDate() - days);
    return d;
  };

  await prisma.accessRequestDocument.deleteMany();
  await prisma.accessRequest.deleteMany({
    where: { status: 'PENDING' },
  });

  // Generate once to keep utility referenced in seed (request IDs below are fixed sample values)
  void generateRequestId(new Date('2026-01-12'), 1);

  const requestsData = [
    {
      requestId: 'REQ-20260112-001',
      role: 'REGULATOR',
      contactName: 'Khalid Al-Hinai',
      email: 'khalid.hinai@government.om',
      phone: '+968 9987 6543',
      organisation: 'APSR',
      department: 'Water Regulation',
      status: 'PENDING',
      createdAt: daysAgo(0),
      documents: [
        { name: 'Government ID', status: 'NOT_VERIFIED' },
        { name: 'Authorization Letter', status: 'NOT_VERIFIED' },
      ],
    },
    {
      requestId: 'REQ-20260111-005',
      role: 'REGULATOR',
      contactName: 'Sara Al-Busaidi',
      email: 'sara.busaidi@government.om',
      phone: '+968 9876 5432',
      organisation: 'Ministry of Regional Municipalities',
      department: 'Infrastructure',
      status: 'PENDING',
      createdAt: daysAgo(1),
      documents: [
        { name: 'Government ID', status: 'NOT_VERIFIED' },
        { name: 'Authorization Letter', status: 'NOT_VERIFIED' },
      ],
    },
    {
      requestId: 'REQ-20260110-003',
      role: 'CONTRACTOR',
      contactName: 'Mohammed Al-Rashdi',
      email: 'm.rashdi@alnoor.om',
      phone: '+968 9765 4321',
      companyName: 'Al Noor Construction',
      tradeLicense: 'TL-2024-003',
      crNumber: 'CR-2024-001',
      status: 'PENDING',
      createdAt: daysAgo(2),
      documents: [{ name: 'CR Number Document', status: 'NOT_VERIFIED' }],
    },
    {
      requestId: 'REQ-20260109-008',
      role: 'CONTRACTOR',
      contactName: 'Fatima Al-Balushi',
      email: 'f.balushi@gulfinfra.om',
      phone: '+968 9654 3210',
      companyName: 'Gulf Infrastructure Ltd',
      tradeLicense: 'TL-2024-008',
      crNumber: 'CR-2024-002',
      status: 'APPROVED',
      createdAt: daysAgo(3),
      reviewedAt: daysAgo(2),
      documents: [{ name: 'CR Number Document', status: 'VERIFIED' }],
    },
    {
      requestId: 'REQ-20260108-002',
      role: 'REGULATOR',
      contactName: 'Ahmed Al-Amri',
      email: 'ahmed.amri@government.om',
      phone: '+968 9543 2109',
      organisation: 'APSR',
      department: 'Compliance',
      status: 'APPROVED',
      createdAt: daysAgo(4),
      reviewedAt: daysAgo(3),
      documents: [
        { name: 'Government ID', status: 'VERIFIED' },
        { name: 'Authorization Letter', status: 'VERIFIED' },
      ],
    },
    {
      requestId: 'REQ-20260107-006',
      role: 'CONTRACTOR',
      contactName: 'Layla Al-Harthy',
      email: 'layla.harthy@coastal.om',
      phone: '+968 9432 1098',
      companyName: 'Coastal Engineering Group',
      tradeLicense: 'TL-2024-006',
      crNumber: 'CR-2024-005',
      status: 'APPROVED',
      createdAt: daysAgo(5),
      reviewedAt: daysAgo(4),
      documents: [{ name: 'CR Number Document', status: 'VERIFIED' }],
    },
    {
      requestId: 'REQ-20260106-009',
      role: 'CONTRACTOR',
      contactName: 'Youssef Al-Kindi',
      email: 'y.kindi@desert.om',
      phone: '+968 9321 0987',
      companyName: 'Desert Pipeline Solutions',
      tradeLicense: 'TL-2024-009',
      crNumber: 'CR-2024-006',
      status: 'REJECTED',
      createdAt: daysAgo(6),
      reviewedAt: daysAgo(5),
      reviewNotes: 'CR Number document could not be verified',
      documents: [{ name: 'CR Number Document', status: 'NOT_VERIFIED' }],
    },
    {
      requestId: 'REQ-20260105-004',
      role: 'REGULATOR',
      contactName: 'Mariam Al-Siyabi',
      email: 'mariam.siyabi@government.om',
      phone: '+968 9210 9876',
      organisation: 'Ministry of Environment',
      status: 'REJECTED',
      createdAt: daysAgo(7),
      reviewedAt: daysAgo(6),
      reviewNotes: 'Authorization letter missing',
      documents: [
        { name: 'Government ID', status: 'VERIFIED' },
        { name: 'Authorization Letter', status: 'NOT_VERIFIED' },
      ],
    },
    {
      requestId: 'REQ-20260104-007',
      role: 'CONTRACTOR',
      contactName: 'Hassan Al-Lawati',
      email: 'hassan.lawati@united.om',
      phone: '+968 9109 8765',
      companyName: 'United Engineering Co',
      tradeLicense: 'TL-2024-007',
      crNumber: 'CR-2024-003',
      status: 'APPROVED',
      createdAt: daysAgo(8),
      reviewedAt: daysAgo(7),
      documents: [{ name: 'CR Number Document', status: 'VERIFIED' }],
    },
    {
      requestId: 'REQ-20260103-010',
      role: 'CONTRACTOR',
      contactName: 'Aisha Al-Mahrouqi',
      email: 'aisha.mahrouqi@mountain.om',
      phone: '+968 9098 7654',
      companyName: 'Mountain Services LLC',
      tradeLicense: 'TL-2024-010',
      crNumber: 'CR-2024-004',
      status: 'APPROVED',
      createdAt: daysAgo(9),
      reviewedAt: daysAgo(8),
      documents: [{ name: 'CR Number Document', status: 'VERIFIED' }],
    },
  ];

  for (const req of requestsData) {
    const { documents, ...requestData } = req;
    const baseData = {
      ...requestData,
      role: requestData.role as any,
      status: requestData.status as any,
    };

    await prisma.accessRequest.upsert({
      where: { requestId: requestData.requestId },
      update: {
        ...baseData,
        documents: {
          deleteMany: {},
          create: documents.map((doc) => ({ ...doc, status: doc.status as any })),
        },
      },
      create: {
        ...baseData,
        documents: { create: documents.map((doc) => ({ ...doc, status: doc.status as any })) },
      },
    });
  }

  console.log('Access requests seeded: 10 records');

  console.log(`Seeded template: ${template.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
