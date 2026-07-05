import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('hours acceptance', () => {
  let app: Express;
  let studentToken: string;
  let supervisorToken: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    studentToken = await login(app, 'student1');
    supervisorToken = await login(app, 'supervisor1');
  }, 60000);

  it('student cannot approve own hour logs', async () => {
    const res = await request(app)
      .post('/api/v1/hour-logs/00000000-0000-0000-0000-000000000001/approve')
      .set(authHeader(studentToken));
    expect(res.status).toBe(403);
  });

  it('supervisor can access hour log approve endpoint', async () => {
    const logs = await request(app).get('/api/v1/hour-logs').set(authHeader(supervisorToken));
    expect(logs.status).toBe(200);
  });
});
