import { PrismaClient, UserRole, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SCORING_WEIGHTS = {
  'HSE & Safety': 0.4,
  'Technical Installation': 0.3,
  'Process & Communication': 0.2,
  'Site Closure': 0.1,
};

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nama.om' },
    update: {},
    create: {
      azureAdOid: '00000000-0000-0000-0000-000000000001',
      email: 'admin@nama.om',
      displayName: 'NAMA Admin',
      role: UserRole.ADMIN,
    },
  });

  const inspector1 = await prisma.user.upsert({
    where: { email: 'inspector1@nama.om' },
    update: {},
    create: {
      azureAdOid: '00000000-0000-0000-0000-000000000002',
      email: 'inspector1@nama.om',
      displayName: 'Inspector One',
      role: UserRole.INSPECTOR,
    },
  });

  const inspector2 = await prisma.user.upsert({
    where: { email: 'inspector2@nama.om' },
    update: {},
    create: {
      azureAdOid: '00000000-0000-0000-0000-000000000003',
      email: 'inspector2@nama.om',
      displayName: 'Inspector Two',
      role: UserRole.INSPECTOR,
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

  await prisma.checklistTemplate.deleteMany({ where: { name: 'Standard Compliance Inspection' } });

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Standard Compliance Inspection',
      description: 'Default template for water services compliance inspections',
      sections: {
        create: [
          {
            name: 'HSE & Safety',
            weight: 0.4,
            order: 1,
            items: {
              create: [
                { text: 'PPE worn by all personnel', order: 1 },
                { text: 'Hazard signage displayed correctly', order: 2 },
                { text: 'Emergency exits accessible', order: 3 },
                { text: 'Fire extinguisher available and valid', order: 4 },
                { text: 'Permit-to-work documented', order: 5 },
              ],
            },
          },
          {
            name: 'Technical Installation',
            weight: 0.3,
            order: 2,
            items: {
              create: [
                { text: 'Pipe alignment matches approved drawing', order: 1 },
                { text: 'Joint sealing completed to spec', order: 2 },
                { text: 'Pressure test results within limits', order: 3 },
                { text: 'Valves tagged and accessible', order: 4 },
              ],
            },
          },
          {
            name: 'Process & Communication',
            weight: 0.2,
            order: 3,
            items: {
              create: [
                { text: 'Daily progress report submitted', order: 1 },
                { text: 'Stakeholder updates documented', order: 2 },
                { text: 'Deviation approvals recorded', order: 3 },
              ],
            },
          },
          {
            name: 'Site Closure',
            weight: 0.1,
            order: 4,
            items: {
              create: [
                { text: 'Site cleaned and debris removed', order: 1 },
                { text: 'Handover checklist signed', order: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.scoringConfig.upsert({
    where: { name: 'default' },
    update: { weights: DEFAULT_SCORING_WEIGHTS, updatedBy: admin.id },
    create: { name: 'default', weights: DEFAULT_SCORING_WEIGHTS, updatedBy: admin.id },
  });

  const contractor1 = await prisma.contractor.upsert({
    where: { email: 'ops@contractora.om' },
    update: {},
    create: {
      contractorId: 'C-00001',
      b2cOid: 'b2c-oid-contractor-1',
      companyName: 'Contractor A LLC',
      tradeLicense: 'TL-1001',
      crNumber: 'CR-1001',
      contactName: 'Ahmed Ali',
      email: 'ops@contractora.om',
      phone: '+96890000001',
    },
  });

  const contractor2 = await prisma.contractor.upsert({
    where: { email: 'ops@contractorb.om' },
    update: {},
    create: {
      contractorId: 'C-00002',
      b2cOid: 'b2c-oid-contractor-2',
      companyName: 'Contractor B LLC',
      tradeLicense: 'TL-1002',
      crNumber: 'CR-1002',
      contactName: 'Fatima Khan',
      email: 'ops@contractorb.om',
      phone: '+96890000002',
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
      contractorId: contractor1.id,
      inspectorId: inspector1.id,
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
      contractorId: contractor2.id,
      inspectorId: inspector2.id,
      createdById: admin.id,
      submittedAt: new Date(),
      overallScore: 84,
      complianceBand: 'GOOD',
    },
  });

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
