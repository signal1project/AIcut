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

const API_BASE = PLATFORM_CONFIG.facebook.apiBase;

// Maps Graph "page insights" metric names onto our normalized PostMetrics.
const METRIC_FIELDS = [
  'post_impressions',
  'post_impressions_unique',
  'post_engaged_users',
  'post_clicks',
] as const;

interface GraphInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}
interface GraphCommentsResponse {
  data?: Array<{ id: string; message?: string; from?: { name?: string; id?: string } }>;
}

/**
 * Facebook Page publishing + engagement via the Graph API. ctx.accessToken must
 * be a Page access token; ctx.externalId is the Page id. Endpoint shapes are
 * ported from the upstream FacebookService (US Graph API, no chunked video here).
 */
export class FacebookAdapter implements PlatformAdapter {
  readonly platform: Platform = 'facebook';

  constructor(private readonly http: AdapterHttp) {}

  private auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async publish(ctx: AdapterContext, input: PublishInput): Promise<PublishResult> {
    const message = buildCaption(input);

    if (input.pubType === PubType.VIDEO) {
      const res = await this.http.request<{ id: string }>({
        url: `${API_BASE}/${ctx.externalId}/videos`,
        method: 'POST',
        headers: this.auth(ctx.accessToken),
        data: { file_url: input.mediaUrls[0], description: message, published: true },
      });
      return { externalPostId: res.id };
    }

    // Image/text: upload each photo unpublished, then attach to a single feed post.
    if (input.mediaUrls.length > 0) {
      const mediaIds: string[] = [];
      for (const url of input.mediaUrls) {
        const photo = await this.http.request<{ id: string }>({
          url: `${API_BASE}/${ctx.externalId}/photos`,
          method: 'POST',
          headers: this.auth(ctx.accessToken),
          data: { url, published: false },
        });
        mediaIds.push(photo.id);
      }
      const res = await this.http.request<{ id: string; post_id?: string }>({
        url: `${API_BASE}/${ctx.externalId}/feed`,
        method: 'POST',
        headers: this.auth(ctx.accessToken),
        data: {
          message,
          attached_media: mediaIds.map((id) => ({ media_fbid: id })),
          published: true,
        },
      });
      return { externalPostId: res.post_id ?? res.id };
    }

    // Text-only feed post.
    const res = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${ctx.externalId}/feed`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { message, published: true },
    });
    return { externalPostId: res.id };
  }

  async fetchMetrics(ctx: AdapterContext, externalPostId: string): Promise<PostMetrics> {
    const res = await this.http.request<GraphInsightsResponse>({
      url: `${API_BASE}/${externalPostId}/insights`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { metric: METRIC_FIELDS.join(',') },
    });

    const byName = new Map<string, number>();
    for (const row of res.data ?? []) {
      byName.set(row.name, row.values?.[0]?.value ?? 0);
    }
    return {
      impressions: byName.get('post_impressions') ?? 0,
      reach: byName.get('post_impressions_unique') ?? 0,
      engagements: byName.get('post_engaged_users') ?? 0,
      clicks: byName.get('post_clicks') ?? 0,
    };
  }

  async fetchComments(ctx: AdapterContext, externalPostId: string): Promise<PlatformComment[]> {
    const res = await this.http.request<GraphCommentsResponse>({
      url: `${API_BASE}/${externalPostId}/comments`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { fields: 'id,message,from', order: 'reverse_chronological' },
    });
    return (res.data ?? []).map((c) => ({
      externalCommentId: c.id,
      externalPostId,
      authorHandle: c.from?.name ?? '',
      text: c.message ?? '',
    }));
  }

  async replyToComment(
    ctx: AdapterContext,
    externalCommentId: string,
    message: string,
  ): Promise<{ externalCommentId: string }> {
    const res = await this.http.request<{ id: string }>({
      url: `${API_BASE}/${externalCommentId}/comments`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: { message },
    });
    return { externalCommentId: res.id };
  }
}
