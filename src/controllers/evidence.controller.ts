import { EvidenceSource } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { confirmUpload, deleteEvidence, listEvidenceForWorkOrder, requestUpload } from '../services/evidence.service';

export const getEvidenceByWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await listEvidenceForWorkOrder(req.params.workOrderId, {
      role: req.user?.role,
      email: req.user?.email,
    });
    res.json({ data, message: 'Evidence fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const requestPresignedUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = req.user?.role === 'CONTRACTOR' ? EvidenceSource.CONTRACTOR : EvidenceSource.INSPECTOR;
    const data = await requestUpload({
      workOrderId: req.params.workOrderId,
      fileName: req.body.fileName,
      fileType: req.body.fileType,
      contentType: req.body.contentType,
      fileSize: req.body.fileSize,
      source,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy,
      actorRole: req.user?.role,
      actorEmail: req.user?.email,
    });

    res.status(201).json({ data, message: 'Upload URL generated successfully' });
  } catch (error) {
    next(error);
  }
};

export const confirmEvidenceUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await confirmUpload(req.body.evidenceId, req.params.workOrderId, req.body.key, {
      role: req.user?.role,
      email: req.user?.email,
    });
    res.json({ data, message: 'Upload confirmed successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteEvidenceHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await deleteEvidence(req.params.evidenceId, {
      role: req.user?.role,
      email: req.user?.email,
      dbUserId: req.user?.dbUserId,
      isExternal: req.user?.isExternal,
    });
    res.json({ data, message: 'Evidence deleted successfully' });
  } catch (error) {
    next(error);
  }
};
