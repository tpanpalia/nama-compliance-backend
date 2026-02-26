import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';

export const listSites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { region, isActive } = req.query as Record<string, string>;
    const data = await prisma.site.findMany({
      where: {
        ...(region ? { region } : {}),
        ...(typeof isActive === 'string' ? { isActive: isActive === 'true' } : {}),
      },
      orderBy: { name: 'asc' },
    });
    res.json({ data, message: 'Sites fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const getSiteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.site.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ data, message: 'Site fetched successfully' });
  } catch (error) {
    next(error);
  }
};

export const createSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.site.create({ data: req.body });
    res.status(201).json({ data, message: 'Site created successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.site.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data, message: 'Site updated successfully' });
  } catch (error) {
    next(error);
  }
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const nearbySites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radiusKm = Number(req.query.radiusKm || 5);

    const sites = await prisma.site.findMany({ where: { isActive: true } });
    const data = sites.filter((site) => haversineKm(latitude, longitude, site.latitude, site.longitude) <= radiusKm);

    res.json({ data, message: 'Nearby sites fetched successfully' });
  } catch (error) {
    next(error);
  }
};
