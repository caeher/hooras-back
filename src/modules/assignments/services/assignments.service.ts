import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import { AssignmentsServiceV1 } from '../../../platform/contracts/services';
import { getService } from '../../../platform/module/ServiceRegistry';
import { PROJECTS_V1, ProjectsServiceV1 } from '../../../platform/contracts/services';

function mapAssignment(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    studentRef: row.student_ref,
    supervisorRef: row.supervisor_ref,
    status: row.status,
  };
}

export const assignmentsService: AssignmentsServiceV1 = {
  async createFromApplication(projectId, studentRef) {
    const projects = getService<ProjectsServiceV1>(PROJECTS_V1);
    const project = await projects.getById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    const [row] = await db('assignments')
      .insert({
        id: uuidv4(),
        project_id: projectId,
        student_ref: studentRef,
        status: 'active',
      })
      .returning('*');
    return mapAssignment(row);
  },

  async listByStudent(studentRef) {
    const rows = await db('assignments').where({ student_ref: studentRef }).select('id');
    return rows.map((r) => ({ id: r.id as string }));
  },
};

export { mapAssignment };
