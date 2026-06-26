import { describe, it, expect } from 'vitest';
import { MasApiClient, MasApiError } from '../apiClient';
import { PubType } from '@mas/types';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

function fakeFetch(responder: (rec: Recorded) => { status: number; json: unknown }) {
  const calls: Recorded[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    const rec: Recorded = {
      url: String(url),
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(rec);
    const { status, json } = responder(rec);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(json),
    } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const opts = (fetchImpl: typeof fetch) => ({ baseUrl: 'http://127.0.0.1:9000/', token: 'TKN', fetchImpl });

describe('MasApiClient', () => {
  it('sends bearer auth and JSON, strips trailing slash from baseUrl', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, json: { status: 'PUBLISHED', results: [] } }));
    const client = new MasApiClient(opts(fn));
    await client.publish({ accountIds: ['a1'], pubType: PubType.IMAGE_TEXT, body: 'hi' });
    expect(calls[0].url).toBe('http://127.0.0.1:9000/api/publish');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.Authorization).toBe('Bearer TKN');
    expect(calls[0].body).toMatchObject({ accountIds: ['a1'], body: 'hi' });
  });

  it('parses successful responses', async () => {
    const { fn } = fakeFetch(() => ({ status: 200, json: { provider: 'claude', items: [{ platform: 'facebook', body: 'x', hashtags: [] }] } }));
    const client = new MasApiClient(opts(fn));
    const res = await client.generateContent({ brief: 'b', platforms: ['facebook'] });
    expect(res.provider).toBe('claude');
    expect(res.items[0].platform).toBe('facebook');
  });

  it('throws MasApiError with status + parsed body on failure', async () => {
    const { fn } = fakeFetch(() => ({ status: 400, json: { error: 'validation_failed' } }));
    const client = new MasApiClient(opts(fn));
    await expect(client.publish({ accountIds: [], pubType: PubType.IMAGE_TEXT })).rejects.toMatchObject({
      name: 'MasApiError',
      status: 400,
      message: 'validation_failed',
    });
  });

  it('encodes ids in engagement paths', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, json: { ok: true } }));
    const client = new MasApiClient(opts(fn));
    await client.dismissEngagement('a/b c');
    expect(calls[0].url).toBe('http://127.0.0.1:9000/api/engagement/a%2Fb%20c/dismiss');
  });

  it('builds analytics query strings', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, json: { snapshots: [] } }));
    const client = new MasApiClient(opts(fn));
    await client.getAnalyticsByAccount('acc 1');
    expect(calls[0].url).toBe('http://127.0.0.1:9000/api/analytics?accountId=acc%201');
    expect(calls[0].method).toBe('GET');
  });

  it('exposes MasApiError as an Error subclass', () => {
    const e = new MasApiError('boom', 500, { error: 'boom' });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(500);
  });
});
