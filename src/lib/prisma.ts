import { PrismaClient } from '@prisma/client'

// Singleton — reuse across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
