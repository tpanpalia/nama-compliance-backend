import { prisma } from '../../lib/prisma'
import path from 'path'
import PDFDocument from 'pdfkit'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportParams {
  reportType: 'performance-summary' | 'contractor-performance'
  regions?: string[]
  contractors?: string[]
  years: number[]
  months?: number[]
}

interface WorkOrderWithRelations {
  id: string
  contractorCr: string
  siteName: string
  status: string
  allocationDate: Date
  submissionDate: Date | null
  targetCompletionDate: Date
  contractor: { companyName: string; crNumber: string }
  assignedInspector: { staffProfile: { fullName: string } | null } | null
  governorate: { code: string; nameEn: string }
  inspection: {
    hseScore: unknown
    technicalScore: unknown
    processScore: unknown
    closureScore: unknown
    finalScore: unknown
    status: string
    submittedAt: Date | null
    responses: { checklistItemId: string; rating: string | null }[]
  } | null
  scoringWeights: {
    hsePercent: number
    technicalPercent: number
    processPercent: number
    closurePercent: number
  }
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#02474E',
  green: '#27AE60',
  orange: '#E67E22',
  red: '#C0392B',
  teal: '#02474E',
  darkText: '#333333',
  mediumText: '#666666',
  lightText: '#999999',
  border: '#DDDDDD',
  lightBg: '#F8F9FA',
  headerBg: '#02474E',
  headerText: '#FFFFFF',
  greenBg: '#E8F5E9',
  orangeBg: '#FFF3E0',
  redBg: '#FFEBEE',
}

function scoreColor(score: number): string {
  if (score >= 90) return COLORS.green
  if (score >= 75) return COLORS.orange
  return COLORS.red
}

function scoreBg(score: number): string {
  if (score >= 90) return COLORS.greenBg
  if (score >= 75) return COLORS.orangeBg
  return COLORS.redBg
}

function durationColor(days: number): string {
  if (days <= 7) return COLORS.green
  if (days <= 10) return COLORS.orange
  return COLORS.red
}

// ─── Score computation ──────────────────────────────────────────────────────

function ratingToScore(rating: string | null): number | null {
  if (!rating) return null
  if (rating === 'COMPLIANT') return 100
  if (rating === 'PARTIAL') return 50
  return 0 // NON_COMPLIANT
}

function computeCategoryScores(responses: { checklistItemId: string; rating: string | null }[]): {
  hse: number | null; technical: number | null; process: number | null; closure: number | null
} {
  const categories: Record<string, number[]> = { HSE: [], TECH: [], PROC: [], CLOSE: [] }

  for (const r of responses) {
    const score = ratingToScore(r.rating)
    if (score === null) continue
    const prefix = r.checklistItemId.split('-')[0]
    if (prefix === 'HSE') categories.HSE.push(score)
    else if (prefix === 'TECH') categories.TECH.push(score)
    else if (prefix === 'PROC') categories.PROC.push(score)
    else if (prefix === 'CLOSE') categories.CLOSE.push(score)
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  return {
    hse: avg(categories.HSE),
    technical: avg(categories.TECH),
    process: avg(categories.PROC),
    closure: avg(categories.CLOSE),
  }
}

function computeOverallScore(
  cats: { hse: number | null; technical: number | null; process: number | null; closure: number | null },
  weights: { hsePercent: number; technicalPercent: number; processPercent: number; closurePercent: number }
): number | null {
  const parts: { score: number; weight: number }[] = []
  if (cats.hse !== null) parts.push({ score: cats.hse, weight: weights.hsePercent })
  if (cats.technical !== null) parts.push({ score: cats.technical, weight: weights.technicalPercent })
  if (cats.process !== null) parts.push({ score: cats.process, weight: weights.processPercent })
  if (cats.closure !== null) parts.push({ score: cats.closure, weight: weights.closurePercent })

  if (parts.length === 0) return null
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
  if (totalWeight === 0) return null
  return parts.reduce((s, p) => s + (p.score * p.weight), 0) / totalWeight
}

// ─── PDF Drawing Helpers ────────────────────────────────────────────────────

const LOGO_PATH = path.resolve(__dirname, '../../assets/nama-logo.png')

function drawHeader(doc: PDFKit.PDFDocument, reportType: string): void {
  // Logo
  try {
    doc.image(LOGO_PATH, 40, 25, { height: 50 })
  } catch {
    // Logo not found, skip
  }

  // Company name
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.darkText)
    .text('NAMA WATER SERVICES', 110, 30, { lineBreak: false })

  // Report type subtitle
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.mediumText)
    .text(reportType, 110, 48, { lineBreak: false })

  // Right side - date & confidential
  const rightX = doc.page.width - 40 - 180
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.mediumText)
    .text(`Generated: ${today}`, rightX, 30, { align: 'right', width: 180, lineBreak: false })
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.mediumText)
    .text('CONFIDENTIAL', rightX, 42, { align: 'right', width: 180, lineBreak: false })

  // Red badge "INTERNAL USE ONLY"
  const badgeX = doc.page.width - 40 - 100
  doc.roundedRect(badgeX, 55, 100, 20, 3).fill(COLORS.red)
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
    .text('INTERNAL USE ONLY', badgeX, 60, { width: 100, align: 'center', lineBreak: false })

  // Color bar: red, orange, green, teal
  const barY = 82
  const barH = 4
  const segW = (doc.page.width - 80) / 4
  doc.rect(40, barY, segW, barH).fill(COLORS.red)
  doc.rect(40 + segW, barY, segW, barH).fill(COLORS.orange)
  doc.rect(40 + 2 * segW, barY, segW, barH).fill(COLORS.green)
  doc.rect(40 + 3 * segW, barY, segW, barH).fill(COLORS.teal)
}

function drawFooter(doc: PDFKit.PDFDocument, reportId: string, pageNum: number): void {
  const y = doc.page.height - 40
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText)
    .text('NAMA Water Services \u2014 Compliance Inspection System', 40, y, { lineBreak: false })
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText)
    .text(`Report ID: ${reportId}`, 40, y + 10, { lineBreak: false })
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText)
    .text(`Page ${pageNum}`, doc.page.width - 80, y, { width: 40, align: 'right', lineBreak: false })
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText)
    .text('\u00A9 2026 NAMA Water Services SAOC', doc.page.width - 200, y + 10, { width: 160, align: 'right', lineBreak: false })
}

function drawSectionHeader(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.rect(40, y, 4, 22).fill(COLORS.primary)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.darkText)
    .text(title, 52, y + 3, { lineBreak: false })
  return y + 35
}

function drawKPIBox(
  doc: PDFKit.PDFDocument, x: number, y: number, width: number,
  value: string, label: string, sublabel?: string, valueColor?: string
): void {
  doc.rect(x, y, width, 70).lineWidth(1).strokeColor(COLORS.border).stroke()
  doc.font('Helvetica-Bold').fontSize(22).fillColor(valueColor || COLORS.primary)
    .text(value, x, y + 12, { width, align: 'center', lineBreak: false })
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.mediumText)
    .text(label, x, y + 40, { width, align: 'center', lineBreak: false })
  if (sublabel) {
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText)
      .text(sublabel, x, y + 52, { width, align: 'center', lineBreak: false })
  }
}

function drawTableHeaderRow(
  doc: PDFKit.PDFDocument, y: number,
  columns: { text: string; x: number; width: number }[]
): number {
  const rowHeight = 22
  const totalWidth = columns[columns.length - 1].x + columns[columns.length - 1].width - columns[0].x
  doc.rect(columns[0].x, y, totalWidth, rowHeight).fill(COLORS.headerBg)

  for (const col of columns) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.headerText)
      .text(col.text, col.x + 4, y + 7, { width: col.width - 8, lineBreak: false })
  }
  return y + rowHeight
}

function drawTableRow(
  doc: PDFKit.PDFDocument, y: number,
  cells: { text: string; x: number; width: number; color?: string; bg?: string; bold?: boolean }[],
  isAlt = false
): number {
  const rowHeight = 22

  // Alternate row background
  if (isAlt) {
    const totalWidth = cells[cells.length - 1].x + cells[cells.length - 1].width - cells[0].x
    doc.rect(cells[0].x, y, totalWidth, rowHeight).fill(COLORS.lightBg)
  }

  for (const cell of cells) {
    if (cell.bg) {
      doc.roundedRect(cell.x + 2, y + 3, cell.width - 4, rowHeight - 6, 2).fill(cell.bg)
    }
    doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7.5)
      .fillColor(cell.color || COLORS.darkText)
      .text(cell.text, cell.x + 4, y + 6, { width: cell.width - 8, lineBreak: false })
  }

  // Bottom border
  doc.moveTo(cells[0].x, y + rowHeight)
    .lineTo(cells[cells.length - 1].x + cells[cells.length - 1].width, y + rowHeight)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke()

  return y + rowHeight
}

function drawHorizontalBar(
  doc: PDFKit.PDFDocument, x: number, y: number, maxWidth: number,
  value: number, label: string
): number {
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.darkText)
    .text(label, x, y + 2, { width: 120, lineBreak: false })

  const barX = x + 130
  const barWidth = maxWidth - 130 - 50
  const fillWidth = (value / 100) * barWidth

  doc.rect(barX, y + 1, barWidth, 14).fill('#EEEEEE')
  doc.rect(barX, y + 1, fillWidth, 14).fill(scoreColor(value))

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.darkText)
    .text(`${value.toFixed(1)}%`, barX + barWidth + 5, y + 2, { width: 45, lineBreak: false })

  return y + 22
}

// ─── Page Management ────────────────────────────────────────────────────────

function needsNewPage(doc: PDFKit.PDFDocument, y: number, requiredSpace: number): boolean {
  const bottomMargin = 60
  const maxY = doc.page.height - bottomMargin
  return y + requiredSpace > maxY
}

function addNewPage(
  doc: PDFKit.PDFDocument, reportType: string, reportId: string,
  pageCounter: { value: number }, isLandscape: boolean
): number {
  doc.addPage({ size: 'A4', layout: isLandscape ? 'landscape' : 'portrait', margin: 40 })
  pageCounter.value++
  drawHeader(doc, reportType)
  drawFooter(doc, reportId, pageCounter.value)
  return 100
}

// ─── Shared data computation ───────────────────────────────────────────────

interface WOScore {
  wo: WorkOrderWithRelations
  overall: number | null
  cats: ReturnType<typeof computeCategoryScores>
}

function computeAllScores(workOrders: WorkOrderWithRelations[]): WOScore[] {
  const results: WOScore[] = []
  for (const wo of workOrders) {
    if (wo.inspection && wo.inspection.responses.length > 0) {
      const cats = computeCategoryScores(wo.inspection.responses)
      const overall = computeOverallScore(cats, wo.scoringWeights)
      results.push({ wo, overall, cats })
    } else {
      results.push({ wo, overall: null, cats: { hse: null, technical: null, process: null, closure: null } })
    }
  }
  return results
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.substring(0, len - 1) + '..' : str
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ─── Performance Summary Report (Portrait A4) ─────────────────────────────

function generatePerformanceSummary(
  doc: PDFKit.PDFDocument, workOrders: WorkOrderWithRelations[],
  regionNames: string[], years: number[], months: number[],
  reportId: string, pageCounter: { value: number }
): void {
  const REPORT_TITLE = 'Performance Summary Report'
  const isLandscape = false

  // ── Compute aggregated data ──
  const woScores = computeAllScores(workOrders)

  const inspectedWOs = workOrders.filter(wo =>
    wo.inspection && wo.inspection.status === 'COMPLETED'
  )
  const pendingWOs = workOrders.filter(wo =>
    !wo.inspection || wo.inspection.status !== 'COMPLETED'
  )

  const scoredWOs = woScores.filter(ws => ws.overall !== null)
  const avgScore = scoredWOs.length > 0
    ? scoredWOs.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scoredWOs.length
    : 0

  // Contractor aggregation
  const contractorMap = new Map<string, { name: string; cr: string; wos: WOScore[]; total: number }>()
  for (const ws of woScores) {
    const cr = ws.wo.contractorCr
    if (!contractorMap.has(cr)) {
      contractorMap.set(cr, {
        name: ws.wo.contractor.companyName,
        cr,
        wos: [],
        total: workOrders.filter(w => w.contractorCr === cr).length,
      })
    }
    contractorMap.get(cr)!.wos.push(ws)
  }

  const contractors = Array.from(contractorMap.values()).map(c => {
    const scored = c.wos.filter(ws => ws.overall !== null)
    const avg = scored.length > 0 ? scored.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scored.length : 0
    const inspected = scored.length
    const pending = c.total - inspected
    return { ...c, avgScore: avg, inspected, pending }
  }).sort((a, b) => b.avgScore - a.avgScore)

  // Unique contractors
  const uniqueContractors = new Set(workOrders.map(w => w.contractorCr))

  // Overdue count (pending > 3 days past target)
  const now = new Date()
  const overdueCount = pendingWOs.filter(wo => {
    const target = new Date(wo.targetCompletionDate)
    const diff = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 3
  }).length

  // Month range label
  const monthRange = months.length > 0
    ? `${MONTH_NAMES[months[0] - 1]} - ${MONTH_NAMES[months[months.length - 1] - 1]}`
    : 'All Months'

  // ── PAGE 1 ──
  drawHeader(doc, REPORT_TITLE)
  drawFooter(doc, reportId, pageCounter.value)

  let y = 100

  // Title
  doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.primary)
    .text('Performance Summary Report', 40, y, { width: doc.page.width - 80, align: 'center', lineBreak: false })
  y += 30

  // Subtitle
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.mediumText)
    .text(
      `Region: ${regionNames.length > 0 ? regionNames.join(', ') : 'All Regions'} | Year: ${years.join(', ')} | Months: ${monthRange}`,
      40, y, { width: doc.page.width - 80, align: 'center', lineBreak: false }
    )
  y += 30

  // ── Executive Overview ──
  y = drawSectionHeader(doc, y, 'Executive Overview')

  const boxWidth = (doc.page.width - 80 - 30) / 4
  drawKPIBox(doc, 40, y, boxWidth,
    `${avgScore.toFixed(1)}%`, 'Avg Compliance Score', 'Target: 90%', scoreColor(avgScore))
  drawKPIBox(doc, 40 + boxWidth + 10, y, boxWidth,
    `${workOrders.length}`, 'Total Work Orders', `${inspectedWOs.length} Inspected, ${pendingWOs.length} Pending`)
  drawKPIBox(doc, 40 + 2 * (boxWidth + 10), y, boxWidth,
    `${uniqueContractors.size}`, 'Active Contractors')
  drawKPIBox(doc, 40 + 3 * (boxWidth + 10), y, boxWidth,
    `${pendingWOs.length}`, 'Pending Inspections', `${overdueCount} Overdue (>3 days)`)
  y += 85

  // ── Contractor Performance Ranking ──
  if (needsNewPage(doc, y, 60)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }
  y = drawSectionHeader(doc, y, 'Contractor Performance Ranking')

  const rankColumns = [
    { text: '#', x: 40, width: 30 },
    { text: 'Contractor', x: 70, width: 160 },
    { text: 'CR#', x: 230, width: 80 },
    { text: 'Work Orders', x: 310, width: 60 },
    { text: 'Avg Score', x: 370, width: 70 },
    { text: 'Inspected', x: 440, width: 60 },
    { text: 'Pending', x: 500, width: 60 },
  ]
  y = drawTableHeaderRow(doc, y, rankColumns)

  for (let i = 0; i < contractors.length; i++) {
    if (needsNewPage(doc, y, 22)) {
      y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
      y = drawTableHeaderRow(doc, y, rankColumns)
    }
    const c = contractors[i]
    y = drawTableRow(doc, y, [
      { text: `${i + 1}`, x: 40, width: 30 },
      { text: c.name, x: 70, width: 160, bold: true },
      { text: c.cr, x: 230, width: 80 },
      { text: `${c.total}`, x: 310, width: 60 },
      { text: `${c.avgScore.toFixed(1)}%`, x: 370, width: 70, color: scoreColor(c.avgScore), bg: scoreBg(c.avgScore), bold: true },
      { text: `${c.inspected}`, x: 440, width: 60 },
      { text: `${c.pending}`, x: 500, width: 60 },
    ], i % 2 === 1)
  }
  y += 15

  // ── Category-wise Compliance (All Contractors Average) ──
  if (needsNewPage(doc, y, 130)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }
  y = drawSectionHeader(doc, y, 'Category-wise Compliance (All Contractors Average)')

  const allCats = { hse: [] as number[], tech: [] as number[], process: [] as number[], closure: [] as number[] }
  for (const ws of scoredWOs) {
    if (ws.cats.hse !== null) allCats.hse.push(ws.cats.hse)
    if (ws.cats.technical !== null) allCats.tech.push(ws.cats.technical)
    if (ws.cats.process !== null) allCats.process.push(ws.cats.process)
    if (ws.cats.closure !== null) allCats.closure.push(ws.cats.closure)
  }
  const catAvg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  y = drawHorizontalBar(doc, 40, y, doc.page.width - 80, catAvg(allCats.hse), 'HSE & Safety')
  y = drawHorizontalBar(doc, 40, y, doc.page.width - 80, catAvg(allCats.tech), 'Technical Installation')
  y = drawHorizontalBar(doc, 40, y, doc.page.width - 80, catAvg(allCats.process), 'Process & Communication')
  y = drawHorizontalBar(doc, 40, y, doc.page.width - 80, catAvg(allCats.closure), 'Site Closure')
  y += 15

  // ── Score Distribution (All Inspected Work Orders) ──
  if (needsNewPage(doc, y, 130)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }
  y = drawSectionHeader(doc, y, 'Score Distribution (All Inspected Work Orders)')

  const buckets = [
    { label: '0-49%', min: 0, max: 49, count: 0, color: COLORS.red },
    { label: '50-74%', min: 50, max: 74, count: 0, color: COLORS.orange },
    { label: '75-89%', min: 75, max: 89, count: 0, color: COLORS.orange },
    { label: '90-100%', min: 90, max: 100, count: 0, color: COLORS.green },
  ]
  for (const ws of scoredWOs) {
    const s = ws.overall ?? 0
    for (const b of buckets) {
      if (s >= b.min && s <= b.max) { b.count++; break }
    }
  }
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  const barMaxWidth = doc.page.width - 80 - 130 - 50

  for (const bucket of buckets) {
    const barWidth = (bucket.count / maxCount) * barMaxWidth
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.darkText)
      .text(bucket.label, 40, y + 2, { width: 120, lineBreak: false })

    const barX = 170
    doc.rect(barX, y + 1, Math.max(barWidth, 2), 14).fill(bucket.color)

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.darkText)
      .text(`${bucket.count}`, barX + Math.max(barWidth, 2) + 8, y + 2, { width: 40, lineBreak: false })
    y += 22
  }
  y += 15

  // ── PAGE 2 ──
  y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)

  // ── Compliance Trend (Monthly Average) ──
  y = drawSectionHeader(doc, y, 'Compliance Trend (Monthly Average)')

  const trendColumns = [
    { text: 'Month', x: 40, width: 120 },
    { text: 'Work Orders', x: 160, width: 80 },
    { text: 'Avg Score', x: 240, width: 80 },
    { text: 'Inspected', x: 320, width: 80 },
  ]
  y = drawTableHeaderRow(doc, y, trendColumns)

  // Always show all 12 months
  for (let mi = 0; mi < 12; mi++) {
    const month = mi + 1
    const monthWOs = woScores.filter(ws => {
      const d = new Date(ws.wo.allocationDate)
      return d.getMonth() + 1 === month
    })
    const monthScored = monthWOs.filter(ws => ws.overall !== null)
    const monthAvg = monthScored.length > 0
      ? monthScored.reduce((s, ws) => s + (ws.overall ?? 0), 0) / monthScored.length
      : 0

    if (needsNewPage(doc, y, 22)) {
      y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
      y = drawTableHeaderRow(doc, y, trendColumns)
    }

    y = drawTableRow(doc, y, [
      { text: MONTH_FULL[mi], x: 40, width: 120 },
      { text: `${monthWOs.length}`, x: 160, width: 80 },
      {
        text: monthScored.length > 0 ? `${monthAvg.toFixed(1)}%` : '\u2014',
        x: 240, width: 80,
        color: monthScored.length > 0 ? scoreColor(monthAvg) : COLORS.lightText,
        bg: monthScored.length > 0 ? scoreBg(monthAvg) : undefined,
        bold: monthScored.length > 0,
      },
      { text: `${monthScored.length}`, x: 320, width: 80 },
    ], mi % 2 === 1)
  }
  y += 20

  // ── Per-Category Comparison by Contractor ──
  if (needsNewPage(doc, y, 60)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }
  y = drawSectionHeader(doc, y, 'Per-Category Comparison by Contractor')

  const catCompColumns = [
    { text: 'Contractor', x: 40, width: 150 },
    { text: 'HSE & Safety', x: 190, width: 90 },
    { text: 'Technical', x: 280, width: 90 },
    { text: 'Process', x: 370, width: 90 },
    { text: 'Closure', x: 460, width: 90 },
  ]
  y = drawTableHeaderRow(doc, y, catCompColumns)

  for (let i = 0; i < contractors.length; i++) {
    if (needsNewPage(doc, y, 22)) {
      y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
      y = drawTableHeaderRow(doc, y, catCompColumns)
    }
    const c = contractors[i]
    const cCats = { hse: [] as number[], tech: [] as number[], process: [] as number[], closure: [] as number[] }
    for (const ws of c.wos) {
      if (ws.cats.hse !== null) cCats.hse.push(ws.cats.hse)
      if (ws.cats.technical !== null) cCats.tech.push(ws.cats.technical)
      if (ws.cats.process !== null) cCats.process.push(ws.cats.process)
      if (ws.cats.closure !== null) cCats.closure.push(ws.cats.closure)
    }
    const hseAvg = catAvg(cCats.hse)
    const techAvg = catAvg(cCats.tech)
    const procAvg = catAvg(cCats.process)
    const closeAvg = catAvg(cCats.closure)

    y = drawTableRow(doc, y, [
      { text: c.name, x: 40, width: 150, bold: true },
      {
        text: cCats.hse.length > 0 ? `${hseAvg.toFixed(1)}%` : '\u2014',
        x: 190, width: 90,
        color: cCats.hse.length > 0 ? scoreColor(hseAvg) : COLORS.lightText,
        bg: cCats.hse.length > 0 ? scoreBg(hseAvg) : undefined,
      },
      {
        text: cCats.tech.length > 0 ? `${techAvg.toFixed(1)}%` : '\u2014',
        x: 280, width: 90,
        color: cCats.tech.length > 0 ? scoreColor(techAvg) : COLORS.lightText,
        bg: cCats.tech.length > 0 ? scoreBg(techAvg) : undefined,
      },
      {
        text: cCats.process.length > 0 ? `${procAvg.toFixed(1)}%` : '\u2014',
        x: 370, width: 90,
        color: cCats.process.length > 0 ? scoreColor(procAvg) : COLORS.lightText,
        bg: cCats.process.length > 0 ? scoreBg(procAvg) : undefined,
      },
      {
        text: cCats.closure.length > 0 ? `${closeAvg.toFixed(1)}%` : '\u2014',
        x: 460, width: 90,
        color: cCats.closure.length > 0 ? scoreColor(closeAvg) : COLORS.lightText,
        bg: cCats.closure.length > 0 ? scoreBg(closeAvg) : undefined,
      },
    ], i % 2 === 1)
  }
  y += 20

  // ── Lowest Scoring Checklist Items (All Contractors) ──
  if (needsNewPage(doc, y, 150)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }
  y = drawSectionHeader(doc, y, 'Lowest Scoring Checklist Items (All Contractors)')

  // Aggregate by checklist item
  const itemScores = new Map<string, number[]>()
  for (const ws of woScores) {
    if (!ws.wo.inspection) continue
    for (const r of ws.wo.inspection.responses) {
      const score = ratingToScore(r.rating)
      if (score === null) continue
      if (!itemScores.has(r.checklistItemId)) itemScores.set(r.checklistItemId, [])
      itemScores.get(r.checklistItemId)!.push(score)
    }
  }
  const lowestItems = Array.from(itemScores.entries())
    .map(([id, scores]) => ({ id, avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5)

  const lowestColumns = [
    { text: '#', x: 40, width: 30 },
    { text: 'Checklist Item', x: 70, width: 150 },
    { text: 'Avg Score', x: 220, width: 80 },
    { text: 'Responses', x: 300, width: 80 },
  ]
  y = drawTableHeaderRow(doc, y, lowestColumns)

  for (let i = 0; i < lowestItems.length; i++) {
    if (needsNewPage(doc, y, 22)) {
      y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
      y = drawTableHeaderRow(doc, y, lowestColumns)
    }
    const item = lowestItems[i]
    y = drawTableRow(doc, y, [
      { text: `${i + 1}`, x: 40, width: 30 },
      { text: item.id, x: 70, width: 150, bold: true },
      { text: `${item.avg.toFixed(1)}%`, x: 220, width: 80, color: scoreColor(item.avg), bg: scoreBg(item.avg), bold: true },
      { text: `${item.count}`, x: 300, width: 80 },
    ], i % 2 === 1)
  }
}

// ─── Contractor Performance Report (Landscape A4) ──────────────────────────

function generateContractorPerformance(
  doc: PDFKit.PDFDocument, workOrders: WorkOrderWithRelations[],
  years: number[], months: number[],
  reportId: string, pageCounter: { value: number }
): void {
  const REPORT_TITLE = 'Contractor Performance Report'
  const isLandscape = true

  // ── Compute scores ──
  const woScores = computeAllScores(workOrders)

  const inspectedWOs = workOrders.filter(wo => wo.inspection && wo.inspection.status === 'COMPLETED')
  const pendingWOs = workOrders.filter(wo => !wo.inspection || wo.inspection.status !== 'COMPLETED')
  const scoredWOs = woScores.filter(ws => ws.overall !== null)
  const avgScore = scoredWOs.length > 0
    ? scoredWOs.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scoredWOs.length
    : 0

  // Overdue
  const now = new Date()
  const overdueCount = pendingWOs.filter(wo => {
    const target = new Date(wo.targetCompletionDate)
    const diff = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 3
  }).length

  // Unique contractors
  const uniqueContractors = new Map<string, string>()
  for (const wo of workOrders) {
    uniqueContractors.set(wo.contractorCr, wo.contractor.companyName)
  }
  const crList = Array.from(uniqueContractors.keys()).join(', ')

  // Rework: WOs that were submitted then sent back (status IN_PROGRESS with a prior submission)
  const reworkCount = workOrders.filter(wo => wo.status === 'IN_PROGRESS' && wo.submissionDate !== null).length

  // ── Page 1 ──
  drawHeader(doc, REPORT_TITLE)
  drawFooter(doc, reportId, pageCounter.value)

  let y = 100

  // Title
  doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.primary)
    .text('Contractor Performance Report', 40, y, { width: doc.page.width - 80, align: 'center', lineBreak: false })
  y += 40

  // ── Overview KPIs (5 boxes) ──
  y = drawSectionHeader(doc, y, 'Overview')

  const boxWidth = (doc.page.width - 80 - 40) / 5
  drawKPIBox(doc, 40, y, boxWidth,
    `${avgScore.toFixed(1)}%`, 'Avg Compliance Score', 'Target: 90%', scoreColor(avgScore))
  drawKPIBox(doc, 40 + (boxWidth + 10), y, boxWidth,
    `${workOrders.length}`, 'Total Work Orders', `${inspectedWOs.length} Inspected, ${pendingWOs.length} Pending`)
  drawKPIBox(doc, 40 + 2 * (boxWidth + 10), y, boxWidth,
    `${uniqueContractors.size}`, 'Contractors', truncate(crList, 30))
  drawKPIBox(doc, 40 + 3 * (boxWidth + 10), y, boxWidth,
    `${pendingWOs.length}`, 'Pending Inspections', `${overdueCount} Overdue (>3 days)`)
  drawKPIBox(doc, 40 + 4 * (boxWidth + 10), y, boxWidth,
    `${reworkCount}`, 'Rework Orders', `${reworkCount} out of ${inspectedWOs.length} inspected`)
  y += 85

  // ── Work Order Details (flat table) ──
  y = drawSectionHeader(doc, y, 'Work Order Details')

  const columns = [
    { text: 'Work Order', x: 40, width: 65 },
    { text: 'Contractor', x: 105, width: 70 },
    { text: 'CR#', x: 175, width: 52 },
    { text: 'Site', x: 227, width: 60 },
    { text: 'Region', x: 287, width: 50 },
    { text: 'Status', x: 337, width: 55 },
    { text: 'Overall Score', x: 392, width: 48 },
    { text: 'HSE & Safety', x: 440, width: 44 },
    { text: 'Technical Install.', x: 484, width: 48 },
    { text: 'Process & Comm.', x: 532, width: 48 },
    { text: 'Site Closure', x: 580, width: 42 },
    { text: 'Rework', x: 622, width: 34 },
    { text: 'Duration (Days)', x: 656, width: 38 },
    { text: 'Inspector', x: 694, width: 55 },
    { text: 'Submitted', x: 749, width: 50 },
    { text: 'Inspected', x: 799, width: 50 },
  ]
  y = drawTableHeaderRow(doc, y, columns)

  for (let i = 0; i < woScores.length; i++) {
    if (needsNewPage(doc, y, 22)) {
      y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
      y = drawTableHeaderRow(doc, y, columns)
    }

    const ws = woScores[i]
    const wo = ws.wo
    const isInspected = wo.inspection !== null && wo.inspection.status === 'COMPLETED'
    const overall = ws.overall

    const inspectorName = wo.assignedInspector?.staffProfile?.fullName ?? '\u2014'

    // Dates
    const submittedDate = wo.submissionDate
      ? new Date(wo.submissionDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      : '\u2014'
    const inspectedDate = wo.inspection?.submittedAt
      ? new Date(wo.inspection.submittedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      : '\u2014'

    // Duration in days
    const startDate = new Date(wo.allocationDate)
    const endDate = wo.submissionDate ? new Date(wo.submissionDate) : new Date()
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Rework detection
    const isRework = wo.status === 'IN_PROGRESS' && wo.submissionDate !== null

    const formatScore = (s: number | null): string => {
      if (!isInspected || s === null) return '\u2014'
      return `${s.toFixed(0)}%`
    }
    const getScoreColor = (s: number | null): string => {
      if (!isInspected || s === null) return COLORS.lightText
      return scoreColor(s)
    }
    const getScoreBg = (s: number | null): string | undefined => {
      if (!isInspected || s === null) return undefined
      return scoreBg(s)
    }

    // Status color
    const statusColor = isInspected ? COLORS.green : COLORS.orange
    const statusText = isInspected ? 'INSPECTED' : 'SUBMITTED'

    y = drawTableRow(doc, y, [
      { text: truncate(wo.id, 9), x: 40, width: 65 },
      { text: truncate(wo.contractor.companyName, 10), x: 105, width: 70 },
      { text: wo.contractorCr, x: 175, width: 52 },
      { text: truncate(wo.siteName, 8), x: 227, width: 60 },
      { text: truncate(wo.governorate.nameEn, 7), x: 287, width: 50 },
      { text: statusText, x: 337, width: 55, color: statusColor, bold: true },
      { text: formatScore(overall), x: 392, width: 48, color: getScoreColor(overall), bg: getScoreBg(overall), bold: true },
      { text: formatScore(ws.cats.hse), x: 440, width: 44, color: getScoreColor(ws.cats.hse), bg: getScoreBg(ws.cats.hse) },
      { text: formatScore(ws.cats.technical), x: 484, width: 48, color: getScoreColor(ws.cats.technical), bg: getScoreBg(ws.cats.technical) },
      { text: formatScore(ws.cats.process), x: 532, width: 48, color: getScoreColor(ws.cats.process), bg: getScoreBg(ws.cats.process) },
      { text: formatScore(ws.cats.closure), x: 580, width: 42, color: getScoreColor(ws.cats.closure), bg: getScoreBg(ws.cats.closure) },
      { text: isRework ? 'Yes' : 'No', x: 622, width: 34, color: isRework ? COLORS.red : COLORS.green, bold: true },
      { text: `${durationDays}`, x: 656, width: 38, color: durationColor(durationDays) },
      { text: truncate(inspectorName, 8), x: 694, width: 55 },
      { text: submittedDate, x: 749, width: 50 },
      { text: inspectedDate, x: 799, width: 50 },
    ], i % 2 === 1)
  }

  // ── Legend ──
  y += 20
  if (needsNewPage(doc, y, 80)) {
    y = addNewPage(doc, REPORT_TITLE, reportId, pageCounter, isLandscape)
  }

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.darkText)
    .text('Legend:', 40, y, { lineBreak: false })
  y += 16

  // Score color key
  const legendScores = [
    { color: COLORS.greenBg, textColor: COLORS.green, label: 'Score >= 90% (Excellent)' },
    { color: COLORS.orangeBg, textColor: COLORS.orange, label: 'Score 75-89% (Needs Improvement)' },
    { color: COLORS.redBg, textColor: COLORS.red, label: 'Score < 75% (Critical)' },
  ]
  for (const item of legendScores) {
    doc.rect(40, y, 12, 10).fill(item.color)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.darkText)
      .text(item.label, 58, y + 1, { lineBreak: false })
    y += 14
  }

  y += 6

  // Duration key
  const legendDuration = [
    { color: COLORS.green, label: 'Duration <= 7 days (On Time)' },
    { color: COLORS.orange, label: 'Duration 8-10 days (Delayed)' },
    { color: COLORS.red, label: 'Duration > 10 days (Critical Delay)' },
  ]
  for (const item of legendDuration) {
    doc.rect(40, y, 12, 10).fill(item.color)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.darkText)
      .text(item.label, 58, y + 1, { lineBreak: false })
    y += 14
  }

  y += 6
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.mediumText)
    .text('Yellow rows = Pending | Red rows = Below 85%', 40, y, { lineBreak: false })
}

// ─── Main Export ────────────────────────────────────────────────────────────

export async function generateReport(params: ReportParams): Promise<Buffer> {
  const { reportType, regions, contractors, years, months } = params
  const governorateCodes = regions ?? []
  const contractorCrs = contractors ?? []
  const activeMonths = months ?? []

  // Build date filter
  const startMonth = activeMonths.length ? String(Math.min(...activeMonths)).padStart(2, '0') : '01'
  const endMonth = activeMonths.length ? String(Math.max(...activeMonths)).padStart(2, '0') : '12'
  const startYear = Math.min(...years)
  const endYear = Math.max(...years)

  // Query work orders
  const workOrders = await prisma.workOrder.findMany({
    where: {
      ...(governorateCodes.length > 0 ? { governorateCode: { in: governorateCodes } } : {}),
      ...(contractorCrs.length > 0 ? { contractorCr: { in: contractorCrs } } : {}),
      allocationDate: {
        gte: new Date(`${startYear}-${startMonth}-01`),
        lte: new Date(`${endYear}-${endMonth}-31`),
      },
    },
    include: {
      contractor: true,
      assignedInspector: { include: { staffProfile: { select: { fullName: true } } } },
      governorate: true,
      inspection: { include: { responses: true } },
      scoringWeights: true,
    },
    orderBy: { allocationDate: 'desc' },
  }) as unknown as WorkOrderWithRelations[]

  // Fetch governorate names for region labels
  let regionNames: string[] = []
  if (governorateCodes.length > 0) {
    const govs = await prisma.governorate.findMany({
      where: { code: { in: governorateCodes } },
      select: { nameEn: true },
    })
    regionNames = govs.map(g => g.nameEn)
  }

  const isLandscape = reportType === 'contractor-performance'
  const reportId = `RPT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-001`
  const pageCounter = { value: 1 }

  const doc = new PDFDocument({
    size: 'A4',
    layout: isLandscape ? 'landscape' : 'portrait',
    margin: 40,
    bufferPages: true,
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  if (reportType === 'performance-summary') {
    generatePerformanceSummary(doc, workOrders, regionNames, years, activeMonths, reportId, pageCounter)
  } else {
    generateContractorPerformance(doc, workOrders, years, activeMonths, reportId, pageCounter)
  }

  doc.end()
  return finished
}
