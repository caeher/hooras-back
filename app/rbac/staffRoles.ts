import { UserRole } from '../../platform/types';

export const STAFF_ROLES: UserRole[] = [
  'admin',
  'coordinator',
  'faculty_supervisor',
  'external_supervisor',
  'auditor',
];

export function isStudentOnly(roles: UserRole[]): boolean {
  return roles.includes('student') && !roles.some((r) => STAFF_ROLES.includes(r));
}

export function isStaff(roles: UserRole[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}
