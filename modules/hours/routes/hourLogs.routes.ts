import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { isStudentOnly } from '../../../app/rbac/staffRoles';
import { NotFoundError, ForbiddenError } from '../../../app/utils/errors';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { NOTIFICATIONS_V1, NotificationsServiceV1 } from '../../../platform/contracts/services';
import { enrichHourLogsWithEvidence, mapHourLogRow } from '../services/hourLogMapper';

const hourLogSchema = z.object({
  assignmentId: z.string().uuid(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationHours: z.number().positive(),
  category: z.enum(['disciplinary', 'environmental', 'community', 'research', 'administrative', 'other']),
  description: z.string(),
  evidenceIds: z.array(z.string().uuid()).optional(),
});

const rejectSchema = z.object({ reason: z.string() });

const router = Router();

router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  let query = db('hour_logs').select('*');
  if (req.query.assignmentId) query = query.where({ assignment_id: req.query.assignmentId });
  if (req.query.status) query = query.where({ status: req.query.status });
  if (req.user && isStudentOnly(req.user.roles)) {
    const assignmentIds = await db('assignments')
      .where({ student_ref: req.user.studentRef })
      .pluck('id');
    query = query.whereIn('assignment_id', assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000']);
  }
  const rows = await query.orderBy('created_at', 'desc');
  res.json(await enrichHourLogsWithEvidence(rows.map(mapHourLogRow)));
}));

router.post('/', authMiddleware, rbac('student'), validate(hourLogSchema), asyncHandler(async (req: Request, res: Response) => {
  const assignment = await db('assignments').where({ id: req.body.assignmentId }).first();
  if (!assignment) throw new NotFoundError('Assignment not found');
  if (assignment.student_ref !== req.user!.studentRef) {
    throw new ForbiddenError('Cannot log hours for another student assignment');
  }
  const [row] = await db('hour_logs')
    .insert({
      id: uuidv4(),
      assignment_id: req.body.assignmentId,
      date: req.body.date,
      start_time: req.body.startTime,
      end_time: req.body.endTime,
      duration_hours: req.body.durationHours,
      category: req.body.category,
      description: req.body.description,
      evidence_ids: JSON.stringify(req.body.evidenceIds ?? []),
      status: 'pending',
      created_at: new Date(),
    })
    .returning('*');
  res.status(201).json(mapHourLogRow(row));
}));

router.post('/:hourLogId/approve', authMiddleware, rbac('faculty_supervisor', 'external_supervisor', 'coordinator', 'admin'), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('hour_logs')
    .where({ id: req.params.hourLogId })
    .update({ status: 'approved' })
    .returning('*');
  if (!row) throw new NotFoundError('Hour log not found');
  const assignment = await db('assignments').where({ id: row.assignment_id }).first();
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'hour_log.approved',
    entityType: 'hour_log',
    entityId: row.id as string,
  });
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('hours_approved', assignment?.student_ref as string ?? '', {
    studentRef: assignment?.student_ref,
    hourLogId: row.id,
    durationHours: row.duration_hours,
  });
  res.json(mapHourLogRow(row));
}));

router.post('/:hourLogId/reject', authMiddleware, rbac('faculty_supervisor', 'external_supervisor', 'coordinator', 'admin'), validate(rejectSchema), asyncHandler(async (req: Request, res: Response) => {
  const [row] = await db('hour_logs')
    .where({ id: req.params.hourLogId })
    .update({ status: 'rejected', rejection_reason: req.body.reason })
    .returning('*');
  if (!row) throw new NotFoundError('Hour log not found');
  const assignment = await db('assignments').where({ id: row.assignment_id }).first();
  const notifications = getService<NotificationsServiceV1>(NOTIFICATIONS_V1);
  await notifications.send('hours_rejected', assignment?.student_ref as string ?? '', {
    studentRef: assignment?.student_ref,
    hourLogId: row.id,
    reason: req.body.reason,
  });
  res.json(mapHourLogRow(row));
}));

export default router;
