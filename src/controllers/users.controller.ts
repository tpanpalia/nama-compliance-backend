import { NextFunction, Request, Response } from 'express';
import * as UsersService from '../services/users.service';
import { CreateUserSchema, UpdateUserStatusSchema } from '../services/users.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await UsersService.listUsers({
      role: req.query.role as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await UsersService.getUserById(req.user!.dbUserId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await UsersService.getUserById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await UsersService.createUser(parsed.data);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = await UsersService.updateUserStatus(
      req.params.id,
      parsed.data.isActive,
      req.user!.dbUserId!
    );
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
};
