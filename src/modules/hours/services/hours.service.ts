import db from '../../../database';
import { HoursServiceV1 } from '../../../platform/contracts/services';

export const hoursService: HoursServiceV1 = {
  async getStudentHours(studentRef) {
    const assignments = await db('assignments').where({ student_ref: studentRef }).select('id');
    if (!assignments.length) return 0;
    const ids = assignments.map((a) => a.id);
    const result = await db('hour_logs')
      .whereIn('assignment_id', ids)
      .where({ status: 'approved' })
      .sum('duration_hours as total')
      .first();
    return Number(result?.total ?? 0);
  },
};
