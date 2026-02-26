import { EvidenceSource, EvidenceType } from '@prisma/client';
import { prisma } from '../config/database';
import {
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_WORKORDER,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEOS_PER_WORKORDER,
} from '../types';
import { buildEvidenceKey, deleteObject, generateUploadPresignedUrl, getObjectMetadata } from './s3.service';

export const listEvidenceForWorkOrder = async (workOrderId: string) => {
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
}) => {
  const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: params.workOrderId } });
  if (workOrder.isLocked) {
    throw new Error('Work order is locked and cannot be modified');
  }

  if (params.fileType === EvidenceType.PHOTO && params.fileSize > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('Photo exceeds max size limit');
  }
  if (params.fileType === EvidenceType.VIDEO && params.fileSize > MAX_VIDEO_SIZE_BYTES) {
    throw new Error('Video exceeds max size limit');
  }

  const [photoCount, videoCount] = await Promise.all([
    prisma.evidence.count({ where: { workOrderId: params.workOrderId, type: EvidenceType.PHOTO } }),
    prisma.evidence.count({ where: { workOrderId: params.workOrderId, type: EvidenceType.VIDEO } }),
  ]);

  if (params.fileType === EvidenceType.PHOTO && photoCount >= MAX_PHOTOS_PER_WORKORDER) {
    throw new Error('Max photo count reached');
  }
  if (params.fileType === EvidenceType.VIDEO && videoCount >= MAX_VIDEOS_PER_WORKORDER) {
    throw new Error('Max video count reached');
  }

  if (params.source === EvidenceSource.CONTRACTOR && (params.latitude === undefined || params.longitude === undefined || params.accuracy === undefined)) {
    throw new Error('Contractor evidence requires GPS coordinates and accuracy');
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

export const confirmUpload = async (evidenceId: string, key: string) => {
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

export const deleteEvidence = async (evidenceId: string, actorId?: string, isExternal?: boolean) => {
  const evidence = await prisma.evidence.findUniqueOrThrow({
    where: { id: evidenceId },
    include: { workOrder: true },
  });

  if (evidence.workOrder.isLocked) {
    throw new Error('Work order is locked and cannot be modified');
  }

  if (isExternal && evidence.source !== EvidenceSource.CONTRACTOR) {
    throw new Error('Contractor can delete only contractor evidence');
  }

  if (!isExternal && evidence.source !== EvidenceSource.INSPECTOR) {
    throw new Error('Inspector can delete only inspector evidence');
  }

  await deleteObject(evidence.s3Key);
  await prisma.evidence.delete({ where: { id: evidenceId } });

  return { deleted: true, evidenceId, actorId };
};
