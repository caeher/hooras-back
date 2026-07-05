import { Router, Request, Response } from 'express';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { authMiddleware, rbac } from '../../../app/middleware/auth';

const router = Router();

router.get('/progress', authMiddleware, rbac('coordinator', 'admin', 'auditor'), asyncHandler(async (_req: Request, res: Response) => {
  const totalStudents = await db('student_refs').count('id as count').first();
  const eligibleEvaluations = await db('requirement_evaluations')
    .where({ status: 'eligible' })
    .count('id as count')
    .first();
  const activeAssignments = await db('assignments').where({ status: 'active' }).count('id as count').first();
  const completedAssignments = await db('assignments').where({ status: 'completed' }).count('id as count').first();
  const approvedHours = await db('hour_logs').where({ status: 'approved' }).sum('duration_hours as total').first();
  const pendingHourLogs = await db('hour_logs').where({ status: 'pending' }).count('id as count').first();

  res.json({
    totalStudents: Number(totalStudents?.count ?? 0),
    eligibleStudents: Number(eligibleEvaluations?.count ?? 0),
    activeAssignments: Number(activeAssignments?.count ?? 0),
    completedAssignments: Number(completedAssignments?.count ?? 0),
    approvedHours: Number(approvedHours?.total ?? 0),
    pendingHourLogs: Number(pendingHourLogs?.count ?? 0),
  });
}));

router.get('/projects', authMiddleware, rbac('coordinator', 'admin', 'auditor'), asyncHandler(async (_req: Request, res: Response) => {
  const totalProjects = await db('projects').count('id as count').first();
  const publishedProjects = await db('projects')
    .whereIn('status', ['published', 'accepting_applications', 'in_execution'])
    .count('id as count')
    .first();
  const scrapedPendingReview = await db('import_results')
    .where({ status: 'pending_review' })
    .count('id as count')
    .first();
  const applications = await db('project_applications').count('id as count').first();
  const activeAssignments = await db('assignments').where({ status: 'active' }).count('id as count').first();

  res.json({
    totalProjects: Number(totalProjects?.count ?? 0),
    publishedProjects: Number(publishedProjects?.count ?? 0),
    scrapedPendingReview: Number(scrapedPendingReview?.count ?? 0),
    applications: Number(applications?.count ?? 0),
    activeAssignments: Number(activeAssignments?.count ?? 0),
  });
}));

export default router;
