/**
 * Creates file records in the DB pointing to real photos already in Supabase storage.
 * Uses existing evidence_photo/ files directly — no copying or placeholders.
 *
 * Run ONCE before seed-data.ts or repopulate-evidence.ts:
 *   npx ts-node scripts/upload-sample-images.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false })

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'nws-compliance'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  console.log('📸 Setting up evidence file records from real Supabase photos...\n')

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
  if (!adminUser) { console.error('No admin user found. Run seed.ts first.'); process.exit(1) }

  // Check if we already have enough seed file records
  const existing = await prisma.file.count({ where: { s3Key: { startsWith: 'evidence_photo/' }, uploadStatus: 'UPLOADED', category: 'EVIDENCE_PHOTO' } })

  // List real photos from evidence_photo/ in Supabase storage
  console.log('📂 Listing photos from evidence_photo/ in Supabase storage...')
  const allStorageFiles: { name: string; metadata: any }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('evidence_photo', { limit: 100, offset, sortBy: { column: 'created_at', order: 'desc' } })
    if (error || !data || data.length === 0) break
    allStorageFiles.push(...(data as any[]))
    offset += data.length
    if (data.length < 100) break
  }

  // Filter to image files only
  const imageFiles = allStorageFiles.filter(f =>
    f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png')
  )

  console.log(`   Found ${imageFiles.length} real photos in storage`)
  console.log(`   ${existing} file records already exist in DB`)

  // Find which files already have DB records
  const existingKeys = new Set(
    (await prisma.file.findMany({
      where: { s3Key: { startsWith: 'evidence_photo/' } },
      select: { s3Key: true },
    })).map(f => f.s3Key)
  )

  let created = 0
  for (const file of imageFiles) {
    const s3Key = `evidence_photo/${file.name}`
    if (existingKeys.has(s3Key)) continue

    const mimeType = file.name.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const fileSize = file.metadata?.size ? BigInt(file.metadata.size) : undefined

    await prisma.file.create({
      data: {
        bucket: BUCKET,
        s3Key,
        mimeType,
        category: 'EVIDENCE_PHOTO',
        uploadStatus: 'UPLOADED',
        fileSize,
        uploadedBy: adminUser.id,
      },
    })
    created++
  }

  const totalFiles = await prisma.file.count({ where: { s3Key: { startsWith: 'evidence_photo/' }, uploadStatus: 'UPLOADED' } })
  console.log(`\n✅ Created ${created} new file records (${totalFiles} total evidence_photo files in DB)`)
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
