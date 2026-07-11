import { protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

/**
 * Custom media protocol for the editor renderer.
 *
 * The renderer runs with webSecurity enabled (and from http://localhost:5173
 * in dev), so `file://` URLs are blocked — <video>/<img> elements silently
 * render nothing. This scheme serves local media files with proper
 * Range-request support so video seeking works.
 *
 * URL shape: aicut-media://media/?p=<encodeURIComponent(absolutePath)>
 * (path travels in the query string to avoid drive-letter/host parsing issues
 * with standard schemes on Windows).
 */
export const MEDIA_SCHEME = 'aicut-media';

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mts': 'video/mp2t',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Must run before app 'ready'. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

/** Must run after app 'ready'. */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let filePath: string;
    try {
      const url = new URL(request.url);
      filePath = url.searchParams.get('p') ?? '';
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    // Only serve known media/image types — this scheme is not a general file reader.
    if (!filePath || !mime) return new Response('Unsupported', { status: 415 });

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    if (!stat.isFile()) return new Response('Not found', { status: 404 });

    const range = request.headers.get('range');
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2]
          ? Math.min(Number(match[2]), stat.size - 1)
          : stat.size - 1;
        if (start >= stat.size || start > end) {
          return new Response('Range not satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` },
          });
        }
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(
          Readable.toWeb(stream) as unknown as ReadableStream,
          {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Content-Length': String(end - start + 1),
            },
          },
        );
      }
    }

    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(stat.size),
      },
    });
  });
}
