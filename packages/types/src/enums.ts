// Core enums. Concepts adapted from the upstream commont/ enums, generalized for US platforms.

/** What kind of content a post is. */
export enum PubType {
  VIDEO = 'video',
  ARTICLE = 'article',
  IMAGE_TEXT = 'image-text',
}

/** Lifecycle of a publish attempt. */
export enum PubStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  PART_SUCCESS = 'part-success',
}

/** OAuth/connection state of a linked platform account. */
export enum AccountStatus {
  CONNECTED = 'connected',
  EXPIRED = 'expired',
  DISCONNECTED = 'disconnected',
  PENDING = 'pending',
}

/** Assisted-engagement queue item state (human-in-the-loop). */
export enum EngagementStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DISMISSED = 'dismissed',
  FAILED = 'failed',
}

/** AuditLog action categories. */
export enum AuditAction {
  PUBLISH = 'publish',
  SCHEDULE = 'schedule',
  ENGAGE = 'engage',
  ACCOUNT_CONNECTED = 'account_connected',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  TOKEN_REFRESH = 'token_refresh',
  COMPLIANCE_CHECK = 'compliance_check',
}
