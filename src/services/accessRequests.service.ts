import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { generateContractorId } from '../types';

export const CreateAccessRequestSchema = z.object({
  companyName: z.string().min(2),
  tradeLicense: z.string().min(2),
  crNumber: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
});

export const ApproveAccessRequestSchema = z.object({
  password: z.string().min(8),
});

export const RejectAccessRequestSchema = z.object({
  reason: z.string().min(5),
});

export async function listAccessRequests(status?: string) {
  return prisma.accessRequest.findMany({
    where: { ...(status && { status: status as any }) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAccessRequestById(id: string) {
  const request = await prisma.accessRequest.findUnique({ where: { id } });
  if (!request) throw new AppError('Access request not found', 404);
  return request;
}

export async function createAccessRequest(data: z.infer<typeof CreateAccessRequestSchema>) {
  const existing = await prisma.accessRequest.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError(`A request with this email already exists (status: ${existing.status})`, 409);
  }
  return prisma.accessRequest.create({ data });
}

export async function approveAccessRequest(id: string, password: string) {
  const request = await getAccessRequestById(id);
  if (request.status !== 'PENDING') {
    throw new AppError('This request has already been processed', 400);
  }

  const count = await prisma.contractor.count();
  const contractorId = generateContractorId(count + 1);
  const hashedPassword = await bcrypt.hash(password, 10);

  const contractor = await prisma.contractor.create({
    data: {
      contractorId,
      companyName: request.companyName,
      tradeLicense: request.tradeLicense,
      crNumber: request.crNumber,
      contactName: request.contactName,
      email: request.email,
      password: hashedPassword,
      phone: request.phone,
    },
  });

  const updatedRequest = await prisma.accessRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      contractorId: contractor.id,
    },
  });

  return {
    request: updatedRequest,
    contractor: { id: contractor.id, contractorId: contractor.contractorId, email: contractor.email },
  };
}

export async function rejectAccessRequest(id: string, reason: string) {
  const request = await getAccessRequestById(id);
  if (request.status !== 'PENDING') {
    throw new AppError('This request has already been processed', 400);
  }
  return prisma.accessRequest.update({
    where: { id },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewNotes: reason },
  });
}
