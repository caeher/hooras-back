import { Router, Request, Response } from 'express';
import { resolvePublicBaseUrl } from '../../../config/publicUrl';
import db from '../../../database';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { UnauthorizedError } from '../../../app/utils/errors';
import { getDemoUserInfo, introspectDemoToken, issuePasswordToken } from './service';

const router = Router();

router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  const baseUrl = `${resolvePublicBaseUrl()}/demo-auth`;
  res.json({
    issuer: baseUrl,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
  });
});

router.post('/oauth/token', asyncHandler(async (req: Request, res: Response) => {
  const { grantType, username, password, providerProfile } = req.body;
  if (grantType !== 'password') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const result = await issuePasswordToken(username, password, providerProfile);
  res.json(result);
}));

router.post('/oauth/introspect', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  const result = await introspectDemoToken(token);
  res.json(result);
}));

router.get('/userinfo', asyncHandler(async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new UnauthorizedError();
  const token = auth.slice(7);
  const user = await getDemoUserInfo(token);
  res.json({
    sub: user.externalUserId,
    externalUserId: user.externalUserId,
    externalStudentId: user.studentRef?.replace(/^student:/, ''),
    displayName: user.displayName,
    email: user.email,
    roles: user.roles,
  });
}));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  let query = db('demo_users').select(
    'external_user_id as externalUserId',
    'external_student_id as externalStudentId',
    'display_name as displayName',
    'email',
    'roles',
    'provider_profile as providerProfile'
  );
  if (req.query.role) {
    query = query.whereRaw('roles::text ILIKE ?', [`%${req.query.role}%`]);
  }
  const users = await query;
  res.json(users.map((u) => ({
    sub: u.externalUserId,
    ...u,
    roles: typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles,
  })));
}));

export default router;
