import type { DataSource } from 'typeorm';
import { PubStatus, type Platform, type PubType } from '@mas/types';
import { ScheduledPostModel } from '../../db/models/mas/scheduledPost';
import { ContentAssetModel } from '../../db/models/mas/contentAsset';
import type { PublishEngine } from '../publishEngine';
import type { Scheduler } from '../scheduling/scheduler';
import { logger } from '../../global/log';

/**
 * Reliable scheduled-post firing.
 *
 * Two production gaps this closes:
 *  1. Scheduled rows were never status-updated when their timer fired, so
 *     they stayed QUEUED forever — any rehydration would double-post.
 *     fireScheduledPost() publishes AND marks the row.
 *  2. In-memory timers died with the app. rehydrateScheduledPosts() runs at
 *     boot: overdue QUEUED posts fire immediately (catch-up), future ones
 *     get their timers re-registered.
 */

export interface FiredResult {
  ok: boolean;
  detail: string;
}

export type PublishNotifier = (info: {
  ok: boolean;
  platform: string;
  detail: string;
}) => void;

export async function fireScheduledPost(
  dataSource: DataSource,
  engine: PublishEngine,
  postId: string,
  notify?: PublishNotifier,
): Promise<FiredResult> {
  const posts = dataSource.getRepository(ScheduledPostModel);
  const row = await posts.findOneBy({ id: postId });
  if (!row) return { ok: false, detail: 'scheduled post not found' };
  if (row.status !== PubStatus.QUEUED) {
    return { ok: false, detail: `already ${row.status}` };
  }

  const asset = await dataSource
    .getRepository(ContentAssetModel)
    .findOneBy({ id: row.contentAssetId });
  if (!asset) {
    await posts.update(row.id, { status: PubStatus.FAILED });
    return { ok: false, detail: 'content asset missing' };
  }

  await posts.update(row.id, { status: PubStatus.PUBLISHING });
  try {
    const outcome = await engine.publishNow([row.accountId], {
      pubType: asset.pubType as PubType,
      body: asset.body,
      hashtags: asset.hashtags,
      mediaUrls: asset.mediaRefs,
      contentAssetId: asset.id,
    });
    const ok = outcome.results.every((r) => r.status === 'published');
    await posts.update(row.id, {
      status: ok ? PubStatus.PUBLISHED : PubStatus.FAILED,
    });
    const detail = ok
      ? `Posted to ${row.platform}`
      : (outcome.results.find((r) => r.error)?.error ?? 'publish failed');
    notify?.({ ok, platform: row.platform as Platform, detail });
    return { ok, detail };
  } catch (err) {
    await posts.update(row.id, { status: PubStatus.FAILED });
    const detail = err instanceof Error ? err.message : 'publish failed';
    notify?.({ ok: false, platform: row.platform as Platform, detail });
    return { ok: false, detail };
  }
}

export interface RehydrateSummary {
  caughtUp: number;
  rescheduled: number;
}

export async function rehydrateScheduledPosts(
  dataSource: DataSource,
  engine: PublishEngine,
  scheduler: Scheduler,
  notify?: PublishNotifier,
): Promise<RehydrateSummary> {
  const posts = dataSource.getRepository(ScheduledPostModel);
  const pending = await posts.findBy({ status: PubStatus.QUEUED });
  const now = Date.now();
  let caughtUp = 0;
  let rescheduled = 0;

  for (const row of pending) {
    const runAt = new Date(row.runAt).getTime();
    if (runAt <= now) {
      // Missed while the app was closed — fire now, sequentially.
      const result = await fireScheduledPost(
        dataSource,
        engine,
        row.id,
        notify,
      );
      logger.log(
        `[AICut] catch-up scheduled post ${row.id} (${row.platform}): ${result.detail}`,
      );
      caughtUp++;
    } else {
      scheduler.schedule(row.id, new Date(row.runAt), () => {
        void fireScheduledPost(dataSource, engine, row.id, notify);
      });
      rescheduled++;
    }
  }

  if (caughtUp || rescheduled) {
    logger.log(
      `[AICut] scheduled posts rehydrated: ${caughtUp} caught up, ${rescheduled} re-timed`,
    );
  }
  return { caughtUp, rescheduled };
}
