import { Router } from 'express';
import { prisma } from '../config/database';

const router = Router();

router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let dbRecord: unknown = null;

    if (req.user.role === 'INSPECTOR' || req.user.role === 'ADMIN') {
      dbRecord = await prisma.user.findFirst({ where: { azureAdOid: req.user.oid } });
    } else if (req.user.role === 'CONTRACTOR') {
      dbRecord = await prisma.contractor.findFirst({ where: { b2cOid: req.user.oid } });
    }

    res.json({ data: { profile: req.user, dbRecord }, message: 'Profile fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required' });
    return;
  }

  res.json({
    data: {
      message: 'Refresh token validated. Exchange with Azure token endpoint is required in production.',
      refreshToken,
    },
    message: 'Refresh flow accepted',
  });
});

export default router;
