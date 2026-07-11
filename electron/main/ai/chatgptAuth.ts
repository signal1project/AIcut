import { BrowserWindow, clipboard } from 'electron';
import type { Settings } from '../settings/settings';

/**
 * "Sign in with ChatGPT" (OpenAI Codex OAuth) — no API key involved.
 *
 * Uses OpenAI's Codex device-code flow (the same one the official Codex CLI,
 * Hermes, and OpenClaw use). It is NOT the standard RFC 8628 device flow —
 * OpenAI runs bespoke endpoints:
 *
 *   1. POST {issuer}/api/accounts/deviceauth/usercode  {client_id}
 *        → { user_code, device_auth_id, interval }
 *   2. User enters user_code at {issuer}/codex/device (we open a window there
 *      and put the code on the clipboard).
 *   3. Poll POST {issuer}/api/accounts/deviceauth/token {device_auth_id, user_code}
 *        → 403/404 while pending; 200 → { authorization_code, code_verifier }
 *   4. Exchange at {issuer}/oauth/token (grant_type=authorization_code,
 *      redirect_uri={issuer}/deviceauth/callback) → access + refresh tokens.
 *
 * Access tokens are JWTs; expiry comes from the `exp` claim and the ChatGPT
 * account id from the `https://api.openai.com/auth`.chatgpt_account_id claim.
 * Refresh: grant_type=refresh_token with the same public client_id.
 */

export const CHATGPT_OAUTH_ISSUER = 'https://auth.openai.com';
export const CHATGPT_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CHATGPT_OAUTH_TOKEN_URL = `${CHATGPT_OAUTH_ISSUER}/oauth/token`;
export const CHATGPT_DEVICE_USERCODE_URL = `${CHATGPT_OAUTH_ISSUER}/api/accounts/deviceauth/usercode`;
export const CHATGPT_DEVICE_TOKEN_URL = `${CHATGPT_OAUTH_ISSUER}/api/accounts/deviceauth/token`;
export const CHATGPT_DEVICE_VERIFY_URL = `${CHATGPT_OAUTH_ISSUER}/codex/device`;
export const CHATGPT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';

/** Refresh this many seconds before the JWT actually expires. */
const REFRESH_SKEW_SECONDS = 120;
const DEVICE_FLOW_TIMEOUT_MS = 15 * 60 * 1000; // OpenAI's effective limit

export interface ChatGPTTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds, from the access token's exp claim. */
  expiresAt: number;
}

/** Decode a JWT payload without verifying (we only read our own tokens). */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function jwtExpiry(token: string): number {
  const claims = decodeJwtPayload(token);
  const exp = claims?.exp;
  return typeof exp === 'number' ? exp : 0;
}

/** ChatGPT account id — required as a header on the Codex inference endpoint. */
export function chatgptAccountId(accessToken: string): string | null {
  const claims = decodeJwtPayload(accessToken);
  const auth = claims?.['https://api.openai.com/auth'];
  if (auth && typeof auth === 'object') {
    const id = (auth as Record<string, unknown>).chatgpt_account_id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export function tokensFromExchange(json: {
  access_token?: string;
  refresh_token?: string;
}): ChatGPTTokens {
  const accessToken = json.access_token ?? '';
  if (!accessToken)
    throw new Error('OpenAI token exchange did not return an access token.');
  return {
    accessToken,
    refreshToken: json.refresh_token ?? '',
    expiresAt: jwtExpiry(accessToken),
  };
}

export function isExpiring(
  tokens: ChatGPTTokens,
  nowSeconds = Date.now() / 1000,
): boolean {
  return (
    tokens.expiresAt > 0 && tokens.expiresAt - nowSeconds < REFRESH_SKEW_SECONDS
  );
}

// ── Device flow ───────────────────────────────────────────────────────────────

export interface DeviceCodeStart {
  userCode: string;
  deviceAuthId: string;
  intervalSeconds: number;
  verificationUrl: string;
}

export async function startDeviceFlow(
  fetcher: typeof fetch = fetch,
): Promise<DeviceCodeStart> {
  const resp = await fetcher(CHATGPT_DEVICE_USERCODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CHATGPT_OAUTH_CLIENT_ID }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(
      `OpenAI rejected the device-code login request (HTTP ${resp.status}). ` +
        `Your account may need device-code authorization enabled. ${detail.slice(0, 200)}`,
    );
  }
  const json = (await resp.json()) as {
    user_code?: string;
    device_auth_id?: string;
    interval?: string | number;
  };
  if (!json.user_code || !json.device_auth_id) {
    throw new Error(
      'OpenAI device-code response missing user_code or device_auth_id.',
    );
  }
  return {
    userCode: json.user_code,
    deviceAuthId: json.device_auth_id,
    intervalSeconds: Math.max(3, Number(json.interval ?? 5) || 5),
    verificationUrl: CHATGPT_DEVICE_VERIFY_URL,
  };
}

async function pollForAuthorization(
  start: DeviceCodeStart,
  isCancelled: () => boolean,
  fetcher: typeof fetch = fetch,
): Promise<{ authorizationCode: string; codeVerifier: string }> {
  const deadline = Date.now() + DEVICE_FLOW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (isCancelled()) throw new Error('ChatGPT sign-in was cancelled.');
    await new Promise((r) => setTimeout(r, start.intervalSeconds * 1000));
    if (isCancelled()) throw new Error('ChatGPT sign-in was cancelled.');
    const resp = await fetcher(CHATGPT_DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_auth_id: start.deviceAuthId,
        user_code: start.userCode,
      }),
    });
    if (resp.status === 200) {
      const json = (await resp.json()) as {
        authorization_code?: string;
        code_verifier?: string;
      };
      if (!json.authorization_code || !json.code_verifier) {
        throw new Error(
          'OpenAI device-auth response missing authorization_code/code_verifier.',
        );
      }
      return {
        authorizationCode: json.authorization_code,
        codeVerifier: json.code_verifier,
      };
    }
    if (resp.status === 403 || resp.status === 404) continue; // not approved yet
    throw new Error(`OpenAI device-auth poll failed (HTTP ${resp.status}).`);
  }
  throw new Error(
    'The sign-in code expired before it was approved. Please try again.',
  );
}

export async function exchangeAuthorizationCode(
  authorizationCode: string,
  codeVerifier: string,
  fetcher: typeof fetch = fetch,
): Promise<ChatGPTTokens> {
  const resp = await fetcher(CHATGPT_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: `${CHATGPT_OAUTH_ISSUER}/deviceauth/callback`,
      client_id: CHATGPT_OAUTH_CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!resp.ok)
    throw new Error(`OpenAI token exchange failed (HTTP ${resp.status}).`);
  return tokensFromExchange(
    (await resp.json()) as { access_token?: string; refresh_token?: string },
  );
}

export async function refreshChatGPTTokens(
  refreshToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ChatGPTTokens> {
  const resp = await fetcher(CHATGPT_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CHATGPT_OAUTH_CLIENT_ID,
    }).toString(),
  });
  if (!resp.ok) {
    throw new Error(
      `ChatGPT session refresh failed (HTTP ${resp.status}) — sign in again from Settings.`,
    );
  }
  const json = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  const tokens = tokensFromExchange(json);
  // Some refreshes omit a new refresh token — keep the old one.
  if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
  return tokens;
}

// ── High-level flows used by IPC / runtime ────────────────────────────────────

/**
 * Run the complete sign-in: fetch a user code, report it to the caller (shown
 * in the UI + copied to the clipboard), open the verification page in a child
 * window, poll until approved, exchange, persist tokens via Settings.
 */
export async function runChatGPTSignIn(
  parent: BrowserWindow,
  settings: Settings,
  onUserCode: (info: { userCode: string; verificationUrl: string }) => void,
): Promise<void> {
  const start = await startDeviceFlow();
  onUserCode({
    userCode: start.userCode,
    verificationUrl: start.verificationUrl,
  });
  clipboard.writeText(start.userCode);

  const authWin = new BrowserWindow({
    parent,
    modal: false,
    width: 560,
    height: 720,
    title: 'Sign in with ChatGPT',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  authWin.setMenu(null);
  void authWin.loadURL(start.verificationUrl);

  let windowClosed = false;
  authWin.on('closed', () => {
    windowClosed = true;
  });

  try {
    // Window closure does NOT cancel — users often close it after approving.
    // Poll until approved or timeout; treat closure before approval as benign.
    const { authorizationCode, codeVerifier } = await pollForAuthorization(
      start,
      () => false,
    );
    const tokens = await exchangeAuthorizationCode(
      authorizationCode,
      codeVerifier,
    );
    settings.setChatGPTTokens(tokens);
  } finally {
    if (!windowClosed && !authWin.isDestroyed()) authWin.destroy();
  }
}

/**
 * Return a fresh access token + account id for inference, refreshing (and
 * persisting the rotation) when the current token is near expiry.
 */
export async function ensureFreshChatGPTAuth(
  settings: Settings,
): Promise<{ accessToken: string; accountId: string | null }> {
  const tokens = settings.getChatGPTTokens();
  if (!tokens) {
    throw new Error(
      'ChatGPT is not connected. Sign in from Settings or the setup guide.',
    );
  }
  if (!isExpiring(tokens)) {
    return {
      accessToken: tokens.accessToken,
      accountId: chatgptAccountId(tokens.accessToken),
    };
  }
  if (!tokens.refreshToken) {
    throw new Error(
      'ChatGPT session expired and no refresh token is stored — sign in again.',
    );
  }
  const rotated = await refreshChatGPTTokens(tokens.refreshToken);
  settings.setChatGPTTokens(rotated);
  return {
    accessToken: rotated.accessToken,
    accountId: chatgptAccountId(rotated.accessToken),
  };
}
