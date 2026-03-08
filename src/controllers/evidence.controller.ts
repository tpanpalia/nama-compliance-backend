import { EvidenceSource } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import {
  confirmUpload,
  deleteEvidence,
  listEvidence,
  listEvidenceForWorkOrder,
  requestUpload,
} from '../services/evidence.service';

export const listEvidenceHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = req.query.source ? (String(req.query.source).toUpperCase() as EvidenceSource) : undefined;
    const data = await listEvidence({
      workOrderId: req.query.workOrderId as string | undefined,
      checklistItemId: req.query.checklistItemId as string | undefined,
      source,
      actor: {
        role: req.user?.role,
        contractorId: req.user?.contractorId,
        dbUserId: req.user?.dbUserId,
      },
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const getEvidenceByWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const evidence = await listEvidence({
      workOrderId: req.params.workOrderId,
      actor: {
        role: req.user?.role,
        contractorId: req.user?.contractorId,
        dbUserId: req.user?.dbUserId,
      },
    });

    console.log('[Evidence Fetch] Query:', {
      workOrderId: req.params.workOrderId,
      resultCount: evidence.length,
      sources: evidence.map((item) => item.source),
      itemIds: evidence.map((item) => item.checklistItemId),
    });

    res.json({ evidence });
  } catch (error) {
    next(error);
  }
};

export const getGroupedEvidenceByWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await listEvidenceForWorkOrder(req.params.workOrderId, {
      role: req.user?.role,
      contractorId: req.user?.contractorId,
      dbUserId: req.user?.dbUserId,
    });
    res.json({ data, message: 'Evidence fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const requestPresignedUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[Evidence Upload] Body:', {
      workOrderId: req.params.workOrderId,
      checklistItemId: req.body.checklistItemId,
      source: req.user?.role === 'CONTRACTOR' ? 'CONTRACTOR' : 'INSPECTOR',
      capturedAt: req.body.capturedAt,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    });

    const source = req.user?.role === 'CONTRACTOR' ? EvidenceSource.CONTRACTOR : EvidenceSource.INSPECTOR;
    const data = await requestUpload({
      workOrderId: req.params.workOrderId,
      checklistItemId: req.body.checklistItemId,
      fileName: req.body.fileName || `${Date.now()}`,
      fileType: req.body.fileType || req.body.type,
      contentType: req.body.contentType || req.body.mimeType,
      fileSize: req.body.fileSize,
      source,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy,
      capturedAt: req.body.capturedAt,
      actor: {
        role: req.user?.role,
        contractorId: req.user?.contractorId,
        dbUserId: req.user?.dbUserId,
      },
    });

    console.log('[Evidence Upload] Created row:', {
      id: data.evidenceId,
      workOrderId: req.params.workOrderId,
      checklistItemId: req.body.checklistItemId ?? null,
      source,
      s3Url: null,
    });

    res.status(201).json({ data, message: 'Upload URL generated successfully' });
  } catch (error) {
    next(error);
  }
};

export const confirmEvidenceUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await confirmUpload(req.body.evidenceId, req.body.key);
    console.log('[Evidence Upload] Confirmed row:', {
      id: data.id,
      workOrderId: data.workOrderId,
      checklistItemId: data.checklistItemId,
      source: data.source,
      s3Url: data.s3Url,
    });
    res.json({ data, message: 'Upload confirmed successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteEvidenceHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const evidence = await prisma.evidence.findUniqueOrThrow({ where: { id: req.params.evidenceId } });
    if (req.user?.role === 'CONTRACTOR') {
      const contractor = await prisma.workOrder.findUnique({ where: { id: evidence.workOrderId }, select: { contractorId: true } });
      if (contractor?.contractorId !== req.user.contractorId) {
        throw new AppError('Forbidden', 403, 'FORBIDDEN');
      }
    }
    const data = await deleteEvidence(req.params.evidenceId, req.user?.dbUserId, req.user?.role === 'CONTRACTOR');
    res.json({ data, message: 'Evidence deleted successfully' });
  } catch (error) {
    next(error);
  }
};
