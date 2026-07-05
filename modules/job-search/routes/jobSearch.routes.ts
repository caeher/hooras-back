import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../app/middleware/asyncHandler';
import { validate } from '../../../app/middleware/validate';
import { authMiddleware, rbac } from '../../../app/middleware/auth';
import { BadRequestError } from '../../../app/utils/errors';
import { searchJobs, scrapeContactInfo, FirecrawlServiceError } from '../services/firecrawl.service';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  query: z.string().min(1, 'query is required').max(200),
  categories: z.array(z.string()).optional(),
  location: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

const scrapeContactSchema = z.object({
  url: z.string().url('url must be a valid URL'),
});

// ---------------------------------------------------------------------------
// Error handler helper for Firecrawl errors
// ---------------------------------------------------------------------------

function handleFirecrawlError(error: unknown, res: Response): void {
  if (error instanceof FirecrawlServiceError) {
    res.status(error.statusCode ?? 500).json({
      message: error.message,
      code: error.code,
    });
    return;
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/job-search/search
 * Search job listings via Firecrawl.
 * Restricted to coordinator and admin roles.
 */
router.post(
  '/search',
  authMiddleware,
  rbac('coordinator', 'admin'),
  validate(searchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, categories, location, limit } = req.body as z.infer<typeof searchSchema>;

    if (!query.trim()) {
      throw new BadRequestError('Query cannot be empty');
    }

    try {
      const results = await searchJobs({ query, categories, location, limit });
      res.json({ results, total: results.length });
    } catch (error) {
      handleFirecrawlError(error, res);
    }
  }),
);

/**
 * POST /api/v1/job-search/scrape-contact
 * Scrape contact information from a given URL.
 * Restricted to coordinator and admin roles.
 */
router.post(
  '/scrape-contact',
  authMiddleware,
  rbac('coordinator', 'admin'),
  validate(scrapeContactSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as z.infer<typeof scrapeContactSchema>;

    try {
      const contactInfo = await scrapeContactInfo(url);
      res.json(contactInfo);
    } catch (error) {
      handleFirecrawlError(error, res);
    }
  }),
);

export default router;
