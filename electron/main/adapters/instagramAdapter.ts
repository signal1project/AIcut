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

const API_BASE = PLATFORM_CONFIG.instagram.apiBase;

interface IgInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}
interface IgCommentsResponse {
  data?: Array<{ id: string; text?: string; username?: string }>;
}

/**
 * Instagram publishing via the Graph API. Uses the two-step container flow:
 * create a media container, then publish it. ctx.externalId is the IG Business
 * account id; ctx.accessToken is the linked Page token.
 */
export class InstagramAdapter implements PlatformAdapter {
  readonly platform: Platform = 'instagram';

  constructor(private readonly http: AdapterHttp) {}

  private auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async publish(ctx: AdapterContext, input: PublishInput): Promise<PublishResult> {
    const caption = buildCaption(input);
    const isVideo = input.pubType === PubType.VIDEO;

    // Single-media (most common). Carousels would create multiple children first.
    const container = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/media`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: isVideo
        ? { media_type: 'REELS', video_url: input.mediaUrls[0], caption }
        : { image_url: input.mediaUrls[0], caption },
    });

    const published = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/media_publish`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { creation_id: container.id },
    });
    return { externalPostId: published.id };
  }

  async fetchMetrics(ctx: AdapterContext, externalPostId: string): Promise<PostMetrics> {
    const res = await this.http.request<IgInsightsResponse>({
      url: `${API_BASE}/${externalPostId}/insights`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { metric: 'impressions,reach,total_interactions' },
    });
    const byName = new Map<string, number>();
    for (const row of res.data ?? []) byName.set(row.name, row.values?.[0]?.value ?? 0);
    return {
      impressions: byName.get('impressions') ?? 0,
      reach: byName.get('reach') ?? 0,
      engagements: byName.get('total_interactions') ?? 0,
      clicks: 0, // IG media insights do not expose a click metric.
    };
  }

  async fetchComments(ctx: AdapterContext, externalPostId: string): Promise<PlatformComment[]> {
    const res = await this.http.request<IgCommentsResponse>({
      url: `${API_BASE}/${externalPostId}/comments`,
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
    const res = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${externalCommentId}/replies`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { message },
    });
    return { externalCommentId: res.id };
  }
}
