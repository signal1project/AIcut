import { z } from 'zod';
import { PLATFORMS } from './platforms';
import { PubType, PubStatus, AccountStatus, EngagementStatus, AuditAction } from './enums';

export const platformSchema = z.enum(PLATFORMS);

// ─── Connected Account ───────────────────────────────────────────
// Token material is NOT stored here — only a reference key into electron.safeStorage.
export const connectedAccountSchema = z.object({
  id: z.string().uuid(),
  platform: platformSchema,
  accountName: z.string().default(''),
  externalId: z.string().default(''),
  status: z.nativeEnum(AccountStatus).default(AccountStatus.DISCONNECTED),
  /** Key into electron.safeStorage where the encrypted token bundle lives. */
  credentialRef: z.string().default(''),
  tokenExpiresAt: z.coerce.date().nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ConnectedAccount = z.infer<typeof connectedAccountSchema>;

// ─── Content Asset ───────────────────────────────────────────────
export const contentAssetSchema = z.object({
  id: z.string().uuid(),
  platform: platformSchema,
  pubType: z.nativeEnum(PubType).default(PubType.IMAGE_TEXT),
  body: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
  mediaRefs: z.array(z.string()).default([]),
  status: z.nativeEnum(PubStatus).default(PubStatus.DRAFT),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ContentAsset = z.infer<typeof contentAssetSchema>;

// ─── Publish request (API input) ─────────────────────────────────
export const publishRequestSchema = z.object({
  accountIds: z.array(z.string().uuid()).min(1),
  pubType: z.nativeEnum(PubType),
  body: z.string().max(63206),
  hashtags: z.array(z.string()).default([]),
  mediaRefs: z.array(z.string()).default([]),
});
export type PublishRequest = z.infer<typeof publishRequestSchema>;

// ─── Publish History ─────────────────────────────────────────────
export const publishHistorySchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  platform: platformSchema,
  contentAssetId: z.string().uuid().nullable().default(null),
  status: z.nativeEnum(PubStatus),
  externalPostId: z.string().default(''),
  error: z.string().default(''),
  attempts: z.number().int().default(0),
  publishedAt: z.coerce.date().nullable().default(null),
  createdAt: z.coerce.date(),
});
export type PublishHistory = z.infer<typeof publishHistorySchema>;

// ─── Scheduled Post ──────────────────────────────────────────────
export const scheduledPostSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  platform: platformSchema,
  contentAssetId: z.string().uuid(),
  runAt: z.coerce.date(),
  status: z.nativeEnum(PubStatus).default(PubStatus.QUEUED),
  createdAt: z.coerce.date(),
});
export type ScheduledPost = z.infer<typeof scheduledPostSchema>;

// ─── Engagement queue item (human-in-the-loop) ──────────────────
export const engagementQueueItemSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  platform: platformSchema,
  externalCommentId: z.string(),
  externalPostId: z.string().default(''),
  authorHandle: z.string().default(''),
  commentText: z.string().default(''),
  /** LLM-drafted reply awaiting human approval. */
  draftReply: z.string().default(''),
  /** True when the comment matches a high-conversion keyword pattern. */
  highConversion: z.boolean().default(false),
  status: z.nativeEnum(EngagementStatus).default(EngagementStatus.PENDING),
  createdAt: z.coerce.date(),
});
export type EngagementQueueItem = z.infer<typeof engagementQueueItemSchema>;

// ─── Analytics snapshot ──────────────────────────────────────────
export const analyticsSnapshotSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  platform: platformSchema,
  externalPostId: z.string(),
  reach: z.number().int().default(0),
  impressions: z.number().int().default(0),
  engagements: z.number().int().default(0),
  clicks: z.number().int().default(0),
  capturedAt: z.coerce.date(),
});
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;

// ─── Audit log ───────────────────────────────────────────────────
export const auditLogSchema = z.object({
  id: z.string().uuid(),
  action: z.nativeEnum(AuditAction),
  entity: z.string(),
  entityId: z.string(),
  details: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
