// Verifies the aicut-media:// protocol + preview-proxy pipeline inside a REAL
// Electron renderer (hidden window, webSecurity on). Bundles the TS harness
// with esbuild, then runs Electron normally (NOT as node).
//
// Usage: node scripts/verify-media-protocol.mjs <media-dir>
//   <media-dir> must contain normal_h264.mp4 and phone_video_hevc.mov, e.g.:
//   ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30:duration=4 \
//          -f lavfi -i sine=frequency=440:duration=4 \
//          -c:v libx265 -tag:v hvc1 -c:a aac phone_video_hevc.mov
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = process.argv[2];
if (!mediaDir) {
  console.error('Usage: node scripts/verify-media-protocol.mjs <media-dir>');
  process.exit(2);
}

const entry = path.join(root, 'electron/main/aicuts/__e2e__/mediaProtocol.e2e.ts');
const outfile = path.join(root, 'electron/main/aicuts/__e2e__/_media-bundle.cjs');

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
});

const electronPath = require('electron');
const child = spawn(electronPath, [outfile], {
  stdio: 'inherit',
  env: { ...process.env, AICUT_E2E_MEDIA_DIR: path.resolve(mediaDir) },
});
child.on('exit', (code) => process.exit(code ?? 1));
