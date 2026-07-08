import express, { type Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../server/middleware';
import type { ClipService } from './clipService';

const autoClipSchema = z.object({
  videoPath: z.string().min(1),
  transcriptSrt: z.string().optional(),
  maxClips: z.number().int().min(1).max(8).optional(),
  clipSeconds: z.number().min(10).max(90).optional(),
  vertical: z.boolean().optional(),
  burnCaptions: z.boolean().optional(),
});

export function createClipsRouter(service: ClipService): Router {
  const router = express.Router();

  /**
   * POST /api/clips/auto — long video in, short vertical highlight clips out.
   * Transcript via SRT/VTT body field or Whisper (OpenAI key in Settings).
   */
  router.post(
    '/auto',
    validateBody(autoClipSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as z.infer<typeof autoClipSchema>;
      const result = await service.autoClip(b);
      res.json(result);
    }),
  );

  return router;
}
