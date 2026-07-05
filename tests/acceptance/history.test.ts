import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('social services history acceptance', () => {
  let app: Express;
  let studentToken: string;
  let coordinatorToken: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    studentToken = await login(app, 'student1');
    coordinatorToken = await login(app, 'coordinator1');
  }, 60000);

  it('returns history array for student', async () => {
    const assignments = await request(app)
      .get('/api/v1/me/assignments')
      .set(authHeader(studentToken));
    expect(assignments.status).toBe(200);
    expect(Array.isArray(assignments.body)).toBe(true);
    const active = Array.isArray(assignments.body)
      ? assignments.body.find((a: { status: string }) => a.status === 'active')
      : undefined;
    if (active) {
      await request(app)
        .post(`/api/v1/assignments/${active.id}/complete`)
        .set(authHeader(coordinatorToken));
    }

    const res = await request(app)
      .get('/api/v1/me/social-services/history')
      .set(authHeader(studentToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
