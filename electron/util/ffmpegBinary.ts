import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

/**
 * Single source of truth for the ffmpeg binary path.
 *
 * Prefers ffmpeg-static (6.x — needed for xfade transitions, adelay=all,
 * colortemperature, and years of fixes) and falls back to the legacy
 * @ffmpeg-installer binary (a 2018 build) if the static download is missing.
 */
export function resolveFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static') as string | null;
    if (staticPath) return staticPath.replace('app.asar', 'app.asar.unpacked');
  } catch {
    // fall through to the legacy installer
  }
  return ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked');
}
