import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../app/middleware/auth';
import { ModuleRegistry } from '../../platform/registry/ModuleRegistry';
import { ForbiddenError } from '../../app/utils/errors';
import { isStudentOnly } from '../../app/rbac/staffRoles';
import { param } from '../../app/utils/params';

const router = Router();

router.get('/students', authMiddleware, rbac('coordinator', 'admin', 'faculty_supervisor'), asyncHandler(async (req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const query = req.query.query as string;
  if (!query) return res.json([]);
  const results = await connector.searchStudents(query);
  res.json(results);
}));

router.get('/students/:studentRef/academic-profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const studentRef = decodeURIComponent(param(req.params.studentRef));
  if (
    req.user &&
    isStudentOnly(req.user.roles) &&
    req.user.studentRef !== studentRef
  ) {
    throw new ForbiddenError('Cannot access another student academic profile');
  }
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const profile = await connector.getStudentProfile(studentRef);
  res.json(profile);
}));

router.get('/schema', authMiddleware, rbac('admin', 'coordinator'), asyncHandler(async (_req: Request, res: Response) => {
  const connector = await ModuleRegistry.getActiveStudentDataConnector();
  const schema = await connector.getSchema();
  res.json(schema);
}));

export default router;
