// Must be first — loads .env.{NODE_ENV} before any other imports
import './config'

// BigInt → JSON serialisation (Prisma returns BigInt for large int columns)
;(BigInt.prototype as any).toJSON = function () { return Number(this) }

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'
import { config } from './config'
import routes from './routes/index'
import { errorHandler } from './middleware/errorHandler'

const app = express()

// ── Security & parsing ────────────────────────────────────
// Strict CSP for API routes (JSON-only, no HTML)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'none'"],
      scriptSrc:   ["'none'"],
      styleSrc:    ["'none'"],
      imgSrc:      ["'none'"],
      connectSrc:  ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))
app.use(cors({
  origin:      config.corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── Rate limiting ────────────────────────────────────────
// General API: 100 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}))
// Auth endpoints: stricter — 15 requests per minute per IP
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
}))

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: config.env, ts: new Date().toISOString() })
})

// ── Swagger UI ────────────────────────────────────────────
// Try multiple paths: works locally (process.cwd) and on Vercel (__dirname)
const docsCandidates = [
  path.join(process.cwd(), 'docs/openapi.yaml'),
  path.join(__dirname, '../docs/openapi.yaml'),
  path.join(__dirname, '../../docs/openapi.yaml'),
]
const docsPath = docsCandidates.find((p) => fs.existsSync(p))
if (docsPath) {
  const swaggerDoc = yaml.load(fs.readFileSync(docsPath, 'utf8')) as object
  // Relaxed CSP only for Swagger UI (serves HTML with inline scripts/styles)
  const swaggerCsp = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'", "https:"],
    },
  })
  app.use('/api/docs', swaggerCsp, swaggerUi.serve, swaggerUi.setup(swaggerDoc))
}

// ── API routes ────────────────────────────────────────────
app.use('/api', routes)

// ── 404 handler ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Global error handler (must be last) ───────────────────
app.use(errorHandler)

// ── Start (only when running directly, not in serverless) ─
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`[${config.env}] Server running on port ${config.port}`)
  })
}

export default app
