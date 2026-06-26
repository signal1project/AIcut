import { z } from 'zod';

// OAuth token material. Persisted only inside electron.safeStorage, keyed by
// ConnectedAccount.credentialRef — never written to the database in plaintext.
export const tokenBundleSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenType: z.string().default('Bearer'),
  scope: z.string().optional(),
  /** Absolute expiry of the access token; null when the platform issues non-expiring tokens. */
  expiresAt: z.coerce.date().nullable().default(null),
  obtainedAt: z.coerce.date(),
  /** Platform-specific extras (e.g. Facebook page tokens, open_id). */
  meta: z.record(z.unknown()).default({}),
});
export type TokenBundle = z.infer<typeof tokenBundleSchema>;
