import { Request, Response, NextFunction } from 'express';
import { GoneError } from '../../app/utils/errors';
import { SetupService } from './SetupService';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  return req.ip ?? 'unknown';
}

export function setupRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many setup requests. Try again later.',
    });
    return;
  }

  next();
}

export async function requireSetupIncomplete(_req: Request, _res: Response, next: NextFunction) {
  try {
    if (await SetupService.isComplete()) {
      return next(new GoneError('Setup already completed'));
    }
    next();
  } catch (err) {
    next(err);
  }
}
