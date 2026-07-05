import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { AssignmentsServiceV1 } from '../../../platform/contracts/services';
import { getService } from '../../../platform/module/ServiceRegistry';
import { PROJECTS_V1, ProjectsServiceV1 } from '../../../platform/contracts/services';
import { ConflictError, NotFoundError } from '../../../app/utils/errors';
import type { Knex } from 'knex';

const ACTIVE_STATUSES = ['active', 'suspended'];

function mapAssignment(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    studentRef: row.student_ref,
    supervisorRef: row.supervisor_ref,
    status: row.status,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? row.created_at,
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? row.updated_at,
  };
}

export async function assertNoActiveAssignment(studentRef: string, trx?: Knex.Transaction): Promise<void> {
  const query = trx ?? db;
  const existing = await query('assignments')
    .where({ student_ref: studentRef })
    .whereIn('status', ACTIVE_STATUSES)
    .first();
  if (existing) {
    throw new ConflictError('Student already has an active social service assignment');
  }
}

export async function getActiveAssignment(studentRef: string) {
  return db('assignments')
    .where({ student_ref: studentRef })
    .whereIn('status', ACTIVE_STATUSES)
    .first();
}

export const assignmentsService: AssignmentsServiceV1 = {
  async createFromApplication(projectId, studentRef, trx?) {
    const query = trx ?? db;
    await assertNoActiveAssignment(studentRef, trx);

    const projects = getService<ProjectsServiceV1>(PROJECTS_V1);
    const project = await projects.getById(projectId);
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }
    const [row] = await query('assignments')
      .insert({
        id: uuidv4(),
        project_id: projectId,
        student_ref: studentRef,
        status: 'active',
        supervisor_ref: project.companyId || project.organizationName,
      })
      .returning('*');
    return mapAssignment(row);
  },

  async listByStudent(studentRef) {
    const rows = await db('assignments').where({ student_ref: studentRef }).select('id');
    return rows.map((r) => ({ id: r.id as string }));
  },

  async completeAssignment(assignmentId: string) {
    const [row] = await db('assignments')
      .where({ id: assignmentId })
      .update({ status: 'completed', updated_at: new Date() })
      .returning('*');
    return row ? mapAssignment(row) : null;
  },
};

export { mapAssignment };
