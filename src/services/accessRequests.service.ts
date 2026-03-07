import bcrypt from 'bcryptjs';
import { AccessRequestType, IdentityRole, UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { generateRequestId } from '../types';

export const CreateContractorRequestSchema = z.object({
  role: z.literal('CONTRACTOR'),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  companyName: z.string().min(2),
  tradeLicense: z.string().min(2),
  crNumber: z.string().min(2),
});

export const CreateRegulatorRequestSchema = z.object({
  role: z.literal('REGULATOR'),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  organisation: z.string().min(2),
  department: z.string().optional(),
});

export const CreateAccessRequestSchema = z.discriminatedUnion('role', [
  CreateContractorRequestSchema,
  CreateRegulatorRequestSchema,
]);

export const ApproveRequestSchema = z.object({
  password: z.string().min(8),
});

export const RejectRequestSchema = z.object({
  reason: z.string().min(5),
});

const FULL_INCLUDE = {
  documents: true,
  contractor: {
    select: { id: true, contractorId: true, isActive: true },
  },
  user: {
    select: {
      id: true,
      role: true,
      displayName: true,
      organisation: true,
      department: true,
      isActive: true,
      identity: { select: { email: true, isActive: true } },
    },
  },
};

export async function listAccessRequests(filters: {
  status?: string;
  role?: string;
  year?: number;
  month?: number;
  search?: string;
  page: number;
  limit: number;
}) {
  const { status, role, year, month, search, page, limit } = filters;

  const where: any = {
    ...(status && { status }),
    ...(role && { role }),
    ...(search && {
      OR: [
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  if (year || month) {
    const gte = new Date(year || 2020, (month || 1) - 1, 1);
    const lte = month
      ? new Date(year || 2030, month, 0, 23, 59, 59)
      : new Date((year || 2030) + 1, 0, 0, 23, 59, 59);
    where.createdAt = { gte, lte };
  }

  const [data, total] = await prisma.$transaction([
    prisma.accessRequest.findMany({
      where,
      include: FULL_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.accessRequest.count({ where }),
  ]);

  const [totalAll, pending, approved, rejected] = await prisma.$transaction([
    prisma.accessRequest.count(),
    prisma.accessRequest.count({ where: { status: 'PENDING' } }),
    prisma.accessRequest.count({ where: { status: 'APPROVED' } }),
    prisma.accessRequest.count({ where: { status: 'REJECTED' } }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats: { total: totalAll, pending, approved, rejected },
  };
}

export async function getAccessRequestById(id: string) {
  const request = await prisma.accessRequest.findFirst({
    where: { OR: [{ id }, { requestId: id }] },
    include: FULL_INCLUDE,
  });
  if (!request) throw new AppError('Access request not found', 404);
  return request;
}

export async function createAccessRequest(data: z.infer<typeof CreateAccessRequestSchema>) {
  const existing = await prisma.accessRequest.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new AppError(`A request with this email already exists (status: ${existing.status})`, 409);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayCount = await prisma.accessRequest.count({
    where: { createdAt: { gte: todayStart, lt: todayEnd } },
  });
  const requestId = generateRequestId(now, todayCount + 1);

  const documents =
    data.role === 'REGULATOR'
      ? [
          { name: 'Government ID', status: 'NOT_VERIFIED' as const },
          { name: 'Authorization Letter', status: 'NOT_VERIFIED' as const },
        ]
      : [{ name: 'CR Number Document', status: 'NOT_VERIFIED' as const }];

  return prisma.accessRequest.create({
    data: {
      requestId,
      role: data.role as AccessRequestType,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      companyName: 'companyName' in data ? data.companyName : null,
      tradeLicense: 'tradeLicense' in data ? data.tradeLicense : null,
      crNumber: 'crNumber' in data ? data.crNumber : null,
      organisation: 'organisation' in data ? data.organisation : null,
      department: 'department' in data ? data.department : null,
      documents: { create: documents },
    },
    include: FULL_INCLUDE,
  });
}

export async function approveAccessRequest(id: string, password: string) {
  const request = await getAccessRequestById(id);
  if (request.status !== 'PENDING') {
    throw new AppError('This request has already been processed', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  if (request.role === AccessRequestType.CONTRACTOR) {
    const count = await prisma.contractor.count();
    const contractorCode = `C-${String(count + 1).padStart(5, '0')}`;

    const contractor = await prisma.contractor.create({
      data: {
        contractorId: contractorCode,
        companyName: request.companyName!,
        tradeLicense: request.tradeLicense!,
        crNumber: request.crNumber!,
        contactName: request.contactName,
        phone: request.phone,
        isActive: true,
        identity: {
          create: {
            email: request.email,
            password: hashedPassword,
            role: IdentityRole.CONTRACTOR,
            isActive: true,
          },
        },
      },
    });

    const updated = await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        contractorId: contractor.id,
      },
      include: FULL_INCLUDE,
    });

    return { request: updated, account: { role: 'CONTRACTOR', id: contractor.id, contractorId: contractorCode } };
  }

  if (request.role === AccessRequestType.REGULATOR) {
    const user = await prisma.user.create({
      data: {
        displayName: request.contactName,
        role: UserRole.REGULATOR,
        organisation: request.organisation!,
        department: request.department,
        isActive: true,
        identity: {
          create: {
            email: request.email,
            password: hashedPassword,
            role: IdentityRole.REGULATOR,
            isActive: true,
          },
        },
      },
    });

    const updated = await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        userId: user.id,
      },
      include: FULL_INCLUDE,
    });

    return { request: updated, account: { role: 'REGULATOR', id: user.id } };
  }

  throw new AppError('Unsupported access request role', 400);
}

export async function rejectAccessRequest(id: string, reason: string) {
  const request = await getAccessRequestById(id);
  if (request.status !== 'PENDING') {
    throw new AppError('This request has already been processed', 400);
  }
  return prisma.accessRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewNotes: reason },
    include: FULL_INCLUDE,
  });
}

export async function verifyDocument(documentId: string) {
  const doc = await prisma.accessRequestDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError('Document not found', 404);
  return prisma.accessRequestDocument.update({
    where: { id: documentId },
    data: { status: 'VERIFIED' },
  });
}

export async function rejectDocument(documentId: string) {
  const doc = await prisma.accessRequestDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError('Document not found', 404);
  return prisma.accessRequestDocument.update({
    where: { id: documentId },
    data: { status: 'REJECTED' },
  });
}

export async function deactivateUser(requestId: string) {
  const request = await getAccessRequestById(requestId);
  if (request.status !== 'APPROVED') {
    throw new AppError('Can only deactivate approved users', 400);
  }

  if (request.role === AccessRequestType.CONTRACTOR && request.contractorId) {
    await prisma.contractor.update({
      where: { id: request.contractorId },
      data: { isActive: false, identity: { update: { isActive: false } } },
    });
  } else if (request.role === AccessRequestType.REGULATOR && request.userId) {
    await prisma.user.update({
      where: { id: request.userId },
      data: { isActive: false, identity: { update: { isActive: false } } },
    });
  }

  return { deactivated: true };
}
