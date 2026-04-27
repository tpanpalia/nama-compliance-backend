import { prisma } from '../../lib/prisma'
import path from 'path'
import fs from 'fs'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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
    hseScore: unknown; technicalScore: unknown; processScore: unknown; closureScore: unknown; finalScore: unknown
    status: string; submittedAt: Date | null
    responses: { checklistItemId: string; rating: string | null }[]
  } | null
  scoringWeights: { hsePercent: number; technicalPercent: number; processPercent: number; closurePercent: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ratingToScore(rating: string | null): number | null {
  if (!rating) return null
  return rating === 'COMPLIANT' ? 100 : rating === 'PARTIAL' ? 50 : 0
}

function computeCategoryScores(responses: { checklistItemId: string; rating: string | null }[]) {
  const cats: Record<string, number[]> = { HSE: [], TECH: [], PROC: [], CLOSE: [] }
  for (const r of responses) {
    const s = ratingToScore(r.rating); if (s === null) continue
    const p = r.checklistItemId.split('-')[0]; if (cats[p]) cats[p].push(s)
  }
  const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
  return { hse: avg(cats.HSE), technical: avg(cats.TECH), process: avg(cats.PROC), closure: avg(cats.CLOSE) }
}

function computeOverallScore(cats: ReturnType<typeof computeCategoryScores>, w: WorkOrderWithRelations['scoringWeights']): number | null {
  const parts: { s: number; w: number }[] = []
  if (cats.hse !== null) parts.push({ s: cats.hse, w: w.hsePercent })
  if (cats.technical !== null) parts.push({ s: cats.technical, w: w.technicalPercent })
  if (cats.process !== null) parts.push({ s: cats.process, w: w.processPercent })
  if (cats.closure !== null) parts.push({ s: cats.closure, w: w.closurePercent })
  if (!parts.length) return null
  const tw = parts.reduce((a, p) => a + p.w, 0); if (!tw) return null
  return parts.reduce((a, p) => a + (p.s * p.w), 0) / tw
}

function isInspected(wo: WorkOrderWithRelations): boolean { return wo.inspection?.status === 'SUBMITTED' }
function scoreColor(s: number): string { return s >= 90 ? '#27AE60' : s >= 75 ? '#E67E22' : '#C0392B' }
function scoreBg(s: number): string { return s >= 90 ? '#E8F5E9' : s >= 75 ? '#FFF3E0' : '#FFEBEE' }
function durationColor(d: number): string { return d <= 7 ? '#27AE60' : d <= 10 ? '#E67E22' : '#C0392B' }
function fmtDate(d: Date | null | string): string { if (!d) return '\u2014'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) }
const catAvg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const CATEGORY_LABELS: Record<string, string> = { HSE: 'HSE & Safety', TECH: 'Technical Installation', PROC: 'Process & Communication', CLOSE: 'Site Closure', TECHNICAL: 'Technical Installation', PROCESS: 'Process & Communication', CLOSURE: 'Site Closure' }

interface WOScore { wo: WorkOrderWithRelations; overall: number | null; cats: ReturnType<typeof computeCategoryScores> }
function computeAllScores(wos: WorkOrderWithRelations[]): WOScore[] {
  return wos.map(wo => {
    if (wo.inspection && wo.inspection.status === 'SUBMITTED' && wo.inspection.finalScore != null) {
      // Use stored scores from DB (calculated with proper weights at submission time)
      return {
        wo,
        overall: Number(wo.inspection.finalScore),
        cats: {
          hse: wo.inspection.hseScore != null ? Number(wo.inspection.hseScore) : null,
          technical: wo.inspection.technicalScore != null ? Number(wo.inspection.technicalScore) : null,
          process: wo.inspection.processScore != null ? Number(wo.inspection.processScore) : null,
          closure: wo.inspection.closureScore != null ? Number(wo.inspection.closureScore) : null,
        },
      }
    }
    return { wo, overall: null, cats: { hse: null, technical: null, process: null, closure: null } }
  })
}

// ─── Logo ───────────────────────────────────────────────────────────────────

function getLogoBase64(): string {
  try { return `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../assets/nama-logo.png')).toString('base64')}` } catch { return '' }
}

// ─── SVG Helpers ────────────────────────────────────────────────────────────

function lineChartSVG(data: { label: string; value: number | null }[], targetLine: number): string {
  const W = 680, H = 220, PAD_L = 45, PAD_R = 30, PAD_T = 30, PAD_B = 35
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
  const points = data.filter(d => d.value !== null) as { label: string; value: number }[]
  if (points.length === 0) return '<p style="color:#999;font-style:italic;text-align:center">No trend data available</p>'

  const minY = Math.min(70, ...points.map(p => p.value)) - 2
  const maxY = Math.max(100, ...points.map(p => p.value)) + 2
  const yRange = maxY - minY
  const xStep = chartW / (data.length - 1 || 1)
  const toX = (i: number) => PAD_L + i * xStep
  const toY = (v: number) => PAD_T + chartH - ((v - minY) / yRange) * chartH

  // Grid lines
  const gridYs = [minY, minY + yRange * 0.25, minY + yRange * 0.5, minY + yRange * 0.75, maxY].map(v => Math.round(v))
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto">`

  // Grid
  for (const gy of gridYs) {
    const y = toY(gy)
    svg += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`
    svg += `<text x="${PAD_L - 5}" y="${y + 3}" text-anchor="end" font-size="8" fill="#6b7280">${gy}%</text>`
  }

  // Target line
  const targetY = toY(targetLine)
  svg += `<line x1="${PAD_L}" y1="${targetY}" x2="${W - PAD_R}" y2="${targetY}" stroke="#27AE60" stroke-width="1.5" stroke-dasharray="6,4"/>`
  svg += `<text x="${W - PAD_R + 3}" y="${targetY + 3}" font-size="7" fill="#27AE60">Target ${targetLine}%</text>`

  // X labels
  data.forEach((d, i) => {
    svg += `<text x="${toX(i)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="#6b7280">${d.label}</text>`
  })

  // Line + dots
  const validIdxs = data.map((d, i) => d.value !== null ? i : -1).filter(i => i >= 0)
  if (validIdxs.length > 1) {
    const pathD = validIdxs.map((idx, j) => `${j === 0 ? 'M' : 'L'}${toX(idx).toFixed(1)},${toY(data[idx].value!).toFixed(1)}`).join(' ')
    svg += `<path d="${pathD}" stroke="#02474E" stroke-width="2.5" fill="none"/>`
  }
  for (const idx of validIdxs) {
    const x = toX(idx), y = toY(data[idx].value!)
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="#02474E"/>`
    svg += `<text x="${x}" y="${y - 8}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#02474E">${data[idx].value!.toFixed(2)}%</text>`
  }

  svg += '</svg>'
  return svg
}

function verticalBarChartSVG(buckets: { label: string; count: number; color: string }[]): string {
  const W = 520, H = 200, PAD_L = 20, PAD_R = 20, PAD_T = 30, PAD_B = 30
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
  const maxVal = Math.max(...buckets.map(b => b.count), 1)
  const barW = chartW / buckets.length * 0.6
  const gap = chartW / buckets.length

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto">`

  buckets.forEach((b, i) => {
    const x = PAD_L + i * gap + (gap - barW) / 2
    const barH = (b.count / maxVal) * chartH
    const y = PAD_T + chartH - barH

    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${b.color}" rx="3"/>`
    svg += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">${b.count}</text>`
    svg += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" font-size="7.5" fill="#666">${b.label}</text>`
  })

  svg += '</svg>'
  return svg
}

// ─── Shared HTML Parts ──────────────────────────────────────────────────────

function scoreCell(score: number | null, ins: boolean): string {
  if (!ins || score === null) return '<span style="color:#999">\u2014</span>'
  return `<span style="background:${scoreBg(score)};color:${scoreColor(score)};font-weight:700;padding:2px 6px;border-radius:3px;display:inline-block;min-width:40px;text-align:center">${score.toFixed(2)}%</span>`
}

function headerHTML(reportType: string, logo: string): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
    <div style="display:flex;align-items:center;gap:12px">
      ${logo ? `<img src="${logo}" style="height:50px"/>` : ''}
      <div><div style="font-size:14pt;font-weight:700;color:#333">NAMA WATER SERVICES</div><div style="font-size:8pt;color:#666">${reportType}</div></div>
    </div>
    <div style="text-align:right;font-size:7.5pt;color:#666">Generated: ${today}<br>CONFIDENTIAL<br><span style="display:inline-block;background:#C0392B;color:#fff;font-size:7pt;font-weight:700;padding:3px 10px;border-radius:3px;margin-top:3px">INTERNAL USE ONLY</span></div>
  </div>
  <div style="height:4px;display:flex;margin-bottom:16px"><div style="flex:1;background:#C0392B"></div><div style="flex:1;background:#E67E22"></div><div style="flex:1;background:#27AE60"></div><div style="flex:1;background:#02474E"></div></div>`
}

function sectionHeader(title: string): string {
  return `<div style="display:flex;align-items:center;margin:16px 0 8px;background:#EBF5F7;border-left:4px solid #02474E;padding:8px 12px;border-radius:0 3px 3px 0"><div style="font-size:13pt;font-weight:700;color:#02474E">${title}</div></div>`
}

function kpiBox(value: string, label: string, sub?: string, color?: string, topColor?: string): string {
  return `<div style="flex:1;border:1px solid #ddd;border-top:8px solid ${topColor || '#02474E'};border-radius:0 0 6px 6px;padding:12px 6px;text-align:center">
    <div style="font-size:22pt;font-weight:700;color:${color || '#02474E'}">${value}</div>
    <div style="font-size:7.5pt;color:#666;margin-top:4px">${label}</div>
    ${sub ? `<div style="font-size:6.5pt;color:#999;margin-top:2px">${sub}</div>` : ''}
  </div>`
}

function horizontalBar(label: string, value: number): string {
  return `<div style="display:flex;align-items:center;margin-bottom:5px">
    <div style="width:170px;font-size:9pt">${label}</div>
    <div style="flex:1;height:18px;background:#eee;border-radius:3px;overflow:hidden;margin-right:8px"><div style="height:100%;width:${Math.min(value, 100)}%;background:${scoreColor(value)};border-radius:3px"></div></div>
    <div style="width:50px;font-size:9pt;font-weight:700;text-align:right;color:${scoreColor(value)}">${value.toFixed(2)}%</div>
  </div>`
}

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size:9pt; color:#333; line-height:1.4; padding:0 }
  .page-break { page-break-before:always }
  .avoid-break { page-break-inside:avoid }
  table { width:calc(100% - 84px); border-collapse:collapse; font-size:8pt; margin:0 48px 6px 36px; border:1px solid #ddd }
  th { background:#02474E; color:#fff; font-weight:600; padding:6px 5px; text-align:center; font-size:7.5pt; border-right:1px solid rgba(255,255,255,0.2) }
  th:first-child { text-align:left }
  td { padding:5px; border-bottom:1px solid #ddd; border-right:1px solid #ddd; vertical-align:middle; text-align:center; word-break:keep-all; white-space:nowrap }
  tr { page-break-inside:avoid; break-inside:avoid }
  td:first-child { text-align:left }
  tr:nth-child(odd) { background:#f7f7f7 }
  tr.row-pending { background:#FFFDE7 !important }
  tr.row-low { background:#FFEBEE !important }
  .note { font-size:7pt; color:#999; font-style:italic; margin:3px 0 10px }
  .kpi-wrap { display:flex; gap:0; margin-bottom:16px; margin-left:4px }
  .kpi-wrap > div + div { border-left:none }
`

// ─── Performance Summary HTML ───────────────────────────────────────────────

function generatePerformanceSummaryHTML(
  workOrders: WorkOrderWithRelations[], regionNames: string[],
  years: number[], months: number[], logo: string,
  checklistItemMap: Map<string, { question: string; category: string }>,
  cachedScores: Map<string, { avgScore: number | null; totalInspections: number }>
): string {
  const woScores = computeAllScores(workOrders)
  const inspectedWOs = workOrders.filter(wo => wo.status === 'INSPECTION_COMPLETED')
  const pendingWOs = workOrders.filter(wo => ['SUBMITTED', 'PENDING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'OVERDUE'].includes(wo.status))
  const scoredWOs = woScores.filter(ws => ws.overall !== null)

  // WO-level average for KPI box (matches dashboard)
  const avgScore = scoredWOs.length > 0 ? scoredWOs.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scoredWOs.length : 0

  const contractorMap = new Map<string, { name: string; cr: string; wos: WOScore[]; total: number }>()
  for (const ws of woScores) {
    const cr = ws.wo.contractorCr
    if (!contractorMap.has(cr)) contractorMap.set(cr, { name: ws.wo.contractor.companyName, cr, wos: [], total: workOrders.filter(w => w.contractorCr === cr).length })
    contractorMap.get(cr)!.wos.push(ws)
  }
  const contractors = Array.from(contractorMap.values()).map(c => {
    const scored = c.wos.filter(ws => ws.overall !== null)
    const periodAvg = scored.length > 0 ? scored.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scored.length : 0
    return { ...c, avgScore: periodAvg, periodAvg, inspected: scored.length, pending: c.total - scored.length }
  }).sort((a, b) => b.avgScore - a.avgScore)

  const uniqueContractors = new Set(workOrders.map(w => w.contractorCr))
  const now = new Date()
  const overdueCount = pendingWOs.filter(wo => (now.getTime() - new Date(wo.targetCompletionDate).getTime()) / 86400000 > 3).length
  const monthRange = months.length > 0 ? `${MONTH_NAMES[months[0] - 1]} \u2013 ${MONTH_NAMES[months[months.length - 1] - 1]}` : 'All Months'

  // Category averages
  const allCats = { hse: [] as number[], tech: [] as number[], process: [] as number[], closure: [] as number[] }
  for (const ws of scoredWOs) {
    if (ws.cats.hse !== null) allCats.hse.push(ws.cats.hse)
    if (ws.cats.technical !== null) allCats.tech.push(ws.cats.technical)
    if (ws.cats.process !== null) allCats.process.push(ws.cats.process)
    if (ws.cats.closure !== null) allCats.closure.push(ws.cats.closure)
  }
  const catScores = [
    { name: 'Site Closure', score: catAvg(allCats.closure) }, { name: 'Technical Installation', score: catAvg(allCats.tech) },
    { name: 'HSE & Safety', score: catAvg(allCats.hse) }, { name: 'Process & Communication', score: catAvg(allCats.process) },
  ].sort((a, b) => a.score - b.score)

  // Score distribution buckets
  const buckets = [
    { label: '< 75%', min: 0, max: 74.9, count: 0, color: '#C0392B' },
    { label: '75-79%', min: 75, max: 79.9, count: 0, color: '#E67E22' },
    { label: '80-84%', min: 80, max: 84.9, count: 0, color: '#F0C040' },
    { label: '85-89%', min: 85, max: 89.9, count: 0, color: '#02474E' },
    { label: '90-94%', min: 90, max: 94.9, count: 0, color: '#27AE60' },
    { label: '95-100%', min: 95, max: 100, count: 0, color: '#1B7A3D' },
  ]
  for (const ws of scoredWOs) { const s = ws.overall ?? 0; for (const b of buckets) { if (s >= b.min && s <= b.max) { b.count++; break } } }

  // Monthly trend data for line chart
  const trendData = Array.from({ length: 12 }, (_, mi) => {
    const monthWOs = woScores.filter(ws => new Date(ws.wo.allocationDate).getMonth() === mi)
    const monthScored = monthWOs.filter(ws => ws.overall !== null)
    const monthAvg = monthScored.length > 0 ? monthScored.reduce((s, ws) => s + (ws.overall ?? 0), 0) / monthScored.length : null
    return { label: `${MONTH_NAMES[mi]} ${years[0]}`, value: monthAvg }
  })

  // Lowest scoring items
  const itemScores = new Map<string, number[]>()
  for (const ws of woScores) { if (!ws.wo.inspection || ws.wo.inspection.status !== 'SUBMITTED') continue; for (const r of ws.wo.inspection.responses) { const s = ratingToScore(r.rating); if (s === null) continue; if (!itemScores.has(r.checklistItemId)) itemScores.set(r.checklistItemId, []); itemScores.get(r.checklistItemId)!.push(s) } }
  const lowestItems = Array.from(itemScores.entries())
    .map(([id, scores]) => ({ id, question: checklistItemMap.get(id)?.question ?? id, category: CATEGORY_LABELS[checklistItemMap.get(id)?.category ?? ''] ?? '', avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => a.avg - b.avg).slice(0, 5)

  return `<!DOCTYPE html><html><head><style>${CSS}</style></head><body>
    ${headerHTML('Performance Summary Report', logo)}
    <div style="text-align:center;font-size:22pt;font-weight:700;color:#02474E;margin:12px 0 4px">Performance Summary Report</div>
    <div style="text-align:left;font-size:9pt;color:#666;margin-bottom:18px">Region: ${regionNames.length > 0 ? regionNames.join(', ') : 'All Regions'} | Year: ${years.join(', ')} | Months: ${monthRange}</div>

    ${sectionHeader('Executive Overview')}
    <div class="kpi-wrap">
      ${kpiBox(`${avgScore.toFixed(2)}% <span style="color:#27AE60;font-size:12pt">▲</span>`, 'All Contractors Avg Score', 'Target: 90%', scoreColor(avgScore), '#02474E')}
      ${kpiBox(`${workOrders.length}`, 'Total Work Orders', `${inspectedWOs.length} Inspected, ${pendingWOs.length} Pending`, '#02474E', '#1565C0')}
      ${kpiBox(`${uniqueContractors.size}`, 'Active Contractors', undefined, '#27AE60', '#27AE60')}
      ${kpiBox(`${pendingWOs.length}`, 'Pending Inspections', `${overdueCount} Overdue (>3 days)`, '#C0392B', '#E67E22')}
    </div>

    ${sectionHeader('Contractor Performance Ranking')}
    <table><tr><th>#</th><th>Contractor</th><th>CR #</th><th>Work Orders</th><th>Avg Score</th><th>Score Change</th><th>Inspected</th><th>Pending</th></tr>
    ${contractors.map((c, i) => `<tr style="${c.avgScore < 90 ? 'background:#FFFDE7' : ''}"><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.cr}</td><td>${c.total}</td><td>${scoreCell(c.avgScore, true)}</td><td style="color:#999">\u2014</td><td>${c.inspected}</td><td>${c.pending}</td></tr>`).join('')}
    </table>
    <div class="note">"Score Change" = change vs previous reporting period. Amber/red rows are below the 90% target.</div>

    <div class="avoid-break">
    ${sectionHeader('Category-wise Compliance (All Contractors Average)')}
    ${horizontalBar('HSE & Safety', catAvg(allCats.hse))}
    ${horizontalBar('Technical Installation', catAvg(allCats.tech))}
    ${horizontalBar('Process & Communication', catAvg(allCats.process))}
    ${horizontalBar('Site Closure', catAvg(allCats.closure))}
    <div class="note">${catScores[0].name} and ${catScores[1].name} are the weakest categories across all contractors.</div>
    </div>

    <div class="avoid-break">
    ${sectionHeader('Score Distribution (All Inspected Work Orders)')}
    ${verticalBarChartSVG(buckets)}
    </div>

    <div class="page-break"></div>
    ${headerHTML('Performance Summary Report', logo)}

    <div class="avoid-break">
    ${sectionHeader('Compliance Trend (All Contractors Monthly Average)')}
    ${lineChartSVG(trendData, 90)}
    </div>

    <div class="avoid-break">
    ${sectionHeader('Per-Category Comparison by Contractor')}
    ${(() => {
      const contractorCatAvgs = { hse: [] as number[], tech: [] as number[], process: [] as number[], closure: [] as number[], overall: [] as number[] }
      const rows = contractors.map(c => {
        const cCats = { hse: [] as number[], tech: [] as number[], process: [] as number[], closure: [] as number[] }
        for (const ws of c.wos) { if (ws.cats.hse !== null) cCats.hse.push(ws.cats.hse); if (ws.cats.technical !== null) cCats.tech.push(ws.cats.technical); if (ws.cats.process !== null) cCats.process.push(ws.cats.process); if (ws.cats.closure !== null) cCats.closure.push(ws.cats.closure) }
        if (cCats.hse.length > 0) contractorCatAvgs.hse.push(catAvg(cCats.hse))
        if (cCats.tech.length > 0) contractorCatAvgs.tech.push(catAvg(cCats.tech))
        if (cCats.process.length > 0) contractorCatAvgs.process.push(catAvg(cCats.process))
        if (cCats.closure.length > 0) contractorCatAvgs.closure.push(catAvg(cCats.closure))
        if (c.inspected > 0) contractorCatAvgs.overall.push(c.periodAvg)
        const fmt = (arr: number[]) => arr.length > 0 ? scoreCell(catAvg(arr), true) : '<span style="color:#999">\u2014</span>'
        return `<tr><td><strong>${c.name}</strong></td><td>${fmt(cCats.hse)}</td><td>${fmt(cCats.tech)}</td><td>${fmt(cCats.process)}</td><td>${fmt(cCats.closure)}</td><td>${c.inspected > 0 ? scoreCell(c.periodAvg, true) : '<span style="color:#999">\u2014</span>'}</td></tr>`
      }).join('')
      return `<table><tr><th>Contractor</th><th>HSE & Safety</th><th>Technical Installation</th><th>Process & Communication</th><th>Site Closure</th><th>Overall</th></tr>
      ${rows}
      <tr style="background:#EBF5F7 !important"><td><strong>ALL CONTRACTORS AVG</strong></td><td><strong>${catAvg(contractorCatAvgs.hse).toFixed(2)}%</strong></td><td><strong>${catAvg(contractorCatAvgs.tech).toFixed(2)}%</strong></td><td><strong>${catAvg(contractorCatAvgs.process).toFixed(2)}%</strong></td><td><strong>${catAvg(contractorCatAvgs.closure).toFixed(2)}%</strong></td><td><strong>${contractorCatAvgs.overall.length > 0 ? catAvg(contractorCatAvgs.overall).toFixed(2) : '0.00'}%</strong></td></tr>
      </table>`
    })()}
    </div>

    <div class="avoid-break">
    ${sectionHeader('Lowest Scoring Checklist Items (All Contractors)')}
    <table><tr><th style="text-align:center">#</th><th style="text-align:left">Checklist Item</th><th style="text-align:left">Category</th><th>Avg Score %</th></tr>
    ${lowestItems.map((item, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:left">${item.question}</td><td style="text-align:left">${item.category}</td><td>${scoreCell(item.avg, true)}</td></tr>`).join('')}
    </table>
    </div>
  </body></html>`
}

// ─── Contractor Performance HTML ────────────────────────────────────────────

function generateContractorPerformanceHTML(
  workOrders: WorkOrderWithRelations[], years: number[], months: number[], logo: string
): string {
  const woScores = computeAllScores(workOrders)
  const inspectedWOs = workOrders.filter(isInspected)
  const pendingWOs = workOrders.filter(wo => !isInspected(wo))
  const scoredWOs = woScores.filter(ws => ws.overall !== null)
  const avgScore = scoredWOs.length > 0 ? scoredWOs.reduce((s, ws) => s + (ws.overall ?? 0), 0) / scoredWOs.length : 0

  const now = new Date()
  const uniqueContractors = new Map<string, string>()
  for (const wo of workOrders) uniqueContractors.set(wo.contractorCr, wo.contractor.companyName)
  const crList = Array.from(uniqueContractors.keys()).join(', ')
  const reworkCount = workOrders.filter(wo => wo.status === 'IN_PROGRESS' && wo.submissionDate !== null).length

  const sortedWOs = [...woScores].sort((a, b) => {
    const aI = isInspected(a.wo), bI = isInspected(b.wo)
    if (aI !== bI) return aI ? -1 : 1
    return new Date(b.wo.allocationDate).getTime() - new Date(a.wo.allocationDate).getTime()
  })

  return `<!DOCTYPE html><html><head><style>${CSS}</style></head><body>
    ${headerHTML('Contractor Performance Report', logo)}
    <div style="text-align:center;font-size:22pt;font-weight:700;color:#02474E;margin:10px 0 15px">Contractor Performance Report</div>

    ${sectionHeader('Overview')}
    <div style="display:flex;gap:8px;margin:0 36px 14px 36px">
      ${kpiBox(`${avgScore.toFixed(2)}% <span style="color:#27AE60;font-size:12pt">▲</span>`, 'Avg Compliance Score', 'Target: 90%', scoreColor(avgScore), '#02474E')}
      ${kpiBox(`${workOrders.length}`, 'Total Work Orders', `${inspectedWOs.length} Inspected, ${pendingWOs.length} Pending`, '#02474E', '#2471A3')}
      ${kpiBox(`${uniqueContractors.size}`, 'Contractors', crList.length > 30 ? crList.substring(0, 29) + '..' : crList, '#02474E', '#27AE60')}
      ${kpiBox(`${pendingWOs.length}`, 'Pending Inspections', undefined, '#C0392B', '#C0392B')}
      ${kpiBox(`${reworkCount}`, 'Rework Orders', `out of ${inspectedWOs.length} inspected`, '#C0392B', '#922B21')}
    </div>

    ${sectionHeader('Work Order Details')}
    <table style="font-size:7pt">
    <tr><th style="width:12%;white-space:nowrap">Work Order</th><th>Contractor</th><th>CR #</th><th>Site</th><th>Region</th><th>Status</th><th>Overall Score</th><th>HSE & Safety</th><th>Technical Install.</th><th>Process & Comm.</th><th>Site Closure</th><th>Rework</th><th>Duration (Days)</th><th>Inspector</th><th>Submitted</th><th>Inspected</th></tr>
    ${sortedWOs.map(ws => {
      const wo = ws.wo, ins = isInspected(wo), isPending = !ins, isLow = ws.overall !== null && ws.overall < 85
      const rowClass = isPending ? 'row-pending' : isLow ? 'row-low' : ''
      const inspectorName = wo.assignedInspector?.staffProfile?.fullName ?? '\u2014'
      const days = Math.ceil(((wo.submissionDate ? new Date(wo.submissionDate).getTime() : now.getTime()) - new Date(wo.allocationDate).getTime()) / 86400000)
      const isRework = wo.status === 'IN_PROGRESS' && wo.submissionDate !== null
      return `<tr class="${rowClass}">
        <td style="white-space:nowrap">${wo.id}</td><td>${wo.contractor.companyName}</td><td>${wo.contractorCr}</td><td>${wo.siteName}</td><td>${wo.governorate.nameEn}</td>
        <td style="color:${ins ? '#27AE60' : wo.status === 'IN_PROGRESS' ? '#2471A3' : wo.status === 'INSPECTION_IN_PROGRESS' ? '#8E44AD' : wo.status === 'OVERDUE' ? '#C0392B' : '#E67E22'};font-weight:700">${ins ? 'INSPECTED' : wo.status === 'IN_PROGRESS' ? 'IN PROGRESS' : wo.status === 'PENDING_INSPECTION' ? 'PENDING INSPECTION' : wo.status === 'INSPECTION_IN_PROGRESS' ? 'INSPECTION IN PROGRESS' : wo.status === 'OVERDUE' ? 'OVERDUE' : wo.status === 'ASSIGNED' ? 'ASSIGNED' : 'SUBMITTED'}</td>
        <td>${scoreCell(ws.overall, ins)}</td><td>${scoreCell(ws.cats.hse, ins)}</td><td>${scoreCell(ws.cats.technical, ins)}</td><td>${scoreCell(ws.cats.process, ins)}</td><td>${scoreCell(ws.cats.closure, ins)}</td>
        <td style="color:${isRework ? '#C0392B' : '#27AE60'};font-weight:700">${isRework ? 'Yes' : 'No'}</td>
        <td style="color:${durationColor(days)}">${days}</td><td>${inspectorName}</td>
        <td>${fmtDate(wo.submissionDate)}</td><td>${ins ? fmtDate(wo.inspection!.submittedAt) : '\u2014'}</td>
      </tr>`
    }).join('')}
    </table>

    <div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;font-size:7pt;color:#666;margin-top:6px;padding:8px;background:#f9f9f9;border-radius:4px">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:#27AE60;border-radius:2px"></div> Score ≥ 90%</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:#E67E22;border-radius:2px"></div> Score 75–89%</div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;background:#C0392B;border-radius:2px"></div> Score &lt; 75%</div>
      <div style="display:flex;align-items:center;gap:4px">Duration: <span style="color:#27AE60;font-weight:700">≤7d</span> / <span style="color:#E67E22;font-weight:700">8–10d</span> / <span style="color:#C0392B;font-weight:700">&gt;10d</span></div>
      <div>Yellow rows = Pending | Red rows = Below 85%</div>
    </div>
  </body></html>`
}

// ─── Main Export ────────────────────────────────────────────────────────────

async function buildReportHTML(params: ReportParams): Promise<{ html: string; isLandscape: boolean }> {
  const { reportType, regions, contractors, years, months } = params
  const govCodes = regions ?? [], crCodes = contractors ?? [], activeMonths = months ?? []
  const startMonth = activeMonths.length ? String(Math.min(...activeMonths)).padStart(2, '0') : '01'
  const endMonth = activeMonths.length ? String(Math.max(...activeMonths)).padStart(2, '0') : '12'

  const workOrders = await prisma.workOrder.findMany({
    where: {
      ...(govCodes.length > 0 ? { governorateCode: { in: govCodes } } : {}),
      ...(crCodes.length > 0 ? { contractorCr: { in: crCodes } } : {}),
      allocationDate: { gte: new Date(`${Math.min(...years)}-${startMonth}-01`), lte: new Date(`${Math.max(...years)}-${endMonth}-31`) },
    },
    include: {
      contractor: true,
      assignedInspector: { include: { staffProfile: { select: { fullName: true } } } },
      governorate: true, inspection: { include: { responses: true } }, scoringWeights: true,
    },
    orderBy: { allocationDate: 'desc' },
  }) as unknown as WorkOrderWithRelations[]

  const validWorkOrders = workOrders.filter(wo => {
    if (!wo.contractor) {
      console.warn('[PDF] skipping work order with missing contractor profile:', wo.id, 'contractorCr:', wo.contractorCr)
      return false
    }
    return true
  })

  const checklistItems = await prisma.checklistItem.findMany({ where: { isActive: true }, select: { id: true, question: true, category: true } })
  const checklistItemMap = new Map(checklistItems.map(ci => [ci.id, { question: ci.question, category: ci.category }]))

  // Fetch cached contractor scores
  const contractorProfiles = await prisma.contractorProfile.findMany({
    select: { crNumber: true, avgScore: true, totalInspections: true },
  })
  const cachedScores = new Map(contractorProfiles.map(cp => [cp.crNumber, { avgScore: cp.avgScore ? Number(cp.avgScore) : null, totalInspections: cp.totalInspections }]))

  let regionNames: string[] = []
  if (govCodes.length > 0) { regionNames = (await prisma.governorate.findMany({ where: { code: { in: govCodes } }, select: { nameEn: true } })).map(g => g.nameEn) }

  const logo = getLogoBase64()
  const isLandscape = reportType === 'contractor-performance'

  const html = reportType === 'performance-summary'
    ? generatePerformanceSummaryHTML(validWorkOrders, regionNames, years, activeMonths, logo, checklistItemMap, cachedScores)
    : generateContractorPerformanceHTML(validWorkOrders, years, activeMonths, logo)

  return { html, isLandscape }
}

export async function generateReport(params: ReportParams): Promise<Buffer> {
  const { html, isLandscape } = await buildReportHTML(params)

  const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL
  const browser = await puppeteerCore.launch({
    args: isServerless ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: isServerless
      ? await chromium.executablePath()
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/google-chrome',
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: isLandscape,
      printBackground: true,
      margin: { top: '12mm', bottom: '18mm', left: '10mm', right: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:7pt;color:#999;padding:0 12mm;display:flex;justify-content:space-between">
        <span>NAMA Water Services — Compliance Inspection System | Report ID: RPT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-001</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> | © 2026 NAMA Water Services SAOC</span>
      </div>`,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
