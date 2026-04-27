import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const env = process.env.NODE_ENV || 'development'
const envPath = path.resolve(process.cwd(), `.env.${env}`)
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true })

const prisma = new PrismaClient()
const FUNCTIONS_DIR = path.resolve(process.cwd(), 'database/functions')

async function main() {
  const files = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  console.log(`📦 Applying ${files.length} database functions...\n`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8')
    await prisma.$executeRawUnsafe(sql)
    console.log(`  ✓ ${file}`)
  }

  console.log('\n✅ All database functions applied.')
}

main()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
