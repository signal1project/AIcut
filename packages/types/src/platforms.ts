// US social platforms supported across the Master AI Social family.
// Replaces the upstream Chinese-only PlatType enum.

export const PLATFORMS = [
  'facebook',
  'instagram',
  'twitter',
  'threads',
  'pinterest',
  'youtube',
  'tiktok',
  'linkedin',
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** API access tier — see SPEC.md. Tier 2 requires platform developer approval. */
export type PlatformTier = 1 | 2;

export interface PlatformConfig {
  readonly label: string;
  readonly tier: PlatformTier;
  /** Max characters for a post caption/body. */
  readonly maxChars: number;
  /** Max media items per post. */
  readonly maxMedia: number;
  /** Whether the platform supports native video publishing. */
  readonly supportsVideo: boolean;
  /** OAuth authorization + token endpoints. */
  readonly oauth: {
    readonly authorizeUrl: string;
    readonly tokenUrl: string;
    readonly scopes: readonly string[];
    /** Whether PKCE is used for the auth code flow. */
    readonly usesPkce: boolean;
  };
  /** Base URL for the platform's content/graph API. */
  readonly apiBase: string;
  /** Conservative rate-limit budget the queue enforces (calls per window). */
  readonly rateLimit: { readonly calls: number; readonly windowMs: number };
}

export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  facebook: {
    label: 'Facebook',
    tier: 1,
    maxChars: 63206,
    maxMedia: 10,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
      scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
      usesPkce: false,
    },
    apiBase: 'https://graph.facebook.com/v21.0',
    rateLimit: { calls: 200, windowMs: 60 * 60 * 1000 },
  },
  instagram: {
    label: 'Instagram',
    tier: 1,
    maxChars: 2200,
    maxMedia: 10,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
      scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
      usesPkce: false,
    },
    apiBase: 'https://graph.facebook.com/v21.0',
    rateLimit: { calls: 200, windowMs: 60 * 60 * 1000 },
  },
  twitter: {
    label: 'Twitter/X',
    tier: 1,
    maxChars: 280,
    maxMedia: 4,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      usesPkce: true,
    },
    apiBase: 'https://api.twitter.com/2',
    rateLimit: { calls: 300, windowMs: 3 * 60 * 60 * 1000 },
  },
  threads: {
    label: 'Threads',
    tier: 1,
    maxChars: 500,
    maxMedia: 10,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://threads.net/oauth/authorize',
      tokenUrl: 'https://graph.threads.net/oauth/access_token',
      scopes: ['threads_basic', 'threads_content_publish'],
      usesPkce: false,
    },
    apiBase: 'https://graph.threads.net/v1.0',
    rateLimit: { calls: 250, windowMs: 24 * 60 * 60 * 1000 },
  },
  pinterest: {
    label: 'Pinterest',
    tier: 1,
    maxChars: 500,
    maxMedia: 1,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://www.pinterest.com/oauth/',
      tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
      scopes: ['boards:read', 'pins:read', 'pins:write'],
      usesPkce: false,
    },
    apiBase: 'https://api.pinterest.com/v5',
    rateLimit: { calls: 1000, windowMs: 24 * 60 * 60 * 1000 },
  },
  youtube: {
    label: 'YouTube',
    tier: 2,
    maxChars: 5000,
    maxMedia: 1,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'],
      usesPkce: true,
    },
    apiBase: 'https://www.googleapis.com/youtube/v3',
    rateLimit: { calls: 10000, windowMs: 24 * 60 * 60 * 1000 },
  },
  tiktok: {
    label: 'TikTok',
    tier: 2,
    maxChars: 2200,
    maxMedia: 1,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
      scopes: ['user.info.basic', 'video.publish', 'video.upload'],
      usesPkce: true,
    },
    apiBase: 'https://open.tiktokapis.com/v2',
    rateLimit: { calls: 600, windowMs: 24 * 60 * 60 * 1000 },
  },
  linkedin: {
    label: 'LinkedIn',
    tier: 2,
    maxChars: 3000,
    maxMedia: 9,
    supportsVideo: true,
    oauth: {
      authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopes: ['w_member_social', 'r_basicprofile'],
      usesPkce: false,
    },
    apiBase: 'https://api.linkedin.com/v2',
    rateLimit: { calls: 500, windowMs: 24 * 60 * 60 * 1000 },
  },
};

/** Platforms available without developer approval (Tier 1). */
export const TIER_1_PLATFORMS = PLATFORMS.filter((p) => PLATFORM_CONFIG[p].tier === 1);
/** Platforms requiring developer approval before live publishing (Tier 2). */
export const TIER_2_PLATFORMS = PLATFORMS.filter((p) => PLATFORM_CONFIG[p].tier === 2);
