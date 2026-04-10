/**
 * Uploads sample placeholder images to Supabase storage.
 * Creates file records in the DB that seed-data.ts can reuse.
 *
 * Run ONCE before seed-data.ts:
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

// Generate a simple colored JPEG-like image buffer (valid minimal JPEG)
function createPlaceholderImage(label: string): Buffer {
  // Minimal valid JPEG (1x1 pixel, ~631 bytes) — browsers will render it
  const base64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRFJiXEVGV0ZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+gD/2Q=='
  return Buffer.from(base64, 'base64')
}

const SAMPLE_COUNT = 10
const SAMPLE_LABELS = [
  'PPE Compliance', 'Equipment Check', 'HSE Standards',
  'Excavation Works', 'Warning Tape', 'Sand Bedding',
  'Pipeline Flushing', 'Marker Posts', 'Site Notification',
  'Site Closure',
]

async function main() {
  console.log('📸 Uploading sample images to Supabase...\n')

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
  if (!adminUser) { console.error('No admin user found. Run seed.ts first.'); process.exit(1) }

  // Check if sample files already exist
  const existing = await prisma.file.count({ where: { s3Key: { startsWith: 'sample/' } } })
  if (existing >= SAMPLE_COUNT) {
    console.log(`   ✓ ${existing} sample images already exist, skipping upload\n`)
    return
  }

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const label = SAMPLE_LABELS[i]
    const s3Key = `sample/evidence-${i.toString().padStart(3, '0')}.jpg`
    const imageBuffer = createPlaceholderImage(label)

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(s3Key, imageBuffer, { contentType: 'image/jpeg', upsert: true })

    if (error) {
      console.error(`   ✗ Failed to upload ${s3Key}: ${error.message}`)
      continue
    }

    // Create file record in DB
    await prisma.file.create({
      data: {
        bucket: BUCKET,
        s3Key,
        mimeType: 'image/jpeg',
        category: 'EVIDENCE_PHOTO',
        uploadStatus: 'UPLOADED',
        fileSize: BigInt(imageBuffer.length),
        uploadedBy: adminUser.id,
      },
    })

    console.log(`   ✓ Uploaded ${label} → ${s3Key}`)
  }

  const totalFiles = await prisma.file.count({ where: { s3Key: { startsWith: 'sample/' } } })
  console.log(`\n✅ ${totalFiles} sample images ready in Supabase storage`)
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
