import '../src/config/loadEnv';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixChecklist() {
  console.log('Fixing checklist template...');

  await prisma.evidence.updateMany({
    where: { checklistItemId: { not: null } },
    data: { checklistItemId: null },
  });

  await prisma.checklistResponse.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistSection.deleteMany();
  await prisma.checklistTemplate.deleteMany();

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Nama Standard Inspection Checklist',
      description: 'Official Nama Water Services compliance checklist',
      isActive: true,
      version: 1,
    },
  });

  const hse = await prisma.checklistSection.create({
    data: {
      name: 'HSE & Safety',
      description: 'Health, Safety and Environment checks',
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
      description: 'Technical installation quality checks',
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
        weight: 8,
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
        weight: 5,
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

  const processSection = await prisma.checklistSection.create({
    data: {
      name: 'Process & Communication',
      description: 'Process compliance and communication',
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
        sectionId: processSection.id,
      },
      {
        text: 'Monthly technical report submission',
        isRequired: true,
        weight: 7,
        order: 2,
        sectionId: processSection.id,
      },
      {
        text: 'Worker list submission',
        isRequired: true,
        weight: 5,
        order: 3,
        sectionId: processSection.id,
      },
    ],
  });

  const closure = await prisma.checklistSection.create({
    data: {
      name: 'Site Closure',
      description: 'Site closure and reinstatement',
      weight: 0.1,
      order: 4,
      templateId: template.id,
    },
  });

  await prisma.checklistItem.create({
    data: {
      text: 'Site cleaning and reinstatement',
      isRequired: true,
      weight: 3,
      order: 1,
      sectionId: closure.id,
    },
  });

  const itemCount = await prisma.checklistItem.count();
  console.log('Template created');
  console.log('4 sections created');
  console.log(`${itemCount} items created`);
  console.log('Done.');

  await prisma.$disconnect();
}

fixChecklist().catch(async (err) => {
  console.error('Failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
