import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/middleware/asyncHandler';
import { validate } from '../../app/middleware/validate';
import { SetupService } from './SetupService';
import { requireSetupIncomplete, setupRateLimit } from './setup.middleware';

const instanceSchema = z.object({
  collegeName: z.string().min(1),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  demoMode: z.boolean().optional(),
});

const connectorSchema = z.object({
  moduleKey: z.string().min(1),
  useDemoProvider: z.boolean().optional(),
  values: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
  features: z
    .array(
      z.object({
        featureKey: z.string(),
        enabled: z.boolean(),
      }),
    )
    .optional(),
});

const modulesSchema = z.object({
  moduleKeys: z.array(z.string().min(1)),
});

const adminSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
});

const router = Router();

router.use(setupRateLimit);

router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const status = await SetupService.getStatus();
    res.json(status);
  }),
);

router.get(
  '/modules',
  requireSetupIncomplete,
  asyncHandler(async (req: Request, res: Response) => {
    const moduleType = req.query.type as string | undefined;
    const modules = await SetupService.listModulesForSetup(
      moduleType as Parameters<typeof SetupService.listModulesForSetup>[0],
    );
    res.json(modules);
  }),
);

router.put(
  '/instance',
  requireSetupIncomplete,
  validate(instanceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await SetupService.saveInstance(req.body);
    res.json(status);
  }),
);

router.put(
  '/connectors/:type',
  requireSetupIncomplete,
  validate(connectorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type;
    if (type !== 'auth' && type !== 'student-data') {
      res.status(400).json({ message: 'Connector type must be auth or student-data' });
      return;
    }
    const status = await SetupService.configureConnector(type, req.body);
    res.json(status);
  }),
);

router.put(
  '/modules',
  requireSetupIncomplete,
  validate(modulesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await SetupService.configureModules(req.body.moduleKeys);
    res.json(status);
  }),
);

router.post(
  '/admin',
  requireSetupIncomplete,
  validate(adminSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await SetupService.createAdmin(req.body);
    res.json(status);
  }),
);

router.post(
  '/test',
  requireSetupIncomplete,
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await SetupService.testConnectors();
    res.json(result);
  }),
);

router.post(
  '/complete',
  requireSetupIncomplete,
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await SetupService.complete();
    res.json(result);
  }),
);

export default router;
