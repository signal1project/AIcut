import express, { type Router } from 'express';
import { z } from 'zod';
import { PubType } from '@mas/types';
import { asyncHandler, validateBody } from '../server/middleware';
import type { Scheduler } from '../scheduling/scheduler';
import type { PublishEngine } from './publishEngine';

const publishBodySchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1),
  pubType: z.nativeEnum(PubType),
  body: z.string().max(63206).default(''),
  hashtags: z.array(z.string()).default([]),
  // Pre-resolved, publicly fetchable media URLs.
  mediaRefs: z.array(z.string()).default([]),
  contentAssetId: z.string().nullable().default(null),
  /** When set (future), the post is scheduled instead of published immediately. */
  runAt: z.coerce.date().optional(),
});

export function createPublishRouter(engine: PublishEngine, scheduler: Scheduler): Router {
  const router = express.Router();

  router.post(
    '/',
    validateBody(publishBodySchema),
    asyncHandler(async (req, res) => {
      const b = req.body as z.infer<typeof publishBodySchema>;
      const content = {
        pubType: b.pubType,
        body: b.body,
        hashtags: b.hashtags,
        mediaUrls: b.mediaRefs,
        contentAssetId: b.contentAssetId,
      };

      if (b.runAt && b.runAt.getTime() > Date.now()) {
        if (!b.contentAssetId) {
          res.status(400).json({ error: 'content_asset_required_for_schedule' });
          return;
        }
        const outcome = await engine.schedule(
          b.accountIds,
          { ...content, contentAssetId: b.contentAssetId },
          b.runAt,
        );
        for (const id of outcome.scheduledPostIds) {
          scheduler.schedule(id, b.runAt, () => {
            void engine.publishNow(b.accountIds, content);
          });
        }
        res.status(202).json({ scheduled: true, scheduledPostIds: outcome.scheduledPostIds });
        return;
      }

      const outcome = await engine.publishNow(b.accountIds, content);
      res.json(outcome);
    }),
  );

  return router;
}
