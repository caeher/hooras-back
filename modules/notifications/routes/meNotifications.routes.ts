import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { authMiddleware } from '../../../app/middleware/auth';
import { ForbiddenError } from '../../../app/utils/errors';
import { param } from '../../../app/utils/params';
import { getService } from '../../../platform/module/ServiceRegistry';
import { NOTIFICATIONS_V1, NotificationsServiceV1 } from '../../../platform/contracts/services';

const router = Router();

function requireStudent(req: Request) {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  return req.user.studentRef;
}

router.get('/notifications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  const items = await notifications.listForStudent(studentRef, {
    unreadOnly: req.query.unreadOnly === 'true',
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json(items);
}));

router.patch('/notifications/:id/read', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = requireStudent(req);
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  const item = await notifications.markRead(param(req.params.id), studentRef);
  res.json(item);
}));

export default router;
