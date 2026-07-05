import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';
import db from '../../database';

describe('applications acceptance', () => {
  let app: Express;
  let studentToken: string;
  let coordinatorToken: string;
  let projectId: string;
  let applicationId: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    await db('assignments').where({ student_ref: 'student:STU-001' }).update({ status: 'cancelled' });
    await db('project_applications')
      .where({ student_ref: 'student:STU-001' })
      .whereNotIn('status', ['rejected', 'cancelled'])
      .update({ status: 'cancelled' });
    studentToken = await login(app, 'student1');
    coordinatorToken = await login(app, 'coordinator1');
  }, 60000);

  it('coordinator creates and publishes project', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set(authHeader(coordinatorToken))
      .send({
        title: `Social Project ${Date.now()}`,
        description: 'Community service project',
        organizationName: 'Demo NGO',
        categories: ['community'],
        projectType: 'community',
        offeredHours: 80,
        companyLinks: [{ label: 'Website', url: 'https://example.org' }],
      });
    expect(createRes.status).toBe(201);
    projectId = createRes.body.id;

    const publishRes = await request(app)
      .post(`/api/v1/projects/${projectId}/publish`)
      .set(authHeader(coordinatorToken));
    expect(publishRes.status).toBe(200);
  });

  it('student applies and application is submitted', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/applications`)
      .set(authHeader(studentToken))
      .send({ motivation: 'I want to help' });
    if (res.status !== 201) {
      console.error('apply failed', res.status, res.text);
    }
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('submitted');
    applicationId = res.body.id;
  });

  it('coordinator approves and creates active assignment', async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${applicationId}/approve`)
      .set(authHeader(coordinatorToken));
    expect(res.status).toBe(200);

    const assignments = await request(app)
      .get('/api/v1/me/assignments')
      .set(authHeader(studentToken));
    expect(assignments.status).toBe(200);
    expect(Array.isArray(assignments.body)).toBe(true);
    expect(assignments.body.some((a: { status: string }) => a.status === 'active')).toBe(true);
  });
});
