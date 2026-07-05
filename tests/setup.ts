import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
process.env.BASE_URL = 'http://localhost:3000';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-jwt-secret-min-16-chars';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'test-webhook-secret';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? '*';
process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND ?? 'local';
