import PQueue from 'p-queue';
import { PLATFORM_CONFIG, PLATFORMS, type Platform } from '@mas/types';

/**
 * One rate-limited queue per platform, configured from PLATFORM_CONFIG.rateLimit.
 * All outbound platform API work routes through here so we never exceed a
 * platform's published call budget regardless of how many posts are queued.
 */
export class RateLimitedQueues {
  private readonly queues = new Map<Platform, PQueue>();

  constructor(concurrency = 2) {
    for (const platform of PLATFORMS) {
      const { calls, windowMs } = PLATFORM_CONFIG[platform].rateLimit;
      this.queues.set(
        platform,
        new PQueue({
          concurrency,
          intervalCap: calls,
          interval: windowMs,
          carryoverConcurrencyCount: true,
        }),
      );
    }
  }

  private queue(platform: Platform): PQueue {
    const q = this.queues.get(platform);
    if (!q) throw new Error(`No rate-limit queue for platform "${platform}".`);
    return q;
  }

  run<T>(platform: Platform, task: () => Promise<T>): Promise<T> {
    return this.queue(platform).add(task) as Promise<T>;
  }

  /** Queued-but-not-started count for a platform. */
  waiting(platform: Platform): number {
    return this.queue(platform).size;
  }

  /** Currently-executing count for a platform. */
  active(platform: Platform): number {
    return this.queue(platform).pending;
  }

  async onIdle(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.onIdle()));
  }
}
