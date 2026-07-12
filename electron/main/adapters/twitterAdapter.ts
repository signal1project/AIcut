import { PLATFORM_CONFIG, type Platform } from '@mas/types';
import type { AdapterHttp } from './http';
import { PubType } from '@mas/types';
import { buildCaption, isLocalMediaPath } from './util';
import { uploadTwitterVideo, type Fetcher } from './videoUpload';
import type {
  AdapterContext,
  PlatformAdapter,
  PlatformComment,
  PostMetrics,
  PublishInput,
  PublishResult,
} from './types';

const API_BASE = PLATFORM_CONFIG.twitter.apiBase;
const MAX_CHARS = PLATFORM_CONFIG.twitter.maxChars;

interface TweetResponse {
  data: { id: string; text: string };
}
interface TweetMetricsResponse {
  data?: {
    public_metrics?: {
      impression_count?: number;
      like_count?: number;
      reply_count?: number;
      retweet_count?: number;
      quote_count?: number;
      bookmark_count?: number;
    };
  };
}
interface TweetSearchResponse {
  data?: Array<{ id: string; text: string; author_id?: string }>;
  includes?: { users?: Array<{ id: string; username: string }> };
}

/**
 * Twitter/X publishing via API v2. ctx.accessToken is the user's OAuth2 bearer.
 * Media upload (separate chunked endpoint) is out of scope here — text tweets
 * and replies are supported; mediaUrls are ignored with a length-guarded body.
 */
export class TwitterAdapter implements PlatformAdapter {
  readonly platform: Platform = 'twitter';

  constructor(
    private readonly http: AdapterHttp,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  private auth(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private clamp(text: string): string {
    return text.length <= MAX_CHARS ? text : text.slice(0, MAX_CHARS - 1) + '…';
  }

  async publish(
    ctx: AdapterContext,
    input: PublishInput,
  ): Promise<PublishResult> {
    const data: Record<string, unknown> = {
      text: this.clamp(buildCaption(input)),
    };

    // Local video files go through the chunked v2 media upload first.
    if (
      input.pubType === PubType.VIDEO &&
      input.mediaUrls[0] &&
      isLocalMediaPath(input.mediaUrls[0])
    ) {
      const mediaId = await uploadTwitterVideo(
        ctx.accessToken,
        input.mediaUrls[0],
        this.fetcher,
      );
      data.media = { media_ids: [mediaId] };
    }

    const res = await this.http.request<TweetResponse>({
      url: `${API_BASE}/tweets`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data,
    });
    return { externalPostId: res.data.id };
  }

  async fetchMetrics(
    ctx: AdapterContext,
    externalPostId: string,
  ): Promise<PostMetrics> {
    const res = await this.http.request<TweetMetricsResponse>({
      url: `${API_BASE}/tweets/${externalPostId}`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: { 'tweet.fields': 'public_metrics' },
    });
    const m = res.data?.public_metrics ?? {};
    const engagements =
      (m.like_count ?? 0) +
      (m.reply_count ?? 0) +
      (m.retweet_count ?? 0) +
      (m.quote_count ?? 0);
    return {
      impressions: m.impression_count ?? 0,
      reach: m.impression_count ?? 0, // v2 exposes no distinct reach; mirror impressions.
      engagements,
      clicks: 0,
    };
  }

  async fetchComments(
    ctx: AdapterContext,
    externalPostId: string,
  ): Promise<PlatformComment[]> {
    // Replies are tweets sharing the original's conversation_id.
    const res = await this.http.request<TweetSearchResponse>({
      url: `${API_BASE}/tweets/search/recent`,
      method: 'GET',
      headers: this.auth(ctx.accessToken),
      params: {
        query: `conversation_id:${externalPostId} is:reply`,
        expansions: 'author_id',
        'user.fields': 'username',
        max_results: 100,
      },
    });
    const handleById = new Map<string, string>();
    for (const u of res.includes?.users ?? []) handleById.set(u.id, u.username);
    return (res.data ?? []).map((t) => ({
      externalCommentId: t.id,
      externalPostId,
      authorHandle: t.author_id ? (handleById.get(t.author_id) ?? '') : '',
      text: t.text,
    }));
  }

  async replyToComment(
    ctx: AdapterContext,
    externalCommentId: string,
    message: string,
  ): Promise<{ externalCommentId: string }> {
    const res = await this.http.request<TweetResponse>({
      url: `${API_BASE}/tweets`,
      method: 'POST',
      headers: this.auth(ctx.accessToken),
      data: {
        text: this.clamp(message),
        reply: { in_reply_to_tweet_id: externalCommentId },
      },
    });
    return { externalCommentId: res.data.id };
  }
}
