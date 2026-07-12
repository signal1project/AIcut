import fs from 'node:fs';
import path from 'node:path';

/**
 * Platform video-upload flows for the tier-1 API adapters. Each helper takes
 * a LOCAL file path (the Share flow exports to userData/shares) plus the
 * account's OAuth token and returns the platform's media/post identifier.
 *
 * All HTTP goes through an injectable `fetcher` so tests can assert the
 * INIT → upload → FINALIZE sequences without network access.
 */

export type Fetcher = typeof fetch;

function readFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

async function expectOk(res: Response, step: string): Promise<Response> {
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`${step} failed (HTTP ${res.status}): ${detail}`);
  }
  return res;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── X / Twitter — v2 chunked media upload ────────────────────────────────────

const X_UPLOAD_URL = 'https://api.x.com/2/media/upload';
const X_CHUNK = 4 * 1024 * 1024;

export async function uploadTwitterVideo(
  accessToken: string,
  filePath: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const buf = readFile(filePath);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const initRes = await expectOk(
    await fetcher(
      `${X_UPLOAD_URL}?command=INIT&media_type=video/mp4&media_category=tweet_video&total_bytes=${buf.length}`,
      { method: 'POST', headers: auth },
    ),
    'X media INIT',
  );
  const init = (await initRes.json()) as {
    data?: { id?: string };
    media_id_string?: string;
  };
  const mediaId = init.data?.id ?? init.media_id_string;
  if (!mediaId) throw new Error('X media INIT returned no media id');

  for (let seg = 0; seg * X_CHUNK < buf.length; seg++) {
    const chunk = buf.subarray(
      seg * X_CHUNK,
      Math.min((seg + 1) * X_CHUNK, buf.length),
    );
    const form = new FormData();
    form.append('media', new Blob([chunk]), 'chunk.mp4');
    await expectOk(
      await fetcher(
        `${X_UPLOAD_URL}?command=APPEND&media_id=${mediaId}&segment_index=${seg}`,
        { method: 'POST', headers: auth, body: form },
      ),
      `X media APPEND ${seg}`,
    );
  }

  const finRes = await expectOk(
    await fetcher(`${X_UPLOAD_URL}?command=FINALIZE&media_id=${mediaId}`, {
      method: 'POST',
      headers: auth,
    }),
    'X media FINALIZE',
  );
  let processing = (
    (await finRes.json()) as {
      data?: {
        processing_info?: { state?: string; check_after_secs?: number };
      };
    }
  ).data?.processing_info;

  // Poll STATUS until processing completes (videos transcode server-side).
  for (
    let i = 0;
    i < 30 && processing && processing.state !== 'succeeded';
    i++
  ) {
    if (processing.state === 'failed')
      throw new Error('X video processing failed');
    await sleep((processing.check_after_secs ?? 2) * 1000);
    const statusRes = await expectOk(
      await fetcher(`${X_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`, {
        method: 'GET',
        headers: auth,
      }),
      'X media STATUS',
    );
    processing = (
      (await statusRes.json()) as {
        data?: {
          processing_info?: { state?: string; check_after_secs?: number };
        };
      }
    ).data?.processing_info;
  }
  return mediaId;
}

// ── Facebook — page video upload (multipart source) ─────────────────────────

export async function uploadFacebookVideo(
  pageToken: string,
  pageId: string,
  filePath: string,
  description: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const buf = readFile(filePath);
  const form = new FormData();
  form.append('access_token', pageToken);
  form.append('description', description);
  form.append(
    'source',
    new Blob([buf], { type: 'video/mp4' }),
    path.basename(filePath),
  );
  const res = await expectOk(
    await fetcher(`https://graph-video.facebook.com/v21.0/${pageId}/videos`, {
      method: 'POST',
      body: form,
    }),
    'Facebook video upload',
  );
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error('Facebook returned no video id');
  return json.id;
}

// ── Instagram — Reels resumable upload + publish ─────────────────────────────

export async function uploadInstagramReel(
  accessToken: string,
  igUserId: string,
  filePath: string,
  caption: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const buf = readFile(filePath);

  // 1. Create a resumable REELS container.
  const containerRes = await expectOk(
    await fetcher(
      `https://graph.facebook.com/v21.0/${igUserId}/media?media_type=REELS&upload_type=resumable&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(accessToken)}`,
      { method: 'POST' },
    ),
    'Instagram container create',
  );
  const container = (await containerRes.json()) as {
    id?: string;
    uri?: string;
  };
  if (!container.id) throw new Error('Instagram returned no container id');
  const uploadUri =
    container.uri ??
    `https://rupload.facebook.com/ig-api-upload/v21.0/${container.id}`;

  // 2. Upload the bytes.
  await expectOk(
    await fetcher(uploadUri, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: '0',
        file_size: String(buf.length),
      },
      body: buf,
    }),
    'Instagram video upload',
  );

  // 3. Wait for processing, then publish.
  for (let i = 0; i < 40; i++) {
    const statusRes = await expectOk(
      await fetcher(
        `https://graph.facebook.com/v21.0/${container.id}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
        { method: 'GET' },
      ),
      'Instagram container status',
    );
    const status = (await statusRes.json()) as { status_code?: string };
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR')
      throw new Error('Instagram video processing failed');
    await sleep(3000);
  }

  const publishRes = await expectOk(
    await fetcher(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish?creation_id=${container.id}&access_token=${encodeURIComponent(accessToken)}`,
      { method: 'POST' },
    ),
    'Instagram media publish',
  );
  const published = (await publishRes.json()) as { id?: string };
  if (!published.id) throw new Error('Instagram publish returned no media id');
  return published.id;
}

// ── Pinterest — media upload + video pin ────────────────────────────────────

export async function uploadPinterestVideo(
  accessToken: string,
  filePath: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const buf = readFile(filePath);

  const registerRes = await expectOk(
    await fetcher('https://api.pinterest.com/v5/media', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ media_type: 'video' }),
    }),
    'Pinterest media register',
  );
  const reg = (await registerRes.json()) as {
    media_id?: string;
    upload_url?: string;
    upload_parameters?: Record<string, string>;
  };
  if (!reg.media_id || !reg.upload_url)
    throw new Error('Pinterest returned no upload target');

  const form = new FormData();
  for (const [k, v] of Object.entries(reg.upload_parameters ?? {}))
    form.append(k, v);
  form.append(
    'file',
    new Blob([buf], { type: 'video/mp4' }),
    path.basename(filePath),
  );
  await expectOk(
    await fetcher(reg.upload_url, { method: 'POST', body: form }),
    'Pinterest video upload',
  );

  for (let i = 0; i < 30; i++) {
    const statusRes = await expectOk(
      await fetcher(`https://api.pinterest.com/v5/media/${reg.media_id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      'Pinterest media status',
    );
    const status = (await statusRes.json()) as { status?: string };
    if (status.status === 'succeeded') return reg.media_id;
    if (status.status === 'failed')
      throw new Error('Pinterest video processing failed');
    await sleep(2000);
  }
  return reg.media_id;
}
