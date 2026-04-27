/**
 * Deletes all objects from Supabase storage that have no matching
 * record in the files table. Run after db:reset or whenever you
 * want to sync storage with the database.
 *
 * Usage: npm run storage:cleanup
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'nws-compliance'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const prisma = new PrismaClient()

async function listAllStorageObjects(): Promise<string[]> {
  const keys: string[] = []
  const folders = ['evidence-photo', 'report_pdf', 'access_request_doc', 'cr_document']

  for (const folder of folders) {
    let offset = 0
    const limit = 1000

    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } })

      if (error) {
        console.warn(`  ⚠ Could not list ${folder}/: ${error.message}`)
        break
      }
      if (!data || data.length === 0) break

      for (const item of data) {
        if (item.id) {
          // It's a file
          keys.push(`${folder}/${item.name}`)
        } else {
          // It's a sub-folder — list one level deeper
          const { data: sub, error: subErr } = await supabase.storage
            .from(BUCKET)
            .list(`${folder}/${item.name}`, { limit: 1000, offset: 0 })

          if (!subErr && sub) {
            for (const subItem of sub) {
              if (subItem.id) keys.push(`${folder}/${item.name}/${subItem.name}`)
            }
          }
        }
      }

      if (data.length < limit) break
      offset += limit
    }
  }

  return keys
}

async function main() {
  console.log(`🧹 Storage cleanup — bucket: ${BUCKET}\n`)

  // 1. Collect all keys from storage
  console.log('📦 Listing storage objects...')
  const storageKeys = await listAllStorageObjects()
  console.log(`   Found ${storageKeys.length} objects in storage\n`)

  if (storageKeys.length === 0) {
    console.log('✅ Storage is already empty.')
    return
  }

  // 2. Collect all s3Keys from DB
  console.log('🗄️  Fetching DB file records...')
  const dbFiles = await prisma.file.findMany({ select: { s3Key: true } })
  const dbKeySet = new Set(dbFiles.map(f => f.s3Key))
  console.log(`   Found ${dbFiles.length} file records in DB\n`)

  // 3. Find orphaned storage objects
  const orphaned = storageKeys.filter(k => !dbKeySet.has(k))
  console.log(`🔍 Orphaned objects (in storage, not in DB): ${orphaned.length}`)

  if (orphaned.length === 0) {
    console.log('\n✅ Storage is clean — no orphaned files found.')
    return
  }

  orphaned.forEach(k => console.log(`   - ${k}`))

  // 4. Delete in batches of 100 (Supabase limit)
  console.log('\n🗑️  Deleting orphaned objects...')
  const BATCH_SIZE = 100
  let deleted = 0

  for (let i = 0; i < orphaned.length; i += BATCH_SIZE) {
    const batch = orphaned.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error(`   ❌ Batch delete failed: ${error.message}`)
    } else {
      deleted += batch.length
      console.log(`   ✓ Deleted ${deleted}/${orphaned.length}`)
    }
  }

  console.log(`\n✅ Done — removed ${deleted} orphaned object(s) from storage.`)
}

main()
  .catch(e => { console.error('❌ Cleanup failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
