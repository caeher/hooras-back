import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware } from '../../../app/middleware/auth';
import { NotFoundError } from '../../../app/utils/errors';
import { mapAssignment } from '../services/assignments.service';

const supervisorSchema = z.object({ supervisorRef: z.string() });

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('assignments').select('*');
  if (req.query.studentRef) query = query.where({ student_ref: req.query.studentRef });
  if (req.query.projectId) query = query.where({ project_id: req.query.projectId });
  if (req.user?.roles.includes('student') && !req.user.roles.some((r) => ['admin', 'coordinator', 'faculty_supervisor'].includes(r))) {
    query = query.where({ student_ref: req.user.studentRef });
  }
  const rows = await query;
  res.json(rows.map(mapAssignment));
}));

router.put('/:assignmentId/supervisor', authMiddleware, validate(supervisorSchema), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('assignments')
    .where({ id: req.params.assignmentId })
    .update({ supervisor_ref: req.body.supervisorRef, updated_at: new Date() })
    .returning('*');
  if (!row) throw new NotFoundError('Assignment not found');
  res.json(mapAssignment(row));
}));

export default router;
