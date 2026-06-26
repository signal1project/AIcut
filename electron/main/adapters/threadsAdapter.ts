import { PLATFORM_CONFIG, PubType, type Platform } from '@mas/types';
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

const API_BASE = PLATFORM_CONFIG.threads.apiBase;

interface ThreadsInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}
interface ThreadsRepliesResponse {
  data?: Array<{ id: string; text?: string; username?: string }>;
}

/**
 * Threads publishing via the Meta Threads API. Two-step container flow like
 * Instagram: create a thread container, then publish it. ctx.externalId is the
 * Threads user id.
 */
export class ThreadsAdapter implements PlatformAdapter {
  readonly platform: Platform = 'threads';

  constructor(private readonly http: AdapterHttp) {}

  private auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async publish(ctx: AdapterContext, input: PublishInput): Promise<PublishResult> {
    const text = buildCaption(input);
    const hasMedia = input.mediaUrls.length > 0;
    const mediaType = !hasMedia
      ? 'TEXT'
      : input.pubType === PubType.VIDEO
        ? 'VIDEO'
        : 'IMAGE';

    const data: Record<string, unknown> = { media_type: mediaType, text };
    if (mediaType === 'IMAGE') data.image_url = input.mediaUrls[0];
    if (mediaType === 'VIDEO') data.video_url = input.mediaUrls[0];

    const container = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/threads`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data,
    });

    const published = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/threads_publish`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { creation_id: container.id },
    });
    return { externalPostId: published.id };
  }

  async fetchMetrics(ctx: AdapterContext, externalPostId: string): Promise<PostMetrics> {
    const res = await this.http.request<ThreadsInsightsResponse>({
      url: `${API_BASE}/${externalPostId}/insights`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { metric: 'views,likes,replies,reposts,quotes' },
    });
    const byName = new Map<string, number>();
    for (const row of res.data ?? []) byName.set(row.name, row.values?.[0]?.value ?? 0);
    const engagements =
      (byName.get('likes') ?? 0) +
      (byName.get('replies') ?? 0) +
      (byName.get('reposts') ?? 0) +
      (byName.get('quotes') ?? 0);
    return {
      impressions: byName.get('views') ?? 0,
      reach: byName.get('views') ?? 0,
      engagements,
      clicks: 0,
    };
  }

  async fetchComments(ctx: AdapterContext, externalPostId: string): Promise<PlatformComment[]> {
    const res = await this.http.request<ThreadsRepliesResponse>({
      url: `${API_BASE}/${externalPostId}/replies`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { fields: 'id,text,username' },
    });
    return (res.data ?? []).map((c) => ({
      externalCommentId: c.id,
      externalPostId,
      authorHandle: c.username ?? '',
      text: c.text ?? '',
    }));
  }

  async replyToComment(
    ctx: AdapterContext,
    externalCommentId: string,
    message: string,
  ): Promise<{ externalCommentId: string }> {
    // A reply is a thread container with reply_to_id, then published.
    const container = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/threads`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { media_type: 'TEXT', text: message, reply_to_id: externalCommentId },
    });
    const published = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/threads_publish`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { creation_id: container.id },
    });
    return { externalCommentId: published.id };
  }
}
