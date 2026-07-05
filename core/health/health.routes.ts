import { Router, Request, Response } from 'express';
import db from '../../database';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { SetupService } from '../setup/SetupService';

const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await db.raw('SELECT 1');
  } catch {
    dbStatus = 'down';
  }
  const setupCompleted = await SetupService.isComplete();
  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    db: dbStatus,
    setupCompleted,
    checkedAt: new Date().toISOString(),
  });
}));

export default router;
