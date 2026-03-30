import dotenv from 'dotenv'
import path from 'path'

// Load environment-specific .env file before anything else
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(process.cwd(), `.env.${env}`) })

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export const config = {
  env,
  port: parseInt(optional('PORT', '3000'), 10),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),

  db: {
    url: required('DATABASE_URL'),
    directUrl: optional('DIRECT_URL'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '24h'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  storage: {
    provider: optional('STORAGE_PROVIDER', 'supabase') as 'supabase' | 's3',
    supabase: {
      url: optional('SUPABASE_URL'),
      serviceKey: optional('SUPABASE_SERVICE_KEY'),
      bucket: optional('SUPABASE_STORAGE_BUCKET', 'nws-compliance'),
    },
    s3: {
      region: optional('AWS_REGION', 'me-south-1'),
      accessKeyId: optional('AWS_ACCESS_KEY_ID'),
      secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
      bucket: optional('AWS_S3_BUCKET'),
    },
  },
} as const
