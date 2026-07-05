import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { authMiddleware } from '../../../app/middleware/auth';
import { ForbiddenError } from '../../../app/utils/errors';
import { getService } from '../../../platform/module/ServiceRegistry';
import {
  RULES_V1,
  RulesServiceV1,
  STUDENT_PROFILE_V1,
  StudentProfileServiceV1,
} from '../../../platform/contracts/services';
import { buildStudentProfile } from '../services/studentProfile.service';

const router = Router();

router.get('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  const profileService = getService<StudentProfileServiceV1>(STUDENT_PROFILE_V1);
  const profile = await profileService.buildProfile(req.user.studentRef);
  res.json(profile);
}));

router.post('/profile/refresh', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.studentRef) throw new ForbiddenError('Current user is not a student');
  const profileService = getService<StudentProfileServiceV1>(STUDENT_PROFILE_V1);
  const rulesService = getService<RulesServiceV1>(RULES_V1);
  await profileService.refreshProfile(req.user.studentRef);
  const eligibility = await rulesService.evaluateRules(req.user.studentRef);
  const profile = await buildStudentProfile(req.user.studentRef, eligibility);
  res.json(profile);
}));

export default router;
