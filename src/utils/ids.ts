import { prisma } from '../lib/prisma'

/** Generate WO-YYYYMMDD-XXXX — sequential within the day */
export async function generateWorkOrderId(): Promise<string> {
  const today = new Date()
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `WO-${datePart}-`

  const last = await prisma.workOrder.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { id: true },
  })

  let seq = 1
  if (last) {
    const parts = last.id.split('-')
    seq = parseInt(parts[parts.length - 1], 10) + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

/** Generate REQ-YYYYMMDD-XXXX — sequential within the day */
export async function generateRequestId(): Promise<string> {
  const today = new Date()
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `REQ-${datePart}-`

  const last = await prisma.accessRequest.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { id: true },
  })

  let seq = 1
  if (last) {
    const parts = last.id.split('-')
    seq = parseInt(parts[parts.length - 1], 10) + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}
