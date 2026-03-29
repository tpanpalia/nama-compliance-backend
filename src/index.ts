// Must be first — loads .env.{NODE_ENV} before any other imports
import './config'

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'
import { config } from './config'
import routes from './routes/index'
import { errorHandler } from './middleware/errorHandler'

const app = express()

// ── Security & parsing ────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin:      config.corsOrigin,
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: config.env, ts: new Date().toISOString() })
})

// ── Swagger UI ────────────────────────────────────────────
const swaggerDoc = yaml.load(
  fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8')
) as object
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))

// ── API routes ────────────────────────────────────────────
app.use('/api', routes)

// ── 404 handler ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ── Global error handler (must be last) ───────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`[${config.env}] Server running on port ${config.port}`)
})

export default app
