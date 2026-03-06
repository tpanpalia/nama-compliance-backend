import { EvidenceSource, EvidenceType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import {
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_WORKORDER,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEOS_PER_WORKORDER,
} from '../types';
import { buildEvidenceKey, deleteObject, generateUploadPresignedUrl, getObjectMetadata } from './s3.service';

async function resolveContractor(workOrderId: string, contractorEmail?: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { email: contractorEmail },
    select: { id: true },
  });

  if (!contractor) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: workOrderId,
      contractorId: contractor.id,
    },
    select: {
      id: true,
      status: true,
      isLocked: true,
    },
  });

  if (!workOrder) {
    throw new AppError('Work order not found', 404, 'NOT_FOUND');
  }

  return { contractor, workOrder };
}

async function resolveAuditUserId(actor?: { dbUserId?: string; email?: string }) {
  if (actor?.dbUserId) {
    const user = await prisma.user.findUnique({
      where: { id: actor.dbUserId },
      select: { id: true },
    });
    if (user) return user.id;
  }

  if (actor?.email) {
    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true },
    });
    return user?.id;
  }

  return undefined;
}

export const listEvidenceForWorkOrder = async (
  workOrderId: string,
  actor?: {
    role?: string;
    email?: string;
  }
) => {
  if (actor?.role === 'CONTRACTOR') {
    const { workOrder } = await resolveContractor(workOrderId, actor.email);
    if (!['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(workOrder.status)) {
      throw new AppError('Work order not found', 404, 'NOT_FOUND');
    }
  }

  const evidence = await prisma.evidence.findMany({
    where: { workOrderId },
    orderBy: { uploadedAt: 'desc' },
  });

  return {
    inspector: evidence.filter((e) => e.source === EvidenceSource.INSPECTOR),
    contractor: evidence.filter((e) => e.source === EvidenceSource.CONTRACTOR),
  };
};

export const requestUpload = async (params: {
  workOrderId: string;
  fileName: string;
  fileType: EvidenceType;
  contentType: string;
  fileSize: number;
  source: EvidenceSource;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  actorRole?: string;
  actorEmail?: string;
}) => {
  const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: params.workOrderId } });
  if (workOrder.isLocked) {
    throw new AppError('Work order is locked and cannot be modified', 400, 'WORK_ORDER_LOCKED');
  }

  if (params.source === EvidenceSource.CONTRACTOR) {
    const { workOrder: contractorWorkOrder } = await resolveContractor(params.workOrderId, params.actorEmail);
    if (contractorWorkOrder.status !== 'IN_PROGRESS') {
      throw new AppError('Contractor can upload evidence only for in-progress work orders', 400, 'INVALID_WORK_ORDER_STATUS');
    }
  }

  if (params.fileType === EvidenceType.PHOTO && params.fileSize > MAX_PHOTO_SIZE_BYTES) {
    throw new AppError('Photo exceeds max size limit', 400, 'FILE_TOO_LARGE');
  }
  if (params.fileType === EvidenceType.VIDEO && params.fileSize > MAX_VIDEO_SIZE_BYTES) {
    throw new AppError('Video exceeds max size limit', 400, 'FILE_TOO_LARGE');
  }

  const [photoCount, videoCount] = await Promise.all([
    prisma.evidence.count({ where: { workOrderId: params.workOrderId, type: EvidenceType.PHOTO } }),
    prisma.evidence.count({ where: { workOrderId: params.workOrderId, type: EvidenceType.VIDEO } }),
  ]);

  if (params.fileType === EvidenceType.PHOTO && photoCount >= MAX_PHOTOS_PER_WORKORDER) {
    throw new AppError('Max photo count reached', 400, 'LIMIT_REACHED');
  }
  if (params.fileType === EvidenceType.VIDEO && videoCount >= MAX_VIDEOS_PER_WORKORDER) {
    throw new AppError('Max video count reached', 400, 'LIMIT_REACHED');
  }

  if (params.source === EvidenceSource.CONTRACTOR && (params.latitude === undefined || params.longitude === undefined || params.accuracy === undefined)) {
    throw new AppError('Contractor evidence requires GPS coordinates and accuracy', 400, 'GPS_REQUIRED');
  }

  const key = buildEvidenceKey(params.workOrderId, params.contentType);
  const upload = await generateUploadPresignedUrl(key, params.contentType);

  const evidence = await prisma.evidence.create({
    data: {
      workOrderId: params.workOrderId,
      type: params.fileType,
      source: params.source,
      s3Key: key,
      s3Bucket: process.env.S3_BUCKET_NAME || '',
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.contentType,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy,
    },
  });

  return {
    uploadUrl: upload.uploadUrl,
    key,
    evidenceId: evidence.id,
  };
};

export const confirmUpload = async (
  evidenceId: string,
  workOrderId: string,
  key: string,
  actor?: {
    role?: string;
    email?: string;
  }
) => {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      workOrderId: true,
      source: true,
      s3Key: true,
    },
  });

  if (!evidence || evidence.workOrderId !== workOrderId || evidence.s3Key !== key) {
    throw new AppError('Evidence not found', 404, 'NOT_FOUND');
  }

  if (actor?.role === 'CONTRACTOR') {
    const { workOrder } = await resolveContractor(workOrderId, actor.email);
    if (workOrder.status !== 'IN_PROGRESS') {
      throw new AppError('Contractor can confirm evidence only for in-progress work orders', 400, 'INVALID_WORK_ORDER_STATUS');
    }
    if (evidence.source !== EvidenceSource.CONTRACTOR) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
  }

  const metadata = await getObjectMetadata(key);
  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      fileSize: metadata.fileSize,
      mimeType: metadata.contentType,
      uploadedAt: new Date(),
    },
  });
};

export const deleteEvidence = async (
  evidenceId: string,
  actor?: {
    role?: string;
    email?: string;
    dbUserId?: string;
    isExternal?: boolean;
  }
) => {
  const evidence = await prisma.evidence.findUniqueOrThrow({
    where: { id: evidenceId },
    include: { workOrder: true },
  });

  if (evidence.workOrder.isLocked) {
    throw new AppError('Work order is locked and cannot be modified', 400, 'WORK_ORDER_LOCKED');
  }

  if (actor?.role === 'CONTRACTOR') {
    const { workOrder } = await resolveContractor(evidence.workOrderId, actor.email);
    if (evidence.source !== EvidenceSource.CONTRACTOR) {
      throw new AppError('Contractor can delete only contractor evidence', 403, 'FORBIDDEN');
    }
    if (workOrder.status === 'SUBMITTED') {
      throw new AppError('Submitted work order evidence cannot be deleted', 400, 'INVALID_WORK_ORDER_STATUS');
    }
  }

  if (actor?.role === 'INSPECTOR' && evidence.source !== EvidenceSource.INSPECTOR) {
    throw new AppError('Inspector can delete only inspector evidence', 403, 'FORBIDDEN');
  }

  await deleteObject(evidence.s3Key);
  const auditUserId = await resolveAuditUserId(actor);
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: auditUserId,
        workOrderId: evidence.workOrderId,
        action: 'EVIDENCE_DELETED',
        newValue: {
          evidenceId: evidence.id,
          type: evidence.type,
          source: evidence.source,
          fileName: evidence.fileName,
        } as any,
      },
    }),
    prisma.evidence.delete({ where: { id: evidenceId } }),
  ]);

  return { deleted: true, evidenceId };
};
