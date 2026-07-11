import { describe, it, expect } from 'vitest';
import {
  decodeJwtPayload,
  jwtExpiry,
  chatgptAccountId,
  tokensFromExchange,
  isExpiring,
} from '../chatgptAuth';
import { parseResponsesSse } from '../chatgptProvider';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

describe('chatgpt JWT helpers', () => {
  it('decodes a JWT payload', () => {
    const token = fakeJwt({ exp: 1234, foo: 'bar' });
    expect(decodeJwtPayload(token)).toMatchObject({ exp: 1234, foo: 'bar' });
  });

  it('returns null for garbage tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('reads expiry from exp claim', () => {
    expect(jwtExpiry(fakeJwt({ exp: 999 }))).toBe(999);
    expect(jwtExpiry(fakeJwt({}))).toBe(0);
  });

  it('extracts the chatgpt account id claim', () => {
    const token = fakeJwt({
      'https://api.openai.com/auth': { chatgpt_account_id: 'acct-123' },
    });
    expect(chatgptAccountId(token)).toBe('acct-123');
    expect(chatgptAccountId(fakeJwt({}))).toBeNull();
  });

  it('builds a token bundle from an exchange response', () => {
    const access = fakeJwt({ exp: 5000 });
    const bundle = tokensFromExchange({
      access_token: access,
      refresh_token: 'r1',
    });
    expect(bundle).toEqual({
      accessToken: access,
      refreshToken: 'r1',
      expiresAt: 5000,
    });
    expect(() => tokensFromExchange({})).toThrow(/access token/);
  });

  it('flags tokens nearing expiry (120s skew)', () => {
    const now = 10_000;
    expect(
      isExpiring(
        { accessToken: 'a', refreshToken: 'r', expiresAt: now + 60 },
        now,
      ),
    ).toBe(true);
    expect(
      isExpiring(
        { accessToken: 'a', refreshToken: 'r', expiresAt: now + 600 },
        now,
      ),
    ).toBe(false);
    // Unknown expiry (0) → never proactively refresh; the 401 path handles it.
    expect(
      isExpiring({ accessToken: 'a', refreshToken: 'r', expiresAt: 0 }, now),
    ).toBe(false);
  });
});

describe('parseResponsesSse', () => {
  const sse = (events: unknown[]) =>
    events.map((e) => `data: ${JSON.stringify(e)}`).join('\n\n');

  it('concatenates output_text deltas', () => {
    const body = sse([
      { type: 'response.created' },
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.delta', delta: 'world' },
      { type: 'response.completed' },
    ]);
    expect(parseResponsesSse(body)).toBe('Hello world');
  });

  it('prefers the authoritative done text when present', () => {
    const body = sse([
      { type: 'response.output_text.delta', delta: 'Hel' },
      { type: 'response.output_text.done', text: 'Hello world' },
    ]);
    expect(parseResponsesSse(body)).toBe('Hello world');
  });

  it('throws on response.failed', () => {
    const body = sse([
      { type: 'response.failed', error: { message: 'quota exceeded' } },
    ]);
    expect(() => parseResponsesSse(body)).toThrow(/quota exceeded/);
  });

  it('ignores malformed lines and [DONE]', () => {
    const body =
      'data: {broken\n\ndata: [DONE]\n\n' +
      sse([{ type: 'response.output_text.delta', delta: 'ok' }]);
    expect(parseResponsesSse(body)).toBe('ok');
  });
});
