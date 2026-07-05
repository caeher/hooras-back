import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrapPlatform } from '../../server/bootstrap';
import { authHeader, login } from '../helpers/auth';

describe('documents acceptance', () => {
  let app: Express;
  let adminToken: string;
  let studentToken: string;
  let requirementId: string;

  beforeAll(async () => {
    app = await bootstrapPlatform();
    adminToken = await login(app, 'admin1');
    studentToken = await login(app, 'student1');
  }, 60000);

  it('admin creates document requirement and student sees it', async () => {
    const createRes = await request(app)
      .post('/api/v1/document-requirements')
      .set(authHeader(adminToken))
      .send({
        key: `test-req-${Date.now()}`,
        label: 'Test ID Document',
        description: 'Upload national ID',
        required: true,
        allowedFileTypes: ['application/pdf', 'image/jpeg'],
        maxFileSizeMb: 5,
      });
    expect(createRes.status).toBe(201);
    requirementId = createRes.body.id;

    const listRes = await request(app)
      .get('/api/v1/me/document-requirements')
      .set(authHeader(studentToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((item: { requirement: { id: string } }) => item.requirement.id === requirementId)).toBe(true);
  });

  it('student uploads allowed MIME type', async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/me/document-requirements/${requirementId}/upload`)
      .set(authHeader(studentToken))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.status).toBe('pending');
  });
});
