import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

export const upsertComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workOrderId, checklistItemId, comment } = req.body as {
      workOrderId?: string;
      checklistItemId?: string;
      comment?: string;
    };

    const contractorId = req.user?.contractorId;
    if (!contractorId) {
      return res.status(403).json({ error: 'Contractor profile not found' });
    }

    if (!workOrderId || !checklistItemId) {
      return res.status(400).json({ error: 'workOrderId and checklistItemId are required' });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        contractorId,
        status: { notIn: ['INSPECTION_COMPLETED'] },
      },
    });

    if (!workOrder) {
      return res.status(404).json({
        error: 'Work order not found, not accessible, or locked for editing',
      });
    }

    const item = await prisma.checklistItem.findFirst({
      where: {
        id: checklistItemId,
        section: {
          template: {
            isActive: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    if (!comment || comment.trim() === '') {
      await prisma.contractorItemComment.deleteMany({
        where: {
          workOrderId,
          checklistItemId,
          contractorId,
        },
      });

      return res.json({
        data: null,
        message: 'Comment removed',
      });
    }

    const saved = await prisma.contractorItemComment.upsert({
      where: {
        workOrderId_checklistItemId_contractorId: {
          workOrderId,
          checklistItemId,
          contractorId,
        },
      },
      update: {
        comment: comment.trim(),
        updatedAt: new Date(),
      },
      create: {
        workOrderId,
        checklistItemId,
        contractorId,
        comment: comment.trim(),
      },
    });

    return res.json({ data: saved });
  } catch (err) {
    return next(err);
  }
};

export const getCommentsForWorkOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workOrderId } = req.params;
    const contractorId = req.user?.contractorId;
    const where: {
      workOrderId: string;
      contractorId?: string;
    } = { workOrderId };

    if (contractorId) {
      where.contractorId = contractorId;
    }

    const comments = await prisma.contractorItemComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const commentMap: Record<string, { id: string; comment: string; updatedAt: Date }> = {};
    for (const entry of comments) {
      commentMap[entry.checklistItemId] = {
        id: entry.id,
        comment: entry.comment,
        updatedAt: entry.updatedAt,
      };
    }

    return res.json({ data: commentMap });
  } catch (err) {
    return next(err);
  }
};
