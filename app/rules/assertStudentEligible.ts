import { RuleEvaluationResult } from '../../platform/types';
import { getService } from '../../platform/module/ServiceRegistry';
import { RULES_V1, RulesServiceV1 } from '../../platform/contracts/services';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { writeAuditEvent } from '../utils/audit';

export async function assertStudentEligibleForAction(
  studentRef: string,
  projectId?: string,
  actorRef?: string,
): Promise<RuleEvaluationResult> {
  const rulesService = getService<RulesServiceV1>(RULES_V1);
  const result = await rulesService.evaluateRules(studentRef, undefined, projectId);

  if (result.status === 'not_eligible') {
    if (actorRef) {
      await writeAuditEvent({
        actorRef,
        action: 'rule.blocked',
        entityType: 'student',
        entityId: studentRef,
        metadata: { reason: result.explanation, projectId },
      });
    }
    throw new ForbiddenError(result.explanation ?? 'Student is not eligible');
  }
  if (result.status === 'missing_data') {
    throw new BadRequestError(
      `Missing academic data: ${(result.missingData ?? []).join(', ')}`,
      'MISSING_DATA',
      result,
    );
  }
  if (result.status === 'manual_review') {
    throw new BadRequestError('Action pending manual review', 'MANUAL_REVIEW', result);
  }

  return result;
}
