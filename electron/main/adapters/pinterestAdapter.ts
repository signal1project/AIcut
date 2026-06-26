import { PLATFORM_CONFIG, type Platform } from '@mas/types';
import type { AdapterHttp } from './http';
import { buildCaption } from './util';
import type {
  AdapterContext,
  PlatformAdapter,
  PlatformComment,
  PostMetrics,
  PublishInput,
  PublishResult,
} from './types';

const API_BASE = PLATFORM_CONFIG.pinterest.apiBase;

interface PinResponse {
  id: string;
}
interface PinAnalyticsResponse {
  all?: {
    daily_metrics?: Array<{ metrics?: Record<string, number> }>;
  };
}

/**
 * Pinterest publishing via API v5. A pin requires a destination board, supplied
 * as ctx.meta.boardId. Pinterest has no public comment-management surface, so
 * fetchComments/replyToComment are no-ops.
 */
export class PinterestAdapter implements PlatformAdapter {
  readonly platform: Platform = 'pinterest';

  constructor(private readonly http: AdapterHttp) {}

  private auth(token: string) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async publish(ctx: AdapterContext, input: PublishInput): Promise<PublishResult> {
    const boardId = (ctx.meta?.boardId as string | undefined) ?? '';
    if (!boardId) throw new Error('Pinterest publish requires ctx.meta.boardId.');
    if (input.mediaUrls.length === 0) {
      throw new Error('Pinterest pins require at least one image.');
    }

    const res = await this.http.request<PinResponse>({
      url: `${API_BASE}/pins`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: {
        board_id: boardId,
        title: input.body.slice(0, 100),
        description: buildCaption(input),
        media_source: { source_type: 'image_url', url: input.mediaUrls[0] },
      },
    });
    return { externalPostId: res.id };
  }

  async fetchMetrics(ctx: AdapterContext, externalPostId: string): Promise<PostMetrics> {
    // Pinterest analytics require a date range; default to the trailing 30 days.
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const res = await this.http.request<PinAnalyticsResponse>({
      url: `${API_BASE}/pins/${externalPostId}/analytics`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: {
        start_date: fmt(start),
        end_date: fmt(end),
        metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
      },
    });

    const totals = { IMPRESSION: 0, SAVE: 0, PIN_CLICK: 0, OUTBOUND_CLICK: 0 } as Record<string, number>;
    for (const day of res.all?.daily_metrics ?? []) {
      for (const [k, v] of Object.entries(day.metrics ?? {})) {
        if (k in totals) totals[k] += v ?? 0;
      }
    }
    return {
      impressions: totals.IMPRESSION,
      reach: totals.IMPRESSION,
      engagements: totals.SAVE + totals.PIN_CLICK,
      clicks: totals.OUTBOUND_CLICK,
    };
  }

  async fetchComments(): Promise<PlatformComment[]> {
    return [];
  }

  async replyToComment(): Promise<{ externalCommentId: string }> {
    throw new Error('Pinterest does not support programmatic comment replies.');
  }
}
