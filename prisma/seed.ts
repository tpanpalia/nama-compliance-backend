import { RatingValue, WorkOrderStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ANON_KEY!
);

const BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ??
  process.env.SUPABASE_BUCKET ??
  'compliance-files';

const TABLES = {
  user: 'User',
  contractor: 'Contractor',
  identity: 'Identity',
  site: 'Site',
  checklistTemplate: 'ChecklistTemplate',
  checklistSection: 'ChecklistSection',
  checklistItem: 'ChecklistItem',
  workOrder: 'WorkOrder',
  workOrderChecklist: 'WorkOrderChecklist',
  checklistResponse: 'ChecklistResponse',
  evidence: 'Evidence',
  contractorItemComment: 'ContractorItemComment',
  auditLog: 'AuditLog',
  accessRequest: 'AccessRequest',
  accessRequestDocument: 'AccessRequestDocument',
  reportLog: 'ReportLog',
} as const;

const PASSWORD_HASH = bcrypt.hashSync('mobile123', 10);

type MonthSlot = { year: number; month: number };

type RegionSeed = {
  name: string;
  contractors: string[];
  sites: Array<{
    name: string;
    location: string;
    lat: number;
    lng: number;
  }>;
};

type CreatedItem = {
  id: string;
  text: string;
  sectionName: string;
  sectionWeight: number;
  order: number;
};

const PHOTO_KEYS = Array.from({ length: 17 }, (_, i) => `seed/evidence/photo_${String(i + 1).padStart(2, '0')}.jpeg`);

const photoUrl = (key: string) => supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

let photoIdx = 0;

function nextPhoto() {
  const key = PHOTO_KEYS[photoIdx % PHOTO_KEYS.length];
  photoIdx += 1;
  return { key, url: photoUrl(key) };
}

const SEED_MONTHS: MonthSlot[] = [
  { year: 2026, month: 0 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
];

const WO_STATUS_PATTERN = [
  'PENDING',
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'SUBMITTED',
  'INSPECTION_COMPLETED',
  'INSPECTION_COMPLETED',
  'INSPECTION_COMPLETED',
  'REJECTED',
] as const satisfies readonly WorkOrderStatus[];

const PRIORITIES = [
  'LOW',
  'MEDIUM',
  'MEDIUM',
  'HIGH',
  'HIGH',
  'CRITICAL',
  'MEDIUM',
  'LOW',
  'HIGH',
  'MEDIUM',
] as const;

const RATING_PATTERN = [
  'COMPLIANT',
  'COMPLIANT',
  'COMPLIANT',
  'PARTIAL',
  'COMPLIANT',
  'COMPLIANT',
  'COMPLIANT',
  'NON_COMPLIANT',
  'COMPLIANT',
  'COMPLIANT',
  'COMPLIANT',
  'PARTIAL',
  'COMPLIANT',
  'COMPLIANT',
] as const satisfies readonly RatingValue[];

const RATING_POINTS: Record<RatingValue, number> = {
  COMPLIANT: 100,
  PARTIAL: 60,
  NON_COMPLIANT: 0,
};

const INSPECTOR_COMMENTS: Record<RatingValue, string[]> = {
  COMPLIANT: [
    'All requirements met. Work is satisfactory.',
    'Properly installed and meets specifications.',
    'Verified and confirmed compliant.',
    'Standards met. No issues observed.',
    'Work completed to approved standard.',
    'Inspected and confirmed fully compliant.',
  ],
  PARTIAL: [
    'Mostly compliant but minor gaps observed.',
    'Partial compliance — follow-up required.',
    'Some areas need attention before sign-off.',
    'Acceptable with minor deficiencies noted.',
  ],
  NON_COMPLIANT: [
    'Does not meet specifications. Rework required.',
    'Non-compliant. Contractor must rectify.',
    'Failed inspection. Immediate action needed.',
  ],
};

const CONTRACTOR_COMMENTS = [
  'Warning tapes installed along the entire perimeter. Barriers placed at all access points.',
  'All workers equipped with standard PPE including helmets, vests, and steel-toe boots.',
  'Trench excavated to approved depth and width. Measurements verified with measuring tape.',
  'Excavated soil stored 2m away from trench edge to prevent collapse risk.',
  'Pipe bedding material laid to 150mm depth as per approved specification.',
  'All joints properly aligned using approved couplings. Pressure test completed.',
  'Site barricaded with warning signs in Arabic and English. Security guard on duty.',
  'Backfilling completed in 300mm layers, each compacted with vibrating plate.',
];

const REJECTION_REASONS = [
  'Insufficient evidence provided. Photos do not clearly show completed work.',
  'PPE compliance not demonstrated in photos. Resubmit with clear evidence.',
  'Trench dimensions not matching approved drawings. Measurement photos required.',
  'Site not properly barricaded. Safety standards not met.',
];

const REGIONS_DATA: RegionSeed[] = [
  {
    name: 'Musandam',
    contractors: ['Musandam Civil Works LLC', 'Khasab Infrastructure Co.', 'Northern Oman Contractors'],
    sites: [
      { name: 'Khasab Water Supply', location: 'Khasab, Musandam', lat: 26.1843, lng: 56.2463 },
      { name: 'Bukha Pipeline Extension', location: 'Bukha, Musandam', lat: 26.1521, lng: 56.1923 },
    ],
  },
  {
    name: 'Al Buraimi',
    contractors: ['Al Buraimi Engineering LLC', 'Border Region Construction', 'Al Dhafra Water Services'],
    sites: [
      { name: 'Al Buraimi Distribution Network', location: 'Al Buraimi City', lat: 24.2322, lng: 55.7854 },
      { name: 'Mahadha Water Station', location: 'Mahadha, Al Buraimi', lat: 24.0853, lng: 55.9891 },
    ],
  },
  {
    name: 'Al Dhahirah',
    contractors: ['Ibri Pipeline Services', 'Al Dhahirah Civil Works', 'Yanqul Construction LLC'],
    sites: [
      { name: 'Ibri Water Treatment Plant', location: 'Ibri, Al Dhahirah', lat: 23.2253, lng: 56.5138 },
      { name: 'Yanqul Pipeline', location: 'Yanqul, Al Dhahirah', lat: 23.5847, lng: 56.8012 },
    ],
  },
  {
    name: 'Al Dakhiliyah',
    contractors: ['Nizwa Water Solutions', 'Al Dakhiliyah Contracting', 'Bahla Infrastructure LLC', 'Interior Region Services'],
    sites: [
      { name: 'Nizwa Distribution Network', location: 'Nizwa City, Al Dakhiliyah', lat: 22.9333, lng: 57.5333 },
      { name: 'Bahla Water Extension', location: 'Bahla, Al Dakhiliyah', lat: 22.9665, lng: 57.2952 },
      { name: 'Manah Pipeline Project', location: 'Manah, Al Dakhiliyah', lat: 22.8823, lng: 57.7821 },
    ],
  },
  {
    name: 'North Al Batinah',
    contractors: ['Sohar Civil Works', 'North Batinah Pipeline Co.', 'Gulf Coast Construction', 'Liwa Technical Services'],
    sites: [
      { name: 'Sohar Port Water Supply', location: 'Sohar Industrial Port', lat: 24.3421, lng: 56.7234 },
      { name: 'Shinas Water Network', location: 'Shinas, North Al Batinah', lat: 24.7449, lng: 56.4619 },
      { name: 'Liwa Coastal Pipeline', location: 'Liwa, North Al Batinah', lat: 24.5081, lng: 56.5453 },
    ],
  },
  {
    name: 'South Al Batinah',
    contractors: ['Barka Engineering LLC', 'Seeb Technical Services', 'South Batinah Contractors', 'Nakhal Water Works'],
    sites: [
      { name: 'Barka Desalination Link', location: 'Barka, South Al Batinah', lat: 23.6825, lng: 57.8921 },
      { name: 'Seeb Industrial Pipeline', location: 'Seeb Industrial Area', lat: 23.6789, lng: 58.1234 },
      { name: 'Nakhal Water Station', location: 'Nakhal, South Al Batinah', lat: 23.3741, lng: 57.8231 },
    ],
  },
  {
    name: 'Muscat',
    contractors: ['Al Noor Construction LLC', 'Muscat Infrastructure Co.', 'Al Khoud Development Co.', 'Capital Region Services'],
    sites: [
      { name: 'Al Khoud Water Extension', location: 'Al Khoud, Muscat', lat: 23.5969, lng: 58.1628 },
      { name: 'Muscat Hills Reservoir', location: 'Muscat Hills', lat: 23.6012, lng: 58.5234 },
      { name: 'Qurum Distribution Hub', location: 'Qurum, Muscat', lat: 23.5883, lng: 58.3912 },
      { name: 'Mawaleh Pipeline', location: 'Al Mawaleh, Muscat', lat: 23.5741, lng: 58.1823 },
    ],
  },
  {
    name: 'North Al Sharqiyah',
    contractors: ['Ibra Technical Services', 'Al Sharqiyah Pipeline LLC', 'Sinaw Civil Works', 'Eastern Oman Contractors'],
    sites: [
      { name: 'Ibra Water Network', location: 'Ibra, North Al Sharqiyah', lat: 22.6913, lng: 58.5331 },
      { name: 'Al Mudaybi Pipeline', location: 'Al Mudaybi, North Al Sharqiyah', lat: 22.5423, lng: 58.1012 },
      { name: 'Sinaw Distribution', location: 'Sinaw, North Al Sharqiyah', lat: 22.4127, lng: 57.9123 },
    ],
  },
  {
    name: 'South Al Sharqiyah',
    contractors: ['Sur Water Solutions', 'Coastal Pipeline Services', 'Al Hadd Construction LLC'],
    sites: [
      { name: 'Sur Coastal Pipeline', location: 'Sur, South Al Sharqiyah', lat: 22.5678, lng: 59.5289 },
      { name: 'Ras Al Hadd Water Station', location: 'Ras Al Hadd', lat: 22.5321, lng: 59.7923 },
    ],
  },
  {
    name: 'Al Wusta',
    contractors: ['Haima Engineering LLC', 'Duqm Industrial Services', 'Central Oman Contractors'],
    sites: [
      { name: 'Haima Water Supply', location: 'Haima, Al Wusta', lat: 19.9583, lng: 56.276 },
      { name: 'Duqm Industrial Water', location: 'Duqm, Al Wusta', lat: 19.658, lng: 57.7019 },
    ],
  },
];

const CHECKLIST_DATA = [
  {
    name: 'HSE & Safety',
    weight: 0.3,
    order: 1,
    items: [
      { text: "Contractor workers' compliance with wearing PPE", weight: 10, order: 1 },
      { text: 'Condition of equipment used by the contractor', weight: 10, order: 2 },
      { text: 'Overall compliance with Nama HSE standards', weight: 10, order: 3 },
    ],
  },
  {
    name: 'Technical Installation',
    weight: 0.4,
    order: 2,
    items: [
      { text: 'Compliance of excavation works with specified pipe diameter', weight: 8, order: 1 },
      { text: 'Installation of warning tape above pipeline', weight: 7, order: 2 },
      { text: 'Sand bedding installation', weight: 8, order: 3 },
      { text: 'Ground leveling, soil compaction, removal of rocks', weight: 7, order: 4 },
      { text: 'Flushing pipeline after installation and before meter', weight: 9, order: 5 },
      { text: 'Installation of marker posts', weight: 5, order: 6 },
      { text: 'Installation of identification tag', weight: 4, order: 7 },
    ],
  },
  {
    name: 'Process & Communication',
    weight: 0.2,
    order: 3,
    items: [
      { text: 'Notification to Nama before/during/after works', weight: 8, order: 1 },
      { text: 'Monthly technical report submission', weight: 7, order: 2 },
      { text: 'Worker list submission', weight: 5, order: 3 },
    ],
  },
  {
    name: 'Site Closure',
    weight: 0.1,
    order: 4,
    items: [{ text: 'Site cleaning and reinstatement', weight: 3, order: 1 }],
  },
] as const;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function monthForWoIndex(index: number) {
  return SEED_MONTHS[index % SEED_MONTHS.length];
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function dateInMonth(year: number, month: number, minDay = 1, maxDay?: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = randomInt(minDay, maxDay ?? lastDay);
  return new Date(year, month, day, 8 + randomInt(0, 8), randomInt(0, 59));
}

function calculateOverallScore(items: CreatedItem[], startOffset: number) {
  const sectionBuckets = new Map<string, { weight: number; scores: number[] }>();
  items.forEach((item, index) => {
    const rating = RATING_PATTERN[(startOffset + index) % RATING_PATTERN.length];
    const entry = sectionBuckets.get(item.sectionName) ?? { weight: item.sectionWeight, scores: [] };
    entry.scores.push(RATING_POINTS[rating]);
    sectionBuckets.set(item.sectionName, entry);
  });
  const score = Array.from(sectionBuckets.values()).reduce((sum, section) => {
    const avg = section.scores.reduce((a, b) => a + b, 0) / section.scores.length;
    return sum + avg * section.weight;
  }, 0);
  return Math.round(score * 10) / 10;
}

async function insertRow<T>(table: string, data: Record<string, unknown>) {
  const payload = { id: randomUUID(), ...data };
  const { data: row, error } = await supabase.from(table).insert(payload).select('*').single();
  if (error) throw error;
  return row as T;
}

async function insertRows(table: string, data: Record<string, unknown>[]) {
  if (!data.length) return;
  const payload = data.map((row) => ({ id: randomUUID(), ...row }));
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw error;
}

async function deleteAll(table: string) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) throw error;
}

async function upsertComment(data: Record<string, unknown>) {
  const { error } = await supabase
    .from(TABLES.contractorItemComment)
    .upsert({ id: randomUUID(), ...data }, {
      onConflict: 'workOrderId,checklistItemId,contractorId',
      ignoreDuplicates: false,
    });
  if (error) throw error;
}

async function main() {
  console.log('Starting seed...');

  console.log('Clearing existing data...');
  await deleteAll(TABLES.reportLog);
  await deleteAll(TABLES.accessRequestDocument);
  await deleteAll(TABLES.accessRequest);
  await deleteAll(TABLES.auditLog);
  await deleteAll(TABLES.evidence);
  await deleteAll(TABLES.contractorItemComment);
  await deleteAll(TABLES.checklistResponse);
  await deleteAll(TABLES.workOrderChecklist);
  await deleteAll(TABLES.workOrder);
  await deleteAll(TABLES.checklistItem);
  await deleteAll(TABLES.checklistSection);
  await deleteAll(TABLES.checklistTemplate);
  await deleteAll(TABLES.identity);
  await deleteAll(TABLES.site);
  await deleteAll(TABLES.contractor);
  await deleteAll(TABLES.user);
  console.log('✓ Cleared all existing data');

  console.log('Creating internal users...');
  const userSeeds = [
    { displayName: 'Ahmed Al-Balushi', email: 'admin@nama.om', role: 'ADMIN', organisation: 'Nama Water Services', department: 'Compliance' },
    { displayName: 'Fatima Al-Zadjali', email: 'fatima@nama.om', role: 'ADMIN', organisation: 'Nama Water Services', department: 'Operations' },
    { displayName: 'Khalid Al-Rashdi', email: 'inspector1@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Sara Al-Hinai', email: 'inspector2@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Mohammed Al-Farsi', email: 'inspector3@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Noor Al-Lawati', email: 'inspector4@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Tariq Al-Maqbali', email: 'inspector5@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Hessa Al-Balushi', email: 'inspector6@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Omar Al-Wahaibi', email: 'inspector7@nama.om', role: 'INSPECTOR', organisation: 'Nama Water Services', department: 'Inspection' },
    { displayName: 'Salim Al-Wahaibi', email: 'regulator1@nama.om', role: 'REGULATOR', organisation: 'Ministry of Housing', department: 'Water Regulation' },
    { displayName: 'Huda Al-Siyabi', email: 'regulator2@nama.om', role: 'REGULATOR', organisation: 'Public Authority for Utilities', department: 'Infrastructure' },
  ] as const;

  const users = [];
  for (const seed of userSeeds) {
    const user = await insertRow<any>(TABLES.user, {
      displayName: seed.displayName,
      role: seed.role,
      organisation: seed.organisation,
      department: seed.department,
      isActive: true,
    });
    await insertRow(TABLES.identity, {
      email: seed.email,
      password: PASSWORD_HASH,
      role: seed.role,
      isActive: true,
      userId: user.id,
    });
    users.push(user);
  }
  const admins = users.filter((u) => u.role === 'ADMIN');
  const inspectors = users.filter((u) => u.role === 'INSPECTOR');
  console.log(`✓ Created ${users.length} users`);

  console.log('Creating checklist template...');
  const template = await insertRow<any>(TABLES.checklistTemplate, {
    name: 'Nama Standard Inspection Checklist',
    description: 'Official Nama Water Services compliance checklist',
    isActive: true,
    version: 1,
  });

  const createdItems: CreatedItem[] = [];
  for (const sectionSeed of CHECKLIST_DATA) {
    const section = await insertRow<any>(TABLES.checklistSection, {
      name: sectionSeed.name,
      weight: sectionSeed.weight,
      order: sectionSeed.order,
      templateId: template.id,
    });
    for (const itemSeed of sectionSeed.items) {
      const item = await insertRow<any>(TABLES.checklistItem, {
        text: itemSeed.text,
        isRequired: true,
        weight: itemSeed.weight,
        order: itemSeed.order,
        sectionId: section.id,
      });
      createdItems.push({
        id: item.id,
        text: item.text,
        sectionName: sectionSeed.name,
        sectionWeight: sectionSeed.weight,
        order: itemSeed.order,
      });
    }
  }
  console.log(`✓ Created 1 checklist template (${createdItems.length} items)`);

  console.log('Creating sites...');
  const sitesByRegion: Record<string, Array<{ id: string; name: string; lat: number; lng: number }>> = {};
  for (const region of REGIONS_DATA) {
    sitesByRegion[region.name] = [];
    for (const siteSeed of region.sites) {
      const site = await insertRow<any>(TABLES.site, {
        name: siteSeed.name,
        location: siteSeed.location,
        latitude: siteSeed.lat,
        longitude: siteSeed.lng,
        region: region.name,
        isActive: true,
      });
      sitesByRegion[region.name].push({ id: site.id, name: site.name, lat: siteSeed.lat, lng: siteSeed.lng });
    }
  }
  console.log(`✓ Created ${Object.values(sitesByRegion).flat().length} sites`);

  console.log('Creating contractors...');
  const contractorsByRegion: Record<string, Array<{ id: string; companyName: string; contractorId: string }>> = {};
  let contractorCounter = 1;
  for (const region of REGIONS_DATA) {
    contractorsByRegion[region.name] = [];
    for (const companyName of region.contractors) {
      const seq = String(contractorCounter).padStart(3, '0');
      const contractor = await insertRow<any>(TABLES.contractor, {
        contractorId: `CNT-${seq}`,
        companyName,
        tradeLicense: `TL-${seq}`,
        crNumber: `CR-2024-${seq}`,
        contactName: `Manager ${seq}`,
        phone: `+968 9${seq}00000`,
        address: `${region.name}, Oman`,
        regions: [region.name],
        isActive: true,
      });
      await insertRow(TABLES.identity, {
        email: `${slug(companyName)}@contractor.om`,
        password: PASSWORD_HASH,
        role: 'CONTRACTOR',
        isActive: true,
        contractorId: contractor.id,
      });
      contractorsByRegion[region.name].push({
        id: contractor.id,
        companyName: contractor.companyName,
        contractorId: contractor.contractorId,
      });
      contractorCounter += 1;
    }
  }
  const contractorCount = Object.values(contractorsByRegion).flat().length;
  console.log(`✓ Created ${contractorCount} contractors`);

  console.log('Creating work orders...');
  const adminUser = admins[0];
  let workOrderSeq = 1;
  let workOrderCount = 0;
  let checklistCount = 0;
  let evidenceCount = 0;
  let commentCount = 0;
  let auditCount = 0;

  for (const region of REGIONS_DATA) {
    const regionSites = sitesByRegion[region.name];
    const regionContractors = contractorsByRegion[region.name];

    for (const contractor of regionContractors) {
      for (let woIndex = 0; woIndex < 10; woIndex += 1) {
        const status = WO_STATUS_PATTERN[woIndex];
        const priority = PRIORITIES[woIndex];
        const slot = monthForWoIndex(woIndex);
        const inspector = inspectors[workOrderSeq % inspectors.length];
        const site = regionSites[workOrderSeq % regionSites.length];
        const scheduledDate = dateInMonth(slot.year, slot.month, 1, 20);
        const startedAt = ['IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status)
          ? dateInMonth(slot.year, slot.month, 2, 12)
          : null;
        const submittedAt = ['SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status)
          ? dateInMonth(slot.year, slot.month, 10, 25)
          : null;
        const approvedAt = status === 'INSPECTION_COMPLETED' ? dateInMonth(slot.year, slot.month, 20, 28) : null;
        const reference = `WO-${scheduledDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(workOrderSeq).padStart(4, '0')}`;
        const overallScore = status === 'INSPECTION_COMPLETED' ? calculateOverallScore(createdItems, workOrderSeq) : null;
        const complianceBand =
          overallScore == null ? null : overallScore >= 90 ? 'EXCELLENT' : overallScore >= 75 ? 'GOOD' : overallScore >= 60 ? 'FAIR' : 'POOR';

        const workOrder = await insertRow<any>(TABLES.workOrder, {
          reference,
          title: `${site.name} — ${priority} Priority Work`,
          description: `Compliance inspection work order for ${site.name}. Contractor: ${contractor.companyName}.`,
          status,
          priority,
          scheduledDate: scheduledDate.toISOString(),
          startedAt: startedAt?.toISOString() ?? null,
          submittedAt: submittedAt?.toISOString() ?? null,
          approvedAt: approvedAt?.toISOString() ?? null,
          isLocked: status === 'INSPECTION_COMPLETED',
          overallScore,
          complianceBand: complianceBand as any,
          rejectionReason: status === 'REJECTED' ? REJECTION_REASONS[workOrderSeq % REJECTION_REASONS.length] : null,
          siteId: site.id,
          contractorId: contractor.id,
          inspectorId: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status) ? inspector.id : null,
          createdById: adminUser.id,
          approvedById: status === 'INSPECTION_COMPLETED' ? adminUser.id : null,
        });
        workOrderCount += 1;

        const actions = ['WORK_ORDER_CREATED'];
        if (['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status)) actions.push('CONTRACTOR_ASSIGNED');
        if (['IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status)) actions.push('INSPECTOR_ASSIGNED');
        if (['SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED'].includes(status)) actions.push('WORK_ORDER_SUBMITTED');
        if (status === 'INSPECTION_COMPLETED') actions.push('INSPECTION_COMPLETED');
        if (status === 'REJECTED') actions.push('WORK_ORDER_REJECTED');

        for (const action of actions) {
          await insertRow(TABLES.auditLog, {
            workOrderId: workOrder.id,
            userId: adminUser.id,
            action,
            newValue: { status },
            ipAddress: '192.168.1.1',
            createdAt: scheduledDate.toISOString(),
          });
          auditCount += 1;
        }

        if (status === 'IN_PROGRESS' || status === 'SUBMITTED') {
          const commentItems = createdItems.slice(0, status === 'IN_PROGRESS' ? 2 : 3);
          for (const item of commentItems) {
            await insertRow(TABLES.contractorItemComment, {
              workOrderId: workOrder.id,
              checklistItemId: item.id,
              contractorId: contractor.id,
              comment: CONTRACTOR_COMMENTS[commentCount % CONTRACTOR_COMMENTS.length],
              updatedAt: new Date().toISOString(),
            });
            commentCount += 1;
          }
        }

        if (status === 'SUBMITTED') {
          const submittedEvidence = createdItems.map((item) => {
            const photo = nextPhoto();
            return {
              workOrderId: workOrder.id,
              checklistItemId: item.id,
              type: 'PHOTO' as const,
              source: 'CONTRACTOR' as const,
              s3Key: photo.key,
              s3Url: photo.url,
              s3Bucket: BUCKET,
              fileName: photo.key.split('/').pop()!,
              fileSize: 150000 + randomInt(0, 200000),
              mimeType: 'image/jpeg',
              latitude: site.lat + (Math.random() - 0.5) * 0.001,
              longitude: site.lng + (Math.random() - 0.5) * 0.001,
              locationDisplayName: site.name,
              locationShortName: region.name,
              isLocationFlagged: false,
              locationDistance: 0,
              isConfirmed: true,
              capturedAt: dateInMonth(slot.year, slot.month, 5, 15),
            };
          });
          await insertRows(TABLES.evidence, submittedEvidence.map((row) => ({
            ...row,
            capturedAt: row.capturedAt.toISOString(),
          })));
          evidenceCount += submittedEvidence.length;
        }

        if (status === 'INSPECTION_COMPLETED') {
          const checklist = await insertRow<any>(TABLES.workOrderChecklist, {
            workOrderId: workOrder.id,
            isSubmitted: true,
            submittedAt: submittedAt!.toISOString(),
            lastSavedAt: submittedAt!.toISOString(),
            submittedLatitude: site.lat + (Math.random() - 0.5) * 0.001,
            submittedLongitude: site.lng + (Math.random() - 0.5) * 0.001,
          });
          checklistCount += 1;

          const responses = [];
          const contractorEvidenceRows = [];
          const inspectorEvidenceRows = [];
          for (let itemIndex = 0; itemIndex < createdItems.length; itemIndex += 1) {
            const item = createdItems[itemIndex];
            const rating = RATING_PATTERN[(workOrderSeq + itemIndex) % RATING_PATTERN.length];
            responses.push({
              checklistId: checklist.id,
              itemId: item.id,
              rating,
              comment: INSPECTOR_COMMENTS[rating][(workOrderSeq + itemIndex) % INSPECTOR_COMMENTS[rating].length],
            });

            const contractorPhotoCount = 1 + ((workOrderSeq + itemIndex) % 2);
            for (let p = 0; p < contractorPhotoCount; p += 1) {
              const photo = nextPhoto();
              contractorEvidenceRows.push({
                workOrderId: workOrder.id,
                checklistItemId: item.id,
                type: 'PHOTO' as const,
                source: 'CONTRACTOR' as const,
                s3Key: photo.key,
                s3Url: photo.url,
                s3Bucket: BUCKET,
                fileName: photo.key.split('/').pop()!,
                fileSize: 150000 + randomInt(0, 300000),
                mimeType: 'image/jpeg',
                latitude: site.lat + (Math.random() - 0.5) * 0.001,
                longitude: site.lng + (Math.random() - 0.5) * 0.001,
                locationDisplayName: site.name,
                locationShortName: region.name,
                isLocationFlagged: false,
                locationDistance: 0,
                isConfirmed: true,
                capturedAt: dateInMonth(slot.year, slot.month, 5, 15),
              });
            }

            const inspectorPhoto = nextPhoto();
            inspectorEvidenceRows.push({
              workOrderId: workOrder.id,
              checklistItemId: item.id,
              type: 'PHOTO' as const,
              source: 'INSPECTOR' as const,
              s3Key: inspectorPhoto.key,
              s3Url: inspectorPhoto.url,
              s3Bucket: BUCKET,
              fileName: inspectorPhoto.key.split('/').pop()!,
              fileSize: 120000 + randomInt(0, 200000),
              mimeType: 'image/jpeg',
              latitude: site.lat + (Math.random() - 0.5) * 0.001,
              longitude: site.lng + (Math.random() - 0.5) * 0.001,
              locationDisplayName: site.name,
              locationShortName: region.name,
              isLocationFlagged: false,
              locationDistance: 0,
              isConfirmed: true,
              capturedAt: dateInMonth(slot.year, slot.month, 18, 28),
            });
          }

          await insertRows(
            TABLES.checklistResponse,
            responses
          );
          await insertRows(
            TABLES.evidence,
            contractorEvidenceRows.map((row) => ({
              ...row,
              capturedAt: row.capturedAt.toISOString(),
            }))
          );
          await insertRows(
            TABLES.evidence,
            inspectorEvidenceRows.map((row) => ({
              ...row,
              capturedAt: row.capturedAt.toISOString(),
            }))
          );
          evidenceCount += contractorEvidenceRows.length + inspectorEvidenceRows.length;

          for (const item of createdItems.slice(0, 2)) {
            await upsertComment({
              workOrderId: workOrder.id,
              checklistItemId: item.id,
              contractorId: contractor.id,
              comment: CONTRACTOR_COMMENTS[commentCount % CONTRACTOR_COMMENTS.length],
              updatedAt: new Date().toISOString(),
            });
            commentCount += 1;
          }
        }

        workOrderSeq += 1;
      }
    }
  }

  console.log(`✓ Created ${workOrderCount} work orders`);
  console.log(`✓ Created ${checklistCount} completed checklists`);
  console.log(`✓ Created ${evidenceCount} evidence records`);
  console.log(`✓ Created ${commentCount} contractor comments`);
  console.log(`✓ Created ${auditCount} audit logs`);

  console.log('Creating access requests...');
  const accessRequests = [
    {
      requestId: 'REQ-2026-001',
      role: 'CONTRACTOR' as const,
      contactName: 'Rustam Al-Balushi',
      email: 'rustam@newcontractor.om',
      phone: '+968 9200 0001',
      companyName: 'Al Rustam Engineering LLC',
      tradeLicense: 'TL-NEW-001',
      crNumber: 'CR-2025-101',
      status: 'PENDING' as const,
      docs: ['Trade License', 'CR Certificate', 'Company Profile'],
    },
    {
      requestId: 'REQ-2026-002',
      role: 'CONTRACTOR' as const,
      contactName: 'Mona Al-Harthi',
      email: 'mona@alharthy.om',
      phone: '+968 9200 0002',
      companyName: 'Al Harthy Infrastructure',
      tradeLicense: 'TL-NEW-002',
      crNumber: 'CR-2025-102',
      status: 'PENDING' as const,
      docs: ['Trade License', 'CR Certificate'],
    },
    {
      requestId: 'REQ-2026-003',
      role: 'CONTRACTOR' as const,
      contactName: 'Jaber Al-Amri',
      email: 'jaber@alamri.om',
      phone: '+968 9200 0003',
      companyName: 'Al Amri Water Works',
      tradeLicense: 'TL-NEW-003',
      crNumber: 'CR-2025-103',
      status: 'PENDING' as const,
      docs: ['Trade License', 'CR Certificate', 'Bank Statement'],
    },
    {
      requestId: 'REQ-2026-004',
      role: 'REGULATOR' as const,
      contactName: 'Zainab Al-Kindi',
      email: 'zainab@housing.gov.om',
      phone: '+968 9200 0004',
      organisation: 'Ministry of Housing',
      department: 'Water Infrastructure',
      status: 'PENDING' as const,
      docs: ['Government ID', 'Authorization Letter'],
    },
    {
      requestId: 'REQ-2025-010',
      role: 'CONTRACTOR' as const,
      contactName: 'Hassan Al-Noor',
      email: 'hassan.approved@contractor.om',
      phone: '+968 9200 0010',
      companyName: 'Al Noor Approved Co.',
      tradeLicense: 'TL-APR-001',
      crNumber: 'CR-2024-201',
      status: 'APPROVED' as const,
      reviewNotes: 'All documents verified. Access granted.',
      docs: ['Trade License', 'CR Certificate', 'Company Profile'],
    },
    {
      requestId: 'REQ-2025-011',
      role: 'REGULATOR' as const,
      contactName: 'Salim Approved',
      email: 'salim.approved@gov.om',
      phone: '+968 9200 0011',
      organisation: 'Public Authority',
      department: 'Regulation',
      status: 'APPROVED' as const,
      reviewNotes: 'Verified government employee.',
      docs: ['Government ID'],
    },
    {
      requestId: 'REQ-2025-020',
      role: 'CONTRACTOR' as const,
      contactName: 'Unknown Applicant',
      email: 'unknown@test.om',
      phone: '+968 9200 0020',
      companyName: 'Test Company',
      tradeLicense: 'TL-000',
      crNumber: 'CR-000',
      status: 'REJECTED' as const,
      reviewNotes: 'Incomplete documentation. Trade license could not be verified.',
      docs: ['Trade License'],
    },
    {
      requestId: 'REQ-2025-021',
      role: 'CONTRACTOR' as const,
      contactName: 'Invalid Applicant',
      email: 'invalid@test.om',
      phone: '+968 9200 0021',
      companyName: 'Invalid Co.',
      tradeLicense: 'TL-INV',
      crNumber: 'CR-INV',
      status: 'REJECTED' as const,
      reviewNotes: 'Company registration number not valid.',
      docs: ['CR Certificate'],
    },
  ];

  for (const seed of accessRequests) {
    const accessRequest = await insertRow<any>(TABLES.accessRequest, {
      requestId: seed.requestId,
      role: seed.role,
      contactName: seed.contactName,
      email: seed.email,
      phone: seed.phone,
      companyName: 'companyName' in seed ? seed.companyName ?? null : null,
      tradeLicense: 'tradeLicense' in seed ? seed.tradeLicense ?? null : null,
      crNumber: 'crNumber' in seed ? seed.crNumber ?? null : null,
      organisation: 'organisation' in seed ? seed.organisation ?? null : null,
      department: 'department' in seed ? seed.department ?? null : null,
      status: seed.status,
      reviewedAt: seed.status === 'PENDING' ? null : '2025-12-01T09:00:00.000Z',
      reviewNotes: 'reviewNotes' in seed ? seed.reviewNotes ?? null : null,
      updatedAt: new Date().toISOString(),
    });

    await insertRows(
      TABLES.accessRequestDocument,
      seed.docs.map((name) => ({
        accessRequestId: accessRequest.id,
        name,
        status: seed.status === 'APPROVED' ? 'VERIFIED' : seed.status === 'REJECTED' ? 'REJECTED' : 'NOT_VERIFIED',
        fileUrl: null,
        updatedAt: new Date().toISOString(),
      }))
    );
  }
  console.log(`✓ Created ${accessRequests.length} access requests`);

  console.log('Creating sample report logs...');
  const reportKeys = [
    'reports/performance-summary-report.pdf',
    'reports/contractor-performance-report.pdf',
  ];

  const { error: deleteReportLogsError } = await supabase
    .from(TABLES.reportLog)
    .delete()
    .in('fileKey', reportKeys);

  if (deleteReportLogsError) throw deleteReportLogsError;

  await insertRows(TABLES.reportLog, [
    {
      reportType: 'Performance Summary',
      subject: 'All Regions',
      period: '2026',
      generatedBy: adminUser.id,
      fileKey: 'reports/performance-summary-report.pdf',
      fileUrl:
        'https://liddpvjkdmijehpbpjib.supabase.co' +
        '/storage/v1/object/public/' +
        'compliance-files/reports/' +
        'performance-summary-report.pdf',
      fileSize: 0,
      filters: {},
      generatedAt: new Date().toISOString(),
    },
    {
      reportType: 'Contractor Performance',
      subject: 'All Regions',
      period: '2026',
      generatedBy: adminUser.id,
      fileKey: 'reports/contractor-performance-report.pdf',
      fileUrl:
        'https://liddpvjkdmijehpbpjib.supabase.co' +
        '/storage/v1/object/public/' +
        'compliance-files/reports/' +
        'contractor-performance-report.pdf',
      fileSize: 0,
      filters: {},
      generatedAt: new Date().toISOString(),
    },
  ]);
  console.log('✓ Created 2 report logs');

  console.log('');
  console.log('═══════════════════════════════');
  console.log('SEED COMPLETE');
  console.log('═══════════════════════════════');
  console.log(`Users: ${users.length}`);
  console.log(`Contractors: ${contractorCount}`);
  console.log(`Sites: ${Object.values(sitesByRegion).flat().length}`);
  console.log(`Work Orders: ${workOrderCount}`);
  console.log(`Evidence: ${evidenceCount}`);
  console.log(`Comments: ${commentCount}`);
  console.log(`Access Requests: ${accessRequests.length}`);
  console.log('');
  console.log('Test logins (password: mobile123):');
  console.log('  Admin: admin@nama.om');
  console.log('  Inspector: inspector1@nama.om');
  console.log('  Contractor: musandam.civil.works.llc@contractor.om');
  console.log('  Regulator: regulator1@nama.om');
}

main()
  .catch(async (err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => undefined);
