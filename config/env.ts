import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(64),
  WEBHOOK_SECRET: z.string().min(8),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  STUDENT_PROFILE_CACHE_TTL_MINUTES: z.coerce.number().default(30),
  FIRECRAWL_API_KEY: optionalNonEmptyString,
  FIRECRAWL_API_URL: z.string().url().default('https://api.firecrawl.dev/v1'),
  FIRECRAWL_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  N8N_WEBHOOK_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional()
  ),
  N8N_API_KEY: optionalNonEmptyString,
  N8N_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  N8N_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'test') {
    throw new Error('Invalid environment configuration for tests');
  }
  process.exit(1);
}

export const env = parsed.data;
