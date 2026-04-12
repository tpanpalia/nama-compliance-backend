import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { adminReportService } from '../../services/admin/report.service'
import { qsDefault } from '../../utils/query'

const workloadSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const inspectorWorkload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = workloadSchema.parse(req.query)
    const result = await adminReportService.inspectorWorkload(from, to)
    res.json(result)
  } catch (err) { next(err) }
}

export const listExports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(qsDefault(req.query.page,  '1'),  10)
    const limit = parseInt(qsDefault(req.query.limit, '20'), 10)
    const result = await adminReportService.exports(page, limit)
    res.json(result)
  } catch (err) { next(err) }
}

export const governorates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminReportService.governorates()
    res.json(result)
  } catch (err) { next(err) }
}

const generateSchema = z.object({
  reportType: z.enum(['performance-summary', 'contractor-performance']),
  regions: z.array(z.string()).optional(),
  contractors: z.array(z.string()).optional(),
  years: z.array(z.number().int()),
  months: z.array(z.number().int().min(1).max(12)).optional(),
})

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = generateSchema.parse(req.body)
    const result = await adminReportService.generate(req.user!.userId, data)

    const filename = `${data.reportType}-${new Date().toISOString().split('T')[0]}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-File-Id', result.fileId)
    res.send(result.buffer)
  } catch (err) { next(err) }
}
