import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import db from '../../../database';
import { env } from '../../../config/env';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { UnauthorizedError } from '../../../app/utils/errors';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

const router = Router();

router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  res.json({
    issuer: `${env.BASE_URL}/demo-auth`,
    token_endpoint: `${env.BASE_URL}/demo-auth/oauth/token`,
    userinfo_endpoint: `${env.BASE_URL}/demo-auth/userinfo`,
    introspection_endpoint: `${env.BASE_URL}/demo-auth/oauth/introspect`,
  });
});

router.post('/oauth/token', asyncHandler(async (req: Request, res: Response) => {
  const { grantType, username, password } = req.body;
  if (grantType !== 'password') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const user = await db('demo_users').where({ username }).first();
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;
  const token = jwt.sign(
    { sub: user.external_user_id, roles, providerProfile: user.provider_profile },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ accessToken: token, tokenType: 'Bearer', expiresIn: 28800 });
}));

router.post('/oauth/introspect', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    res.json({
      active: true,
      sub: payload.sub,
      roles: payload.roles,
      exp: payload.exp,
    });
  } catch {
    res.json({ active: false });
  }
}));

router.get('/userinfo', asyncHandler(async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new UnauthorizedError();
  const token = auth.slice(7);
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  const user = await db('demo_users').where({ external_user_id: payload.sub }).first();
  if (!user) throw new UnauthorizedError();
  const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;
  res.json({
    sub: user.external_user_id,
    externalUserId: user.external_user_id,
    externalStudentId: user.external_student_id,
    displayName: user.display_name,
    email: user.email,
    roles,
    providerProfile: user.provider_profile,
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
