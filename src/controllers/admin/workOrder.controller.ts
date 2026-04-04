import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { WorkOrderPriority } from '@prisma/client'
import { adminWorkOrderService } from '../../services/admin/workOrder.service'
import { qs, qsDefault } from '../../utils/query'

const createSchema = z.object({
  governorateCode:      z.string().min(1),
  siteName:             z.string().min(1),
  description:          z.string().optional(),
  priority:             z.nativeEnum(WorkOrderPriority).default('MEDIUM'),
  allocationDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetCompletionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const updateSchema = z.object({
  siteName:             z.string().min(1).optional(),
  description:          z.string().optional(),
  priority:             z.nativeEnum(WorkOrderPriority).optional(),
  targetCompletionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contractorCr:         z.string().min(1).optional(),
}).strict()

const assignSchema = z.object({ inspectorId: z.string().uuid() })

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminWorkOrderService.list({
      status:          qs(req.query.status),
      contractorCr:    qs(req.query.contractorCr),
      inspectorId:     qs(req.query.inspectorId),
      governorateCode: qs(req.query.governorateCode),
      page:            parseInt(qsDefault(req.query.page,  '1'),  10),
      limit:           parseInt(qsDefault(req.query.limit, '20'), 10),
    })
    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminWorkOrderService.getById(req.params.id)
    res.json(result)
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = createSchema.parse(req.body)
    const result = await adminWorkOrderService.create(req.user!.userId, data)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export const assign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inspectorId } = assignSchema.parse(req.body)
    const result = await adminWorkOrderService.assign(req.user!.userId, req.params.id, inspectorId)
    res.json(result)
  } catch (err) { next(err) }
}

const bulkImportSchema = z.object({
  workOrders: z.array(z.object({
    governorateCode: z.string().min(1),
    siteName: z.string().min(1),
    description: z.string().optional(),
    workType: z.string().optional(),
    priority: z.nativeEnum(WorkOrderPriority).default('MEDIUM'),
    allocationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetCompletionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })),
})

export const bulkImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workOrders } = bulkImportSchema.parse(req.body)
    const results = []
    for (const wo of workOrders) {
      const result = await adminWorkOrderService.create(req.user!.userId, wo)
      results.push(result)
    }
    res.status(201).json({ ok: true, imported: results.length })
  } catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data   = updateSchema.parse(req.body)
    const result = await adminWorkOrderService.update(req.user!.userId, req.params.id, data)
    res.json(result)
  } catch (err) { next(err) }
}
