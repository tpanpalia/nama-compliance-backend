import { prisma } from '../lib/prisma'

export const fileRepository = {
  findById: (id: string) =>
    prisma.file.findUnique({ where: { id } }),

  create: (data: Parameters<typeof prisma.file.create>[0]['data']) =>
    prisma.file.create({ data }),

  updateKey: (id: string, s3Key: string) =>
    prisma.file.update({ where: { id }, data: { s3Key } }),

  confirm: (id: string) =>
    prisma.file.update({ where: { id }, data: { uploadStatus: 'UPLOADED', uploadedAt: new Date() } }),
}
