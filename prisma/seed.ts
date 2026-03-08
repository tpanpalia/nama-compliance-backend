import '../src/config/loadEnv';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { ComplianceBand, EvidenceSource, EvidenceType, IdentityRole, PrismaClient, RatingValue, UserRole, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const PASSWORD = 'mobile123';
const PHOTOS_DIR = 'C:\\Users\\FCI\\Desktop\\NAMA\\Compliance\\photos';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || 'compliance-files';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

type UploadedPhoto = { key: string; url: string; fileName: string; fileSize: number };
type UserSpec = { displayName: string; email: string; role: UserRole; identityRole: IdentityRole; organisation?: string | null; department?: string | null };
type ContractorSpec = { code: string; companyName: string; crNumber: string; tradeLicense: string; contactName: string; email: string; phone: string; address: string; regions: string[] };
type SiteSpec = { code: string; name: string; location: string; latitude: number; longitude: number; region: string };
type WorkOrderSpec = { key: string; date: string; seq: string; title: string; status: WorkOrderStatus; priority: WorkOrderPriority; siteCode: string; contractorCode?: string; inspectorEmail?: string; scheduledDate: string; startedAt?: string; submittedAt?: string; approvedAt?: string; rejectionReason?: string };

const admins: UserSpec[] = [
  { displayName: 'Ahmed Al-Balushi', email: 'admin@nama.om', role: UserRole.ADMIN, identityRole: IdentityRole.ADMIN },
  { displayName: 'Fatima Al-Zadjali', email: 'fatima@nama.om', role: UserRole.ADMIN, identityRole: IdentityRole.ADMIN },
];
const inspectors: UserSpec[] = [
  { displayName: 'Khalid Al-Rashdi', email: 'inspector1@nama.om', role: UserRole.INSPECTOR, identityRole: IdentityRole.INSPECTOR },
  { displayName: 'Sara Al-Hinai', email: 'inspector2@nama.om', role: UserRole.INSPECTOR, identityRole: IdentityRole.INSPECTOR },
  { displayName: 'Mohammed Al-Farsi', email: 'inspector3@nama.om', role: UserRole.INSPECTOR, identityRole: IdentityRole.INSPECTOR },
  { displayName: 'Noor Al-Lawati', email: 'inspector4@nama.om', role: UserRole.INSPECTOR, identityRole: IdentityRole.INSPECTOR },
  { displayName: 'Tariq Al-Maqbali', email: 'inspector5@nama.om', role: UserRole.INSPECTOR, identityRole: IdentityRole.INSPECTOR },
];
const regulators: UserSpec[] = [
  { displayName: 'Salim Al-Wahaibi', email: 'regulator1@nama.om', role: UserRole.REGULATOR, identityRole: IdentityRole.REGULATOR, organisation: 'Authority for Public Services Regulation', department: 'Water Compliance' },
  { displayName: 'Huda Al-Siyabi', email: 'regulator2@nama.om', role: UserRole.REGULATOR, identityRole: IdentityRole.REGULATOR, organisation: 'Ministry of Housing', department: 'Field Oversight' },
];
const contractorSpecs: ContractorSpec[] = [
  { code: 'CNT-001', companyName: 'Al Noor Construction LLC', crNumber: 'CR-2024-001', tradeLicense: 'TL-2024-001', contactName: 'Hassan Al-Noor', email: 'alnoor@contractor.om', phone: '+968 9100 0001', address: 'Al Khuwair, Muscat', regions: ['Muscat'] },
  { code: 'CNT-002', companyName: 'Muscat Infrastructure Co.', crNumber: 'CR-2024-002', tradeLicense: 'TL-2024-002', contactName: 'Layla Al-Muscat', email: 'muscat.infra@contractor.om', phone: '+968 9100 0002', address: 'Seeb, Muscat', regions: ['Muscat'] },
  { code: 'CNT-003', companyName: 'Gulf Water Systems LLC', crNumber: 'CR-2024-003', tradeLicense: 'TL-2024-003', contactName: 'Samir Al-Gulf', email: 'gulf.water@contractor.om', phone: '+968 9100 0003', address: 'Sohar, Al Batinah North', regions: ['North Al Batinah'] },
  { code: 'CNT-004', companyName: 'Oman Pipeline Services', crNumber: 'CR-2024-004', tradeLicense: 'TL-2024-004', contactName: 'Rania Al-Pipe', email: 'oman.pipeline@contractor.om', phone: '+968 9100 0004', address: 'Barka, Al Batinah South', regions: ['South Al Batinah'] },
  { code: 'CNT-005', companyName: 'Al Madina Contracting', crNumber: 'CR-2024-005', tradeLicense: 'TL-2024-005', contactName: 'Yousef Al-Madina', email: 'almadina@contractor.om', phone: '+968 9100 0005', address: 'Nizwa, Ad Dakhiliyah', regions: ['Al Dakhiliyah'] },
  { code: 'CNT-006', companyName: 'Seeb Technical Services', crNumber: 'CR-2024-006', tradeLicense: 'TL-2024-006', contactName: 'Maryam Al-Seeb', email: 'seeb.tech@contractor.om', phone: '+968 9100 0006', address: 'Al Khoud, Muscat', regions: ['Muscat'] },
  { code: 'CNT-007', companyName: 'Barka Engineering LLC', crNumber: 'CR-2024-007', tradeLicense: 'TL-2024-007', contactName: 'Faisal Al-Barka', email: 'barka.eng@contractor.om', phone: '+968 9100 0007', address: 'Barka, Al Batinah South', regions: ['South Al Batinah'] },
  { code: 'CNT-008', companyName: 'Sohar Civil Works', crNumber: 'CR-2024-008', tradeLicense: 'TL-2024-008', contactName: 'Amira Al-Sohar', email: 'sohar.civil@contractor.om', phone: '+968 9100 0008', address: 'Sohar, Al Batinah North', regions: ['North Al Batinah'] },
  { code: 'CNT-009', companyName: 'Nizwa Water Solutions', crNumber: 'CR-2024-009', tradeLicense: 'TL-2024-009', contactName: 'Ibrahim Al-Nizwa', email: 'nizwa.water@contractor.om', phone: '+968 9100 0009', address: 'Nizwa, Ad Dakhiliyah', regions: ['Al Dakhiliyah'] },
  { code: 'CNT-010', companyName: 'Al Khoud Development Co.', crNumber: 'CR-2024-010', tradeLicense: 'TL-2024-010', contactName: 'Dina Al-Khoud', email: 'alkhoud.dev@contractor.om', phone: '+968 9100 0010', address: 'Al Khoud, Muscat', regions: ['Muscat', 'North Al Batinah'] },
];
const siteSpecs: SiteSpec[] = [
  { code: 'AL_KHOUD', name: 'Al Khoud Water Extension', location: 'Al Khoud, Muscat', latitude: 23.5969, longitude: 58.1628, region: 'Muscat' },
  { code: 'SEEB', name: 'Seeb Industrial Pipeline', location: 'Seeb Industrial Area, Muscat', latitude: 23.6789, longitude: 58.1234, region: 'Muscat' },
  { code: 'BARKA', name: 'Barka Desalination Link', location: 'Barka, Al Batinah South', latitude: 23.6825, longitude: 57.8921, region: 'Al Batinah' },
  { code: 'SOHAR', name: 'Sohar Port Water Supply', location: 'Sohar Industrial Port, Al Batinah North', latitude: 24.3421, longitude: 56.7234, region: 'Al Batinah' },
  { code: 'NIZWA', name: 'Nizwa Distribution Network', location: 'Nizwa City Centre, Ad Dakhiliyah', latitude: 22.9333, longitude: 57.5333, region: 'Ad Dakhiliyah' },
  { code: 'MUSCAT_HILLS', name: 'Muscat Hills Reservoir', location: 'Muscat Hills, Muscat', latitude: 23.6012, longitude: 58.5234, region: 'Muscat' },
  { code: 'SUR', name: 'Sur Coastal Pipeline', location: 'Sur, Ash Sharqiyah South', latitude: 22.5678, longitude: 59.5289, region: 'Ash Sharqiyah' },
  { code: 'SALALAH', name: 'Salalah Water Network', location: 'Salalah, Dhofar', latitude: 17.0151, longitude: 54.0924, region: 'Dhofar' },
];
const commentSamples = [
  'Warning tapes installed along the entire perimeter of the excavation site. Barriers placed at all access points.',
  'All workers equipped with standard PPE including safety helmets, high-visibility vests, and steel-toe boots.',
  'Trench excavated to 1.5m depth and 0.8m width as specified in drawings. Measurements verified with measuring tape.',
  'Excavated soil stored 2 meters away from trench edge to prevent collapse risk.',
  'Pipe bedding material (sand) laid to 150mm depth as per approved specification.',
  'All joints properly aligned using approved couplings. Pressure test scheduled for tomorrow morning.',
  'Site barricaded with warning signs in Arabic and English. Security guard on duty.',
  'Backfilling completed in 300mm layers, each layer compacted with vibrating plate.',
];
const ratingPattern: RatingValue[] = [
  RatingValue.COMPLIANT, RatingValue.COMPLIANT, RatingValue.COMPLIANT, RatingValue.PARTIAL, RatingValue.COMPLIANT,
  RatingValue.COMPLIANT, RatingValue.COMPLIANT, RatingValue.NON_COMPLIANT, RatingValue.COMPLIANT, RatingValue.COMPLIANT,
  RatingValue.COMPLIANT, RatingValue.PARTIAL, RatingValue.COMPLIANT, RatingValue.COMPLIANT, RatingValue.COMPLIANT,
];
const workOrders: WorkOrderSpec[] = [
  { key: 'P1', date: '2026-03-14', seq: '0001', title: 'Al Khoud Extension Phase 3 Inspection', status: WorkOrderStatus.PENDING, priority: WorkOrderPriority.MEDIUM, siteCode: 'AL_KHOUD', scheduledDate: '2026-03-20T08:00:00Z' },
  { key: 'P2', date: '2026-03-12', seq: '0002', title: 'Sohar Port Water Supply Pre-Inspection', status: WorkOrderStatus.PENDING, priority: WorkOrderPriority.HIGH, siteCode: 'SOHAR', scheduledDate: '2026-03-22T08:00:00Z' },
  { key: 'P3', date: '2026-03-10', seq: '0003', title: 'Salalah Network Expansion Review', status: WorkOrderStatus.PENDING, priority: WorkOrderPriority.LOW, siteCode: 'SALALAH', scheduledDate: '2026-03-25T08:00:00Z' },
  { key: 'A1', date: '2026-03-08', seq: '0004', title: 'Seeb Industrial Corridor Inspection', status: WorkOrderStatus.ASSIGNED, priority: WorkOrderPriority.HIGH, siteCode: 'SEEB', contractorCode: 'CNT-006', inspectorEmail: 'inspector1@nama.om', scheduledDate: '2026-03-15T08:00:00Z' },
  { key: 'A2', date: '2026-03-07', seq: '0005', title: 'Muscat Hills Reservoir Safety Walkthrough', status: WorkOrderStatus.ASSIGNED, priority: WorkOrderPriority.MEDIUM, siteCode: 'MUSCAT_HILLS', contractorCode: 'CNT-002', inspectorEmail: 'inspector2@nama.om', scheduledDate: '2026-03-14T08:00:00Z' },
  { key: 'A3', date: '2026-03-06', seq: '0006', title: 'Sur Coastal Pipeline Initial Inspection', status: WorkOrderStatus.ASSIGNED, priority: WorkOrderPriority.CRITICAL, siteCode: 'SUR', contractorCode: 'CNT-008', inspectorEmail: 'inspector3@nama.om', scheduledDate: '2026-03-18T08:00:00Z' },
  { key: 'IP1', date: '2026-03-05', seq: '0007', title: 'Barka Desalination Link Active Inspection', status: WorkOrderStatus.IN_PROGRESS, priority: WorkOrderPriority.HIGH, siteCode: 'BARKA', contractorCode: 'CNT-007', inspectorEmail: 'inspector4@nama.om', scheduledDate: '2026-03-08T08:00:00Z', startedAt: '2026-03-06T07:30:00Z' },
  { key: 'IP2', date: '2026-03-04', seq: '0008', title: 'Nizwa Distribution Network Trench Review', status: WorkOrderStatus.IN_PROGRESS, priority: WorkOrderPriority.MEDIUM, siteCode: 'NIZWA', contractorCode: 'CNT-009', inspectorEmail: 'inspector1@nama.om', scheduledDate: '2026-03-10T08:00:00Z', startedAt: '2026-03-05T09:00:00Z' },
  { key: 'IP3', date: '2026-03-03', seq: '0009', title: 'Sohar Port Booster Line Inspection', status: WorkOrderStatus.IN_PROGRESS, priority: WorkOrderPriority.MEDIUM, siteCode: 'SOHAR', contractorCode: 'CNT-003', inspectorEmail: 'inspector5@nama.om', scheduledDate: '2026-03-09T08:00:00Z', startedAt: '2026-03-04T08:45:00Z' },
  { key: 'S1', date: '2026-03-02', seq: '0010', title: 'Al Khoud Night Shift Submission', status: WorkOrderStatus.SUBMITTED, priority: WorkOrderPriority.HIGH, siteCode: 'AL_KHOUD', contractorCode: 'CNT-010', inspectorEmail: 'inspector2@nama.om', scheduledDate: '2026-03-04T08:00:00Z', startedAt: '2026-03-02T07:00:00Z', submittedAt: '2026-03-03T15:00:00Z' },
  { key: 'S2', date: '2026-03-01', seq: '0011', title: 'Pipeline Pressure Test Submission', status: WorkOrderStatus.SUBMITTED, priority: WorkOrderPriority.MEDIUM, siteCode: 'SEEB', contractorCode: 'CNT-001', inspectorEmail: 'inspector3@nama.om', scheduledDate: '2026-03-03T08:00:00Z', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-02T13:30:00Z' },
  { key: 'S3', date: '2026-02-28', seq: '0012', title: 'Muscat Hills Restoration Submission', status: WorkOrderStatus.SUBMITTED, priority: WorkOrderPriority.LOW, siteCode: 'MUSCAT_HILLS', contractorCode: 'CNT-002', inspectorEmail: 'inspector4@nama.om', scheduledDate: '2026-03-02T08:00:00Z', startedAt: '2026-02-28T08:15:00Z', submittedAt: '2026-03-01T11:20:00Z' },
  { key: 'S4', date: '2026-02-27', seq: '0013', title: 'Salalah Road Crossing Submission', status: WorkOrderStatus.SUBMITTED, priority: WorkOrderPriority.HIGH, siteCode: 'SALALAH', contractorCode: 'CNT-004', inspectorEmail: 'inspector5@nama.om', scheduledDate: '2026-03-01T08:00:00Z', startedAt: '2026-02-27T09:10:00Z', submittedAt: '2026-02-28T17:10:00Z' },
  { key: 'IC1', date: '2026-02-26', seq: '0014', title: 'Al Khoud Mainline Completion Audit', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.HIGH, siteCode: 'AL_KHOUD', contractorCode: 'CNT-001', inspectorEmail: 'inspector1@nama.om', scheduledDate: '2026-02-27T08:00:00Z', startedAt: '2026-02-24T08:00:00Z', submittedAt: '2026-02-26T14:00:00Z', approvedAt: '2026-02-26T14:45:00Z' },
  { key: 'IC2', date: '2026-02-24', seq: '0015', title: 'Barka Link Trench Inspection', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.MEDIUM, siteCode: 'BARKA', contractorCode: 'CNT-007', inspectorEmail: 'inspector2@nama.om', scheduledDate: '2026-02-25T08:00:00Z', startedAt: '2026-02-22T08:00:00Z', submittedAt: '2026-02-24T15:00:00Z', approvedAt: '2026-02-24T15:30:00Z' },
  { key: 'IC3', date: '2026-02-22', seq: '0016', title: 'Pipeline Materials Verification Audit', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.HIGH, siteCode: 'SOHAR', contractorCode: 'CNT-003', inspectorEmail: 'inspector3@nama.om', scheduledDate: '2026-02-23T08:00:00Z', startedAt: '2026-02-20T08:00:00Z', submittedAt: '2026-02-22T13:00:00Z', approvedAt: '2026-02-22T13:40:00Z' },
  { key: 'IC4', date: '2026-02-20', seq: '0017', title: 'Seeb Safety and Closure Audit', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.MEDIUM, siteCode: 'SEEB', contractorCode: 'CNT-006', inspectorEmail: 'inspector4@nama.om', scheduledDate: '2026-02-21T08:00:00Z', startedAt: '2026-02-18T08:00:00Z', submittedAt: '2026-02-20T16:10:00Z', approvedAt: '2026-02-20T16:30:00Z' },
  { key: 'IC5', date: '2026-02-18', seq: '0018', title: 'Nizwa Excavation Completion Review', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.CRITICAL, siteCode: 'NIZWA', contractorCode: 'CNT-009', inspectorEmail: 'inspector5@nama.om', scheduledDate: '2026-02-19T08:00:00Z', startedAt: '2026-02-16T08:00:00Z', submittedAt: '2026-02-18T14:50:00Z', approvedAt: '2026-02-18T15:15:00Z' },
  { key: 'IC6', date: '2026-02-16', seq: '0019', title: 'Muscat Hills Reservoir Inspection Closeout', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.LOW, siteCode: 'MUSCAT_HILLS', contractorCode: 'CNT-002', inspectorEmail: 'inspector1@nama.om', scheduledDate: '2026-02-17T08:00:00Z', startedAt: '2026-02-14T08:00:00Z', submittedAt: '2026-02-16T12:40:00Z', approvedAt: '2026-02-16T13:00:00Z' },
  { key: 'IC7', date: '2026-02-14', seq: '0020', title: 'Sur Coastal Reinforcement Final Inspection', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.HIGH, siteCode: 'SUR', contractorCode: 'CNT-008', inspectorEmail: 'inspector2@nama.om', scheduledDate: '2026-02-15T08:00:00Z', startedAt: '2026-02-12T08:00:00Z', submittedAt: '2026-02-14T10:30:00Z', approvedAt: '2026-02-14T11:00:00Z' },
  { key: 'IC8', date: '2026-02-12', seq: '0021', title: 'Salalah Network Handover Inspection', status: WorkOrderStatus.INSPECTION_COMPLETED, priority: WorkOrderPriority.MEDIUM, siteCode: 'SALALAH', contractorCode: 'CNT-004', inspectorEmail: 'inspector3@nama.om', scheduledDate: '2026-02-13T08:00:00Z', startedAt: '2026-02-10T08:00:00Z', submittedAt: '2026-02-12T11:00:00Z', approvedAt: '2026-02-12T11:45:00Z' },
  { key: 'R1', date: '2026-02-11', seq: '0022', title: 'Barka Compaction Failure Review', status: WorkOrderStatus.REJECTED, priority: WorkOrderPriority.HIGH, siteCode: 'BARKA', contractorCode: 'CNT-007', inspectorEmail: 'inspector4@nama.om', scheduledDate: '2026-02-12T08:00:00Z', startedAt: '2026-02-09T08:00:00Z', submittedAt: '2026-02-11T14:30:00Z', rejectionReason: 'Backfilling compaction failed density test. Rework required before resubmission.' },
  { key: 'R2', date: '2026-02-10', seq: '0023', title: 'Sohar Joint Alignment Failure', status: WorkOrderStatus.REJECTED, priority: WorkOrderPriority.CRITICAL, siteCode: 'SOHAR', contractorCode: 'CNT-003', inspectorEmail: 'inspector5@nama.om', scheduledDate: '2026-02-11T08:00:00Z', startedAt: '2026-02-08T08:00:00Z', submittedAt: '2026-02-10T16:20:00Z', rejectionReason: 'Pipe joints misaligned and pressure test results unacceptable.' },
  { key: 'RO1', date: '2026-02-09', seq: '0024', title: 'Al Khoud Safety Review Rejection', status: WorkOrderStatus.REJECTED, priority: WorkOrderPriority.MEDIUM, siteCode: 'AL_KHOUD', contractorCode: 'CNT-010', inspectorEmail: 'inspector1@nama.om', scheduledDate: '2026-02-10T08:00:00Z', startedAt: '2026-02-07T08:00:00Z', submittedAt: '2026-02-09T12:10:00Z', rejectionReason: 'Safety barricading and PPE compliance gaps require correction before completion.' },
  { key: 'RO2', date: '2026-02-08', seq: '0025', title: 'Nizwa Bedding Material Rejection Review', status: WorkOrderStatus.REJECTED, priority: WorkOrderPriority.HIGH, siteCode: 'NIZWA', contractorCode: 'CNT-005', inspectorEmail: 'inspector2@nama.om', scheduledDate: '2026-02-09T08:00:00Z', startedAt: '2026-02-06T08:00:00Z', submittedAt: '2026-02-08T11:50:00Z', rejectionReason: 'Bedding material installation does not meet approved standards and must be redone.' },
];

const scoreBand = (score: number): ComplianceBand => score >= 90 ? ComplianceBand.EXCELLENT : score >= 70 ? ComplianceBand.GOOD : score >= 50 ? ComplianceBand.FAIR : ComplianceBand.POOR;
const ratingPoints = (rating: RatingValue) => (rating === RatingValue.COMPLIANT ? 100 : rating === RatingValue.PARTIAL ? 60 : 0);
const ref = (date: Date, seq: string) => `WO-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${seq}`;
const dt = (value?: string) => (value ? new Date(value) : null);
const offset = (base: number, index: number) => Math.round((base + 0.0002 + index * 0.0001) * 1e6) / 1e6;

async function uploadPhotos(): Promise<UploadedPhoto[]> {
  const files = fs.readdirSync(PHOTOS_DIR).filter((f) => /\.jpe?g$/i.test(f)).sort();
  if (files.length !== 17) throw new Error(`Expected 17 photos, found ${files.length}`);
  const uploaded: UploadedPhoto[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const key = `seed/evidence/photo_${String(i + 1).padStart(2, '0')}.jpeg`;
    const buffer = fs.readFileSync(path.join(PHOTOS_DIR, file));
    console.log(`Uploading ${i + 1}/${files.length}: ${file}`);
    await supabase.storage.from(BUCKET).remove([key]);
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`Failed to upload ${file}: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    uploaded.push({ key, url: data.publicUrl, fileName: `photo_${String(i + 1).padStart(2, '0')}.jpeg`, fileSize: buffer.length });
  }
  console.log(`? Uploaded ${uploaded.length} photos to Supabase`);
  return uploaded;
}
async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase credentials missing');

  await prisma.reportLog.deleteMany();
  await prisma.accessRequestDocument.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.contractorItemComment.deleteMany();
  await prisma.checklistResponse.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistSection.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.site.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.user.deleteMany();
  console.log('? Cleared all existing data');

  const hash = await bcrypt.hash(PASSWORD, 10);
  const users: Record<string, { id: string; displayName: string; role: UserRole }> = {};
  const contractors: Record<string, { id: string; companyName: string; crNumber: string; email: string }> = {};
  const sites: Record<string, SiteSpec & { id: string }> = {};

  for (const spec of [...admins, ...inspectors, ...regulators]) {
    const user = await prisma.user.create({
      data: {
        displayName: spec.displayName,
        role: spec.role,
        organisation: spec.organisation ?? null,
        department: spec.department ?? null,
        isActive: true,
        identity: { create: { email: spec.email, password: hash, role: spec.identityRole, isActive: true } },
      },
    });
    users[spec.email] = { id: user.id, displayName: user.displayName, role: user.role };
  }
  console.log('? Created 9 users');

  for (const spec of contractorSpecs) {
    const contractor = await prisma.contractor.create({
      data: {
        contractorId: spec.code,
        companyName: spec.companyName,
        tradeLicense: spec.tradeLicense,
        crNumber: spec.crNumber,
        contactName: spec.contactName,
        phone: spec.phone,
        address: spec.address,
        regions: spec.regions,
        isActive: true,
        identity: { create: { email: spec.email, password: hash, role: IdentityRole.CONTRACTOR, isActive: true } },
      },
    });
    contractors[spec.code] = { id: contractor.id, companyName: contractor.companyName, crNumber: contractor.crNumber, email: spec.email };
  }
  console.log('? Created 10 contractors');

  for (const spec of siteSpecs) {
    const site = await prisma.site.create({ data: { name: spec.name, location: spec.location, latitude: spec.latitude, longitude: spec.longitude, region: spec.region, isActive: true } });
    sites[spec.code] = { ...spec, id: site.id };
  }
  console.log('? Created 8 sites');

  const template = await prisma.checklistTemplate.create({
    data: {
      name: 'Nama Standard Inspection Checklist',
      isActive: true,
      version: 1,
      sections: {
        create: [
          { name: 'HSE & Safety', weight: 0.3, order: 1, items: { create: [
            { text: \"Contractor workers' compliance with wearing PPE\", weight: 10, isRequired: true, order: 1 },
            { text: 'Condition of equipment used by the contractor', weight: 10, isRequired: true, order: 2 },
            { text: 'Overall compliance with Nama HSE standards', weight: 10, isRequired: true, order: 3 },
          ] } },
          { name: 'Technical Installation', weight: 0.4, order: 2, items: { create: [
            { text: 'Compliance of excavation works with specified pipe diameter', weight: 8, isRequired: true, order: 1 },
            { text: 'Installation of warning tape above pipeline', weight: 7, isRequired: true, order: 2 },
            { text: 'Sand bedding installation', weight: 8, isRequired: true, order: 3 },
            { text: 'Ground leveling, soil compaction, removal of rocks', weight: 7, isRequired: true, order: 4 },
            { text: 'Flushing pipeline after installation and before meter', weight: 9, isRequired: true, order: 5 },
            { text: 'Installation of marker posts', weight: 5, isRequired: true, order: 6 },
            { text: 'Installation of identification tag', weight: 4, isRequired: true, order: 7 },
          ] } },
          { name: 'Process & Communication', weight: 0.2, order: 3, items: { create: [
            { text: 'Notification to Nama before/during/after works', weight: 8, isRequired: true, order: 1 },
            { text: 'Monthly technical report submission', weight: 7, isRequired: true, order: 2 },
            { text: 'Worker list submission', weight: 5, isRequired: true, order: 3 },
          ] } },
          { name: 'Site Closure', weight: 0.1, order: 4, items: { create: [
            { text: 'Site cleaning and reinstatement', weight: 3, isRequired: true, order: 1 },
          ] } },
        ],
      },
    },
    include: { sections: { orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' } } } } },
  });
  console.log('? Created 1 checklist template (14 items)');

  const itemMap: Record<string, { id: string }> = {};
  for (const section of template.sections) for (const item of section.items) itemMap[`${section.name}:${item.order}`] = { id: item.id };
  const allItems = template.sections.flatMap((s) => s.items);
  const sectionDefs = template.sections.map((s) => ({ weight: s.weight, items: s.items.map((i) => i.id) }));
  const photos = await uploadPhotos();

  const woMap: Record<string, { id: string; contractorId: string | null; inspectorId: string | null; siteCode: string; submittedAt: Date | null }> = {};
  for (let i = 0; i < workOrders.length; i += 1) {
    const spec = workOrders[i];
    const wo = await prisma.workOrder.create({
      data: {
        reference: ref(new Date(spec.date), spec.seq),
        title: spec.title,
        status: spec.status,
        priority: spec.priority,
        siteId: sites[spec.siteCode].id,
        contractorId: spec.contractorCode ? contractors[spec.contractorCode].id : null,
        inspectorId: spec.inspectorEmail ? users[spec.inspectorEmail].id : null,
        createdById: users[admins[i % admins.length].email].id,
        approvedById: spec.status === WorkOrderStatus.INSPECTION_COMPLETED && spec.inspectorEmail ? users[spec.inspectorEmail].id : null,
        scheduledDate: dt(spec.scheduledDate),
        startedAt: dt(spec.startedAt),
        submittedAt: dt(spec.submittedAt),
        approvedAt: dt(spec.approvedAt),
        rejectionReason: spec.rejectionReason ?? null,
        isLocked: spec.status === WorkOrderStatus.INSPECTION_COMPLETED,
      },
    });
    woMap[spec.key] = { id: wo.id, contractorId: wo.contractorId, inspectorId: wo.inspectorId, siteCode: spec.siteCode, submittedAt: wo.submittedAt };
  }
  console.log('? Created 25 work orders');

  const completedKeys = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7', 'IC8'];
  for (let wi = 0; wi < completedKeys.length; wi += 1) {
    const key = completedKeys[wi];
    const wo = woMap[key];
    const checklist = await prisma.workOrderChecklist.create({ data: { workOrderId: wo.id, isSubmitted: true, submittedAt: wo.submittedAt ?? new Date(), lastSavedAt: wo.submittedAt ?? new Date(), submittedLatitude: sites[wo.siteCode].latitude, submittedLongitude: sites[wo.siteCode].longitude } });
    const ratingsByItem: Record<string, RatingValue> = {};
    for (let ii = 0; ii < allItems.length; ii += 1) {
      const item = allItems[ii];
      const rating = ratingPattern[(wi + ii) % ratingPattern.length];
      ratingsByItem[item.id] = rating;
      await prisma.checklistResponse.create({
        data: {
          checklistId: checklist.id,
          itemId: item.id,
          rating,
          comment: rating === RatingValue.COMPLIANT ? 'Verified and confirmed compliant.' : rating === RatingValue.PARTIAL ? 'Partial compliance â€” follow-up required.' : 'Non-compliant. Contractor must rectify.',
          createdAt: wo.submittedAt ?? new Date(),
          updatedAt: wo.submittedAt ?? new Date(),
        },
      });
    }
    const score = Math.round(sectionDefs.reduce((sum, section) => sum + (section.items.reduce((s, id) => s + ratingPoints(ratingsByItem[id]), 0) / (section.items.length || 1)) * section.weight, 0) * 10) / 10;
    await prisma.workOrder.update({ where: { id: wo.id }, data: { overallScore: score, complianceBand: scoreBand(score) } });
  }
  console.log('? Created checklists + responses for 8 WOs');
  const evidencePlan = [
    ['IC1', 'HSE & Safety:1', EvidenceSource.CONTRACTOR, [0, 1]], ['IC1', 'HSE & Safety:2', EvidenceSource.CONTRACTOR, [2, 3]], ['IC1', 'HSE & Safety:1', EvidenceSource.INSPECTOR, [4]],
    ['IC2', 'Technical Installation:1', EvidenceSource.CONTRACTOR, [5]], ['IC2', 'Technical Installation:2', EvidenceSource.CONTRACTOR, [6, 7]], ['IC2', 'Technical Installation:1', EvidenceSource.INSPECTOR, [8]],
    ['IC3', 'Technical Installation:3', EvidenceSource.CONTRACTOR, [9, 10]], ['IC3', 'Technical Installation:3', EvidenceSource.INSPECTOR, [11]],
    ['S1', 'Technical Installation:5', EvidenceSource.CONTRACTOR, [12, 13]], ['S2', 'Technical Installation:4', EvidenceSource.CONTRACTOR, [14]], ['IP1', 'HSE & Safety:1', EvidenceSource.CONTRACTOR, [15, 16]],
    ['IC4', 'HSE & Safety:3', EvidenceSource.CONTRACTOR, [0, 1]], ['IC5', 'Technical Installation:6', EvidenceSource.CONTRACTOR, [3, 4]], ['IC6', 'Technical Installation:7', EvidenceSource.CONTRACTOR, [6, 7]],
    ['IC7', 'Process & Communication:1', EvidenceSource.CONTRACTOR, [9, 10]], ['IC8', 'Site Closure:1', EvidenceSource.CONTRACTOR, [0, 1]], ['S3', 'Site Closure:1', EvidenceSource.CONTRACTOR, [3]],
    ['S4', 'Process & Communication:2', EvidenceSource.CONTRACTOR, [4]], ['IP2', 'Technical Installation:1', EvidenceSource.CONTRACTOR, [5]], ['IP3', 'Technical Installation:2', EvidenceSource.CONTRACTOR, [6]],
  ] as const;
  for (const [woKey, itemKey, source, photoIndexes] of evidencePlan) {
    const wo = woMap[woKey];
    const site = sites[wo.siteCode];
    for (let i = 0; i < photoIndexes.length; i += 1) {
      const photo = photos[photoIndexes[i]];
      await prisma.evidence.create({
        data: {
          workOrderId: wo.id,
          checklistItemId: itemMap[itemKey].id,
          type: EvidenceType.PHOTO,
          source,
          s3Key: photo.key,
          s3Url: photo.url,
          s3Bucket: BUCKET,
          fileName: photo.fileName,
          fileSize: photo.fileSize,
          mimeType: 'image/jpeg',
          latitude: offset(site.latitude, i),
          longitude: offset(site.longitude, i),
          accuracy: 8 + i,
          locationDisplayName: `${site.location}, Oman`,
          locationShortName: `${site.name}, Oman`,
          locationCity: site.location.split(',')[0],
          locationSuburb: site.name,
          locationCountry: 'Oman',
          isLocationFlagged: false,
          locationDistance: 10 + i * 5,
          isConfirmed: true,
          capturedAt: wo.submittedAt ?? new Date(),
          uploadedAt: wo.submittedAt ?? new Date(),
        },
      });
    }
  }
  console.log('? Uploaded evidence records');

  const commentTargets = ['IP1', 'IP2', 'IP3', 'S1', 'S2', 'S3', 'S4'];
  const commentItems = ['HSE & Safety:1', 'HSE & Safety:2', 'Technical Installation:1', 'Technical Installation:3', 'Site Closure:1'];
  for (let wi = 0; wi < commentTargets.length; wi += 1) {
    const wo = woMap[commentTargets[wi]];
    for (let ci = 0; ci < 3; ci += 1) {
      await prisma.contractorItemComment.create({ data: { workOrderId: wo.id, checklistItemId: itemMap[commentItems[(wi + ci) % commentItems.length]].id, contractorId: wo.contractorId!, comment: commentSamples[(wi + ci) % commentSamples.length] } });
    }
  }
  console.log('? Created contractor comments');

  for (const key of completedKeys) {
    const wo = woMap[key];
    const spec = workOrders.find((entry) => entry.key === key)!;
    const adminId = users['admin@nama.om'].id;
    await prisma.auditLog.createMany({
      data: [
        { workOrderId: wo.id, userId: adminId, action: 'WORK_ORDER_CREATED', createdAt: dt(`${spec.date}T08:00:00Z`) ?? new Date() },
        { workOrderId: wo.id, userId: adminId, action: 'CONTRACTOR_ASSIGNED', createdAt: dt(spec.startedAt) ?? new Date(), newValue: { contractorId: wo.contractorId } as object },
        { workOrderId: wo.id, userId: adminId, action: 'INSPECTOR_ASSIGNED', createdAt: dt(spec.startedAt) ?? new Date(), newValue: { inspectorId: wo.inspectorId } as object },
        { workOrderId: wo.id, userId: adminId, action: 'WORK_ORDER_SUBMITTED', createdAt: wo.submittedAt ?? new Date(), newValue: { submittedAt: wo.submittedAt } as object },
        { workOrderId: wo.id, userId: wo.inspectorId, action: 'INSPECTION_COMPLETED', createdAt: dt(spec.approvedAt) ?? new Date() },
      ],
    });
  }
  for (const key of ['R1', 'R2', 'RO1', 'RO2']) {
    const wo = woMap[key];
    const spec = workOrders.find((entry) => entry.key === key)!;
    await prisma.auditLog.create({ data: { workOrderId: wo.id, userId: wo.inspectorId, action: 'WORK_ORDER_REJECTED', newValue: { rejectionReason: spec.rejectionReason } as object, createdAt: wo.submittedAt ?? new Date() } });
  }
  console.log('? Created audit logs');

  const accessRequests = [
    { requestId: 'REQ-20260308-001', role: 'CONTRACTOR', contactName: 'Hassan Al-Noor', email: contractors['CNT-001'].email, phone: '+968 9100 0001', companyName: contractors['CNT-001'].companyName, tradeLicense: 'TL-2024-001', crNumber: contractors['CNT-001'].crNumber, status: 'APPROVED', contractorId: contractors['CNT-001'].id, reviewNotes: 'Approved and contractor account activated.' },
    { requestId: 'REQ-20260308-002', role: 'REGULATOR', contactName: 'Salim Al-Wahaibi', email: 'regulator1@nama.om', phone: '+968 9200 1001', organisation: 'Authority for Public Services Regulation', department: 'Water Compliance', status: 'APPROVED', userId: users['regulator1@nama.om'].id, reviewNotes: 'Approved as regulator user.' },
    { requestId: 'REQ-20260308-003', role: 'CONTRACTOR', contactName: 'Rustam Al-Balushi', email: 'rustam@newcontractor.om', phone: '+968 9233 4455', companyName: 'Al Rustam Engineering', tradeLicense: 'TL-2025-011', crNumber: 'CR-2025-011', status: 'PENDING' },
    { requestId: 'REQ-20260308-004', role: 'REGULATOR', contactName: 'Zainab Al-Kindi', email: 'zainab@regulator.gov.om', phone: '+968 9244 5566', organisation: 'Ministry of Housing', department: 'Field Oversight', status: 'PENDING' },
    { requestId: 'REQ-20260308-005', role: 'CONTRACTOR', contactName: 'Unknown Applicant', email: 'unknown@test.com', phone: '+968 9255 6677', companyName: 'Unknown Works', tradeLicense: 'TL-2025-999', crNumber: 'CR-2025-999', status: 'REJECTED', reviewNotes: 'Incomplete documentation provided. Trade license could not be verified.' },
  ] as const;
  for (const req of accessRequests) {
    const ar = await prisma.accessRequest.create({
      data: {
        requestId: req.requestId,
        role: req.role as 'CONTRACTOR' | 'REGULATOR',
        contactName: req.contactName,
        email: req.email,
        phone: req.phone,
        companyName: 'companyName' in req ? req.companyName ?? null : null,
        tradeLicense: 'tradeLicense' in req ? req.tradeLicense ?? null : null,
        crNumber: 'crNumber' in req ? req.crNumber ?? null : null,
        organisation: 'organisation' in req ? req.organisation ?? null : null,
        department: 'department' in req ? req.department ?? null : null,
        status: req.status as 'PENDING' | 'APPROVED' | 'REJECTED',
        contractorId: 'contractorId' in req ? req.contractorId ?? null : null,
        userId: 'userId' in req ? req.userId ?? null : null,
        reviewedAt: req.status === 'PENDING' ? null : new Date('2026-03-01T10:00:00Z'),
        reviewNotes: 'reviewNotes' in req ? req.reviewNotes ?? null : null,
      },
    });
    const docs = req.role === 'CONTRACTOR' ? ['Trade License', 'CR Document'] : ['Government ID', 'Authorization Letter'];
    for (const name of docs) {
      await prisma.accessRequestDocument.create({ data: { accessRequestId: ar.id, name, status: req.status === 'APPROVED' ? 'VERIFIED' : req.status === 'REJECTED' ? 'REJECTED' : 'NOT_VERIFIED' } });
    }
  }
  console.log('? Created access requests');
  console.log('? Seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
