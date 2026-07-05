import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('student RBAC acceptance', () => {
  let app: Express;
  let studentToken: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    studentToken = await login(app, 'student1');
  }, 60000);

  it('allows GET /me for student', async () => {
    const res = await request(app).get('/api/v1/me').set(authHeader(studentToken));
    expect(res.status).toBe(200);
    expect(res.body.roles).toContain('student');
  });

  it('denies GET /modules for student', async () => {
    const res = await request(app).get('/api/v1/modules').set(authHeader(studentToken));
    expect(res.status).toBe(403);
  });

  it('denies GET /config for student', async () => {
    const res = await request(app).get('/api/v1/config/instance').set(authHeader(studentToken));
    expect(res.status).toBe(403);
  });

  it('denies GET /admin-users for student', async () => {
    const res = await request(app).get('/api/v1/admin-users').set(authHeader(studentToken));
    expect(res.status).toBe(403);
  });

  it('denies POST /projects for student', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set(authHeader(studentToken))
      .send({ title: 'x', description: 'y', organizationName: 'z', categories: [] });
    expect(res.status).toBe(403);
  });
});
