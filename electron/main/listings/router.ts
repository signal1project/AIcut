import { Router } from 'express';
import { z } from 'zod';
import type { ListingStore } from './listingStore';

const capturePayloadSchema = z.object({
  source: z.enum(['zillow', 'realtor', 'redfin', 'manual']),
  mlsNumber: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().optional(),
  price: z.number().int().nonnegative().optional(),
  beds: z.number().nonnegative().optional(),
  baths: z.number().nonnegative().optional(),
  sqft: z.number().int().nonnegative().optional(),
  lotSqft: z.number().int().nonnegative().optional(),
  yearBuilt: z.number().int().optional(),
  propertyType: z.string().optional(),
  status: z.string().optional(),
  daysOnMarket: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  photoUrls: z.array(z.string()).max(20).optional(),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: z.string().optional(),
  listingUrl: z.string().optional(),
});

const listQuerySchema = z.object({
  source: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Listing Scraper routes (mounted under the authed /api as /api/listings):
 *
 *   POST   /api/listings/capture — save a captured listing (dedupe by listingUrl)
 *   GET    /api/listings         — list with source/state/city/status filters
 *   GET    /api/listings/:id     — single listing detail
 *   DELETE /api/listings/:id     — remove a listing
 *
 * The Chrome extension reaches `capture` through the fixed-port capture
 * server (see captureServer.ts) since it cannot obtain the rotating bearer
 * token; the UI and MCP agents use these authed routes.
 */
export function createListingsRouter(store: ListingStore): Router {
  const router = Router();

  router.post('/capture', async (req, res, next) => {
    try {
      const payload = capturePayloadSchema.parse(req.body);
      const listing = await store.capture(payload);
      res.status(201).json({ listing });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const result = await store.list(q);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const listing = await store.get(req.params.id);
      if (!listing) {
        res.status(404).json({ error: 'listing_not_found' });
        return;
      }
      res.json({ listing });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const removed = await store.remove(req.params.id);
      if (!removed) {
        res.status(404).json({ error: 'listing_not_found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
