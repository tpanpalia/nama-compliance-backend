import { NextFunction, Request, Response } from 'express';
import { AccessRequestStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { generateContractorId } from '../types';

export const listAccessRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const where = req.query.status ? { status: req.query.status as AccessRequestStatus } : {};
    const data = await prisma.accessRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data, message: 'Access requests fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const getAccessRequestById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.accessRequest.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ data, message: 'Access request fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const createAccessRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.accessRequest.create({ data: req.body });
    res.status(201).json({ data, message: 'Access request submitted successfully' });
  } catch (error) {
    next(error);
  }
};

export const approveAccessRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accessRequest = await prisma.accessRequest.findUniqueOrThrow({ where: { id: req.params.id } });
    const contractorCount = await prisma.contractor.count();
    const contractorId = generateContractorId(contractorCount + 1);
    const passwordHash = await bcrypt.hash(req.body.password || 'Welcome@123', 10);

    const contractor = await prisma.contractor.create({
      data: {
        contractorId,
        companyName: accessRequest.companyName,
        tradeLicense: accessRequest.tradeLicense,
        crNumber: accessRequest.crNumber,
        contactName: accessRequest.contactName,
        email: accessRequest.email,
        password: passwordHash,
        phone: accessRequest.phone,
        isActive: true,
      },
    });

    const data = await prisma.accessRequest.update({
      where: { id: req.params.id },
      data: {
        status: AccessRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewNotes: 'Approved - invitation to be sent manually',
        contractorId: contractor.id,
      },
      include: { contractor: true },
    });

    res.json({ data, message: 'Access request approved successfully' });
  } catch (error) {
    next(error);
  }
};

export const rejectAccessRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.accessRequest.update({
      where: { id: req.params.id },
      data: {
        status: AccessRequestStatus.REJECTED,
        reviewedAt: new Date(),
        reviewNotes: req.body.reason,
      },
    });
    res.json({ data, message: 'Access request rejected successfully' });
  } catch (error) {
    next(error);
  }
};
