import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { isStudentOnly } from '../rbac/staffRoles';
import { isStudentRouteAllowed } from '../rbac/studentAllowedRoutes';

export function studentWhitelist(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();
  if (!isStudentOnly(req.user.roles)) return next();
  if (isStudentRouteAllowed(req.method, req.originalUrl)) return next();
  return next(new ForbiddenError('Students may only access explicitly allowed endpoints'));
}
