import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { UserRole } from '../../platform/types';

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }
    const token = header.slice(7);
    const connector = await ModuleRegistry.getActiveAuthConnector();
    const introspection = await connector.introspectToken(token);
    if (!introspection.active) throw new UnauthorizedError('Token is not active');

    const user = await connector.getUserInfo(token);
    req.user = user;
    req.token = token;

    await db('external_user_refs')
      .insert({
        id: uuidv4(),
        external_user_id: user.externalUserId,
        module_key: user.moduleKey,
        provider_key: user.providerKey,
        display_name: user.displayName,
        email: user.email,
        roles: JSON.stringify(user.roles),
        student_ref: user.studentRef,
        last_seen_at: new Date(),
      })
      .onConflict(['external_user_id', 'provider_key'])
      .merge({
        display_name: user.displayName,
        email: user.email,
        roles: JSON.stringify(user.roles),
        student_ref: user.studentRef,
        last_seen_at: new Date(),
        updated_at: new Date(),
      });

    next();
  } catch (e) {
    next(e);
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  return authMiddleware(req, _res, next);
};

export const rbac = (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) return next(new ForbiddenError('Insufficient permissions'));
    next();
  };
