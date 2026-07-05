import request from 'supertest';
import type { Express } from 'express';

const BASE = '/api/v1';

export async function login(
  app: Express,
  username: string,
  password = 'demo123',
): Promise<string> {
  const res = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
