import { NextFunction, Request, Response } from 'express';
import { reverseGeocode } from '../utils/reverseGeocode';

export const getReverseGeocode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        error: 'Invalid lat/lng parameters',
      });
    }

    const location = await reverseGeocode(lat, lng);

    return res.json({ data: location });
  } catch (err) {
    return next(err);
  }
};
