import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { ForbiddenError } from '../../../app/utils/errors';
import { isStudentOnly } from '../../../app/rbac/staffRoles';
import { writeAuditEvent } from '../../../app/utils/audit';
import { getService } from '../../../platform/module/ServiceRegistry';
import { RULES_V1, RulesServiceV1 } from '../../../platform/contracts/services';

const ruleInputSchema = z.object({
  name: z.string(),
  scope: z.object({
    facultyCode: z.string().optional(),
    programCode: z.string().optional(),
    degreeLevel: z.string().optional(),
    modality: z.string().optional(),
  }).optional(),
  requiredHours: z.number(),
  categoryHours: z.record(z.number()).optional(),
  minimumProgressPercentage: z.number().optional(),
  requiredAcademicStatuses: z.array(z.string()).optional(),
  requiredCourseCodes: z.array(z.string()).optional(),
  calendarDuration: z.object({
    value: z.number(),
    unit: z.enum(['days', 'weeks', 'months', 'years']),
  }).optional(),
  active: z.boolean().optional(),
});

const evaluateSchema = z.object({
  studentRef: z.string(),
  projectId: z.string().uuid().optional(),
  academicProfile: z.record(z.unknown()).optional(),
});

const router = Router();

router.get('/', authMiddleware, rbac('admin', 'coordinator'), asyncHandler(async (req: Request, res: Response) => {
  const rulesService = getService<RulesServiceV1>(RULES_V1);
  const rules = await rulesService.listRules({
    facultyCode: req.query.facultyCode as string,
    programCode: req.query.programCode as string,
    degreeLevel: req.query.degreeLevel as string,
  });
  res.json(rules);
}));

router.post('/', authMiddleware, rbac('admin', 'coordinator'), validate(ruleInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const rulesService = getService<RulesServiceV1>(RULES_V1);
  const rule = await rulesService.createRule(req.body);
  await writeAuditEvent({
    actorRef: req.user!.externalUserId,
    action: 'rule.created',
    entityType: 'requirement_rule',
    entityId: (rule as { id: string }).id,
  });
  res.status(201).json(rule);
}));

router.post('/evaluate', authMiddleware, validate(evaluateSchema), asyncHandler(async (req: Request, res: Response) => {
  if (
    req.user &&
    isStudentOnly(req.user.roles) &&
    req.body.studentRef !== req.user.studentRef
  ) {
    throw new ForbiddenError('Cannot evaluate rules for another student');
  }
  const rulesService = getService<RulesServiceV1>(RULES_V1);
  const result = await rulesService.evaluateRules(
    req.body.studentRef,
    req.body.academicProfile,
    req.body.projectId
  );
  res.json(result);
}));

export default router;
