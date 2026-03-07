import { EvidenceSource, EvidenceType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  GPS_MAX_ACCURACY_METERS,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_WORKORDER,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEOS_PER_WORKORDER,
} from '../types';
import { AppError } from '../utils/AppError';
import { GPS_FLAG_THRESHOLD_METRES, haversineDistance } from '../utils/geoDistance';
import {
  buildChecklistEvidenceKey,
  deleteObject,
  generateObjectUrl,
  generateUploadPresignedUrl,
  getObjectMetadata,
} from './s3.service';

type EvidenceActor = {
  role?: string;
  contractorId?: string;
  dbUserId?: string;
};

const allowedWorkOrderStatuses = (source: EvidenceSource): string[] =>
  source === EvidenceSource.CONTRACTOR ? ['ASSIGNED', 'IN_PROGRESS'] : ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'];

const ensureChecklistItem = async (checklistItemId: string) => {
  const checklistItem = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    include: {
      section: {
        include: {
          template: {
            select: { isActive: true },
          },
        },
      },
    },
  });

  if (!checklistItem) {
    throw new AppError('Checklist item not found in active template', 404, 'NOT_FOUND');
  }

  if (!checklistItem.section.template.isActive) {
    throw new AppError('Checklist item not found in active template', 404, 'NOT_FOUND');
  }

  return checklistItem;
};

export const listEvidence = async (filters: {
  workOrderId?: string;
  checklistItemId?: string;
  source?: EvidenceSource;
  actor?: EvidenceActor;
}) => {
  const where: Prisma.EvidenceWhereInput = {
    isConfirmed: true,
  };

  if (filters.workOrderId) {
    where.workOrderId = filters.workOrderId;
  }

  if (filters.checklistItemId) {
    where.checklistItemId = filters.checklistItemId;
  }

  if (filters.source) {
    where.source = filters.source;
  }

  if (filters.actor?.role === 'CONTRACTOR') {
    if (!filters.actor.contractorId) {
      throw new AppError('Contractor profile not found', 403, 'FORBIDDEN');
    }
    where.workOrder = {
      contractorId: filters.actor.contractorId,
    };
  }

  return prisma.evidence.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
};

export const listEvidenceForWorkOrder = async (workOrderId: string, actor?: EvidenceActor) => {
  const evidence = await listEvidence({
    workOrderId,
    actor,
  });

  return {
    inspector: evidence.filter((e) => e.source === EvidenceSource.INSPECTOR),
    contractor: evidence.filter((e) => e.source === EvidenceSource.CONTRACTOR),
  };
};

export const requestUpload = async (params: {
  workOrderId: string;
  checklistItemId: string;
  fileName: string;
  fileType: EvidenceType;
  contentType: string;
  fileSize: number;
  source: EvidenceSource;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: string;
  actor?: EvidenceActor;
}) => {
  const workOrderWhere: Prisma.WorkOrderWhereInput = {
    id: params.workOrderId,
    status: { in: allowedWorkOrderStatuses(params.source) as any },
  };

  if (params.source === EvidenceSource.CONTRACTOR) {
    if (!params.actor?.contractorId) {
      throw new AppError('Contractor profile not found', 403, 'FORBIDDEN');
    }
    workOrderWhere.contractorId = params.actor.contractorId;
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: workOrderWhere,
    include: { site: true },
  });

  if (!workOrder) {
    throw new AppError('Work order not found or not accessible', 404, 'NOT_FOUND');
  }

  if (workOrder.isLocked) {
    throw new AppError('Work order is locked and cannot be modified', 400, 'WORK_ORDER_LOCKED');
  }

  await ensureChecklistItem(params.checklistItemId);

  if (params.fileType === EvidenceType.PHOTO && params.fileSize > MAX_PHOTO_SIZE_BYTES) {
    throw new AppError('File too large. Max 10MB', 400, 'FILE_TOO_LARGE');
  }

  if (params.fileType === EvidenceType.VIDEO && params.fileSize > MAX_VIDEO_SIZE_BYTES) {
    throw new AppError('File too large. Max 50MB', 400, 'FILE_TOO_LARGE');
  }

  const existingCount = await prisma.evidence.count({
    where: {
      workOrderId: params.workOrderId,
      type: params.fileType,
    },
  });

  const maxCount = params.fileType === EvidenceType.VIDEO ? MAX_VIDEOS_PER_WORKORDER : MAX_PHOTOS_PER_WORKORDER;
  if (existingCount >= maxCount) {
    throw new AppError(
      `Maximum ${maxCount} ${params.fileType === EvidenceType.VIDEO ? 'videos' : 'photos'} per work order reached`,
      400,
      'EVIDENCE_LIMIT_REACHED'
    );
  }

  if (params.source === EvidenceSource.CONTRACTOR) {
    if (params.latitude === undefined || params.longitude === undefined || params.accuracy === undefined) {
      throw new AppError('Contractor evidence requires GPS coordinates and accuracy', 400, 'GPS_REQUIRED');
    }

    if (params.accuracy > GPS_MAX_ACCURACY_METERS) {
      throw new AppError(`GPS accuracy must be within ${GPS_MAX_ACCURACY_METERS} meters`, 400, 'GPS_INACCURATE');
    }
  }

  let locationDistance: number | null = null;
  let isLocationFlagged = false;

  if (
    params.latitude !== undefined &&
    params.longitude !== undefined &&
    workOrder.site !== null &&
    typeof workOrder.site.latitude === 'number' &&
    typeof workOrder.site.longitude === 'number'
  ) {
    locationDistance = haversineDistance(
      params.latitude,
      params.longitude,
      workOrder.site.latitude,
      workOrder.site.longitude
    );
    isLocationFlagged = locationDistance > GPS_FLAG_THRESHOLD_METRES;
  }

  const s3Key = buildChecklistEvidenceKey(params.workOrderId, params.checklistItemId, params.contentType);
  const upload = await generateUploadPresignedUrl(s3Key, params.contentType);

  const evidence = await prisma.evidence.create({
    data: {
      workOrderId: params.workOrderId,
      checklistItemId: params.checklistItemId,
      checklistResponseId: null,
      source: params.source,
      type: params.fileType,
      s3Key,
      s3Url: null,
      s3Bucket: process.env.S3_BUCKET_NAME || '',
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.contentType,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy,
      capturedAt: params.capturedAt ? new Date(params.capturedAt) : new Date(),
      isLocationFlagged,
      locationDistance: locationDistance !== null ? Math.round(locationDistance) : null,
      isConfirmed: false,
    },
  });

  if (params.source === EvidenceSource.CONTRACTOR && workOrder.status === 'ASSIGNED') {
    await prisma.workOrder.update({
      where: { id: params.workOrderId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: workOrder.startedAt || new Date(),
      },
    });
  }

  return {
    evidenceId: evidence.id,
    uploadUrl: upload.uploadUrl,
    s3Key,
    isLocationFlagged,
    locationDistance: locationDistance !== null ? Math.round(locationDistance) : null,
  };
};

export const confirmUpload = async (evidenceId: string, key?: string) => {
  const existing = await prisma.evidence.findUnique({
    where: { id: evidenceId },
  });

  if (!existing) {
    throw new AppError('Evidence not found', 404, 'NOT_FOUND');
  }

  const objectKey = key || existing.s3Key;
  const metadata = await getObjectMetadata(objectKey);

  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      s3Key: objectKey,
      s3Url: generateObjectUrl(objectKey),
      fileSize: metadata.fileSize,
      mimeType: metadata.contentType,
      isConfirmed: true,
      uploadedAt: new Date(),
    },
  });
};

export const deleteEvidence = async (evidenceId: string, actorId?: string, isExternal?: boolean) => {
  const evidence = await prisma.evidence.findUniqueOrThrow({
    where: { id: evidenceId },
    include: { workOrder: true },
  });

  if (evidence.workOrder.isLocked) {
    throw new AppError('Work order is locked and cannot be modified', 400, 'WORK_ORDER_LOCKED');
  }

  if (isExternal && evidence.source !== EvidenceSource.CONTRACTOR) {
    throw new AppError('Contractor can delete only contractor evidence', 403, 'FORBIDDEN');
  }

  if (!isExternal && evidence.source !== EvidenceSource.INSPECTOR) {
    throw new AppError('Inspector can delete only inspector evidence', 403, 'FORBIDDEN');
  }

  await deleteObject(evidence.s3Key);
  await prisma.evidence.delete({ where: { id: evidenceId } });

  return { deleted: true, evidenceId, actorId };
};
