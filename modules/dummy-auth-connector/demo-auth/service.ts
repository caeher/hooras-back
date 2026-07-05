import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../../../database';
import { env } from '../../../config/env';
import { BadRequestError, UnauthorizedError } from '../../../app/utils/errors';
import { CurrentUser, UserRole } from '../../../platform/types';

const VALID_ROLES: UserRole[] = [
  'student', 'coordinator', 'faculty_supervisor', 'external_supervisor', 'admin', 'auditor',
];

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function parseRoles(roles: unknown): string[] {
  return typeof roles === 'string' ? JSON.parse(roles) : (roles as string[]);
}

function mapExternalRoles(roles: string[]): UserRole[] {
  return roles.filter((r): r is UserRole => VALID_ROLES.includes(r as UserRole));
}

export interface DemoAuthTokenResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export async function issuePasswordToken(
  username: string,
  password: string,
  providerProfile = 'default',
): Promise<DemoAuthTokenResult> {
  const user = await db('demo_users').where({ username }).first();
  if (!user || user.password_hash !== hashPassword(password)) {
    throw new BadRequestError('Invalid credentials');
  }

  const roles = parseRoles(user.roles);
  const token = jwt.sign(
    { sub: user.external_user_id, roles, providerProfile: user.provider_profile ?? providerProfile },
    env.JWT_SECRET,
    { expiresIn: '8h' },
  );

  return { accessToken: token, tokenType: 'Bearer', expiresIn: 28800 };
}

export async function getDemoUserInfo(token: string): Promise<CurrentUser> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new UnauthorizedError('Failed to get user info');
  }

  const user = await db('demo_users').where({ external_user_id: payload.sub }).first();
  if (!user) throw new UnauthorizedError('Failed to get user info');

  const roles = parseRoles(user.roles);
  return {
    externalUserId: user.external_user_id,
    moduleKey: 'dummy-auth-connector',
    providerKey: 'dummy-auth',
    displayName: user.display_name,
    email: user.email,
    roles: mapExternalRoles(roles),
    studentRef: user.external_student_id ? `student:${user.external_student_id}` : undefined,
  };
}

export async function introspectDemoToken(token: string): Promise<{
  active: boolean;
  sub?: string;
  roles?: string[];
  exp?: number;
}> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return {
      active: true,
      sub: payload.sub as string,
      roles: payload.roles as string[],
      exp: payload.exp,
    };
  } catch {
    return { active: false };
  }
}
