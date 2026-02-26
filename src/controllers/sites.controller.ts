import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import * as SitesService from '../services/sites.service';
import { CreateSiteSchema, UpdateSiteSchema } from '../services/sites.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = req.query.region as string | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const data = await SitesService.listSites({ region, isActive });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SitesService.getSiteById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await SitesService.createSite(parsed.data);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await SitesService.updateSite(req.params.id, parsed.data);
    res.json({ data });
  } catch (err) {
    next(err);
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

export const nearbySites = async (req: Request, res: Response): Promise<void> => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radiusKm = Number(req.query.radiusKm || 5);

    const sites = await prisma.site.findMany({ where: { isActive: true } });
    const data = sites.filter((site) => haversineKm(latitude, longitude, site.latitude, site.longitude) <= radiusKm);

    res.status(200).json({ data });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
