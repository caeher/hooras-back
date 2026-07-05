import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('rules acceptance', () => {
  let app: Express;
  let studentToken: string;
  let coordinatorToken: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    studentToken = await login(app, 'student1');
    coordinatorToken = await login(app, 'coordinator1');
  }, 60000);

  it('student cannot list global rules', async () => {
    const res = await request(app).get('/api/v1/rules').set(authHeader(studentToken));
    expect(res.status).toBe(403);
  });

  it('coordinator can list rules', async () => {
    const res = await request(app).get('/api/v1/rules').set(authHeader(coordinatorToken));
    expect(res.status).toBe(200);
  });
});
