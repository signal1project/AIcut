/**
 * Generates a polished AICut desktop icon.
 * Creates a multi-resolution ICO (256, 128, 64, 48, 32, 16) from an SVG.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'build', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// ── SVG design: dark rounded square, gradient, scissor-cut motif + AI spark ──
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1f35"/>
      <stop offset="100%" stop-color="#0c0c18"/>
    </linearGradient>
    <linearGradient id="blade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7ba0ff"/>
      <stop offset="100%" stop-color="#4d7cff"/>
    </linearGradient>
    <linearGradient id="spark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#a0c0ff"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softglow">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background: dark rounded square -->
  <rect width="256" height="256" rx="52" ry="52" fill="url(#bg)"/>

  <!-- Subtle inner border glow -->
  <rect width="256" height="256" rx="52" ry="52" fill="none"
        stroke="#4d7cff" stroke-width="2" opacity="0.25"/>

  <!-- Scissors: top blade -->
  <g filter="url(#softglow)">
    <!-- Top handle ring -->
    <circle cx="82" cy="82" r="22" fill="none" stroke="url(#blade)" stroke-width="9"/>
    <!-- Bottom handle ring -->
    <circle cx="82" cy="175" r="22" fill="none" stroke="url(#blade)" stroke-width="9"/>

    <!-- Pivot screw -->
    <circle cx="128" cy="128" r="7" fill="#4d7cff" opacity="0.9"/>
    <circle cx="128" cy="128" r="3.5" fill="#7ba0ff"/>

    <!-- Top blade: handle ring center to pivot -->
    <line x1="82" y1="82" x2="128" y2="128"
          stroke="url(#blade)" stroke-width="10" stroke-linecap="round"/>
    <!-- Top blade: pivot to tip -->
    <line x1="128" y1="128" x2="200" y2="68"
          stroke="url(#blade)" stroke-width="8" stroke-linecap="round"/>

    <!-- Bottom blade: handle ring center to pivot -->
    <line x1="82" y1="175" x2="128" y2="128"
          stroke="url(#blade)" stroke-width="10" stroke-linecap="round"/>
    <!-- Bottom blade: pivot to tip -->
    <line x1="128" y1="128" x2="200" y2="188"
          stroke="url(#blade)" stroke-width="8" stroke-linecap="round"/>
  </g>

  <!-- AI spark: three rays emanating from top-right -->
  <g filter="url(#glow)" opacity="0.95">
    <!-- Star burst at tip of top blade -->
    <circle cx="200" cy="68" r="8" fill="white" opacity="0.9"/>
    <!-- Ray 1 -->
    <line x1="200" y1="68" x2="220" y2="48" stroke="url(#spark)" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <!-- Ray 2 -->
    <line x1="200" y1="68" x2="224" y2="68" stroke="url(#spark)" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <!-- Ray 3 -->
    <line x1="200" y1="68" x2="216" y2="44" stroke="url(#spark)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>

    <!-- Small sparkle dots -->
    <circle cx="218" cy="50" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="222" cy="62" r="1.8" fill="#a0c0ff" opacity="0.6"/>
    <circle cx="210" cy="45" r="1.5" fill="white" opacity="0.5"/>
  </g>

  <!-- "AI" text badge bottom-right -->
  <rect x="164" y="176" width="60" height="28" rx="8" fill="#4d7cff" opacity="0.9"/>
  <text x="194" y="196" font-family="system-ui, -apple-system, sans-serif"
        font-size="16" font-weight="800" fill="white" text-anchor="middle"
        letter-spacing="1">AI</text>
</svg>`;

const sizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer()
  )
);

// Write largest PNG as the main app icon
await sharp(pngBuffers[0]).toFile(path.join(outDir, '512x512.png'));
console.log('✓ build/icons/512x512.png written');

// Build ICO file manually (ICONDIR + ICONDIRENTRYs + image data)
function buildIco(images) {
  // Each image: { width, height, data }
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * images.length;

  let offset = dirSize;
  const offsets = images.map((img) => {
    const o = offset;
    offset += img.data.length;
    return o;
  });

  const buf = Buffer.alloc(dirSize + images.reduce((s, i) => s + i.data.length, 0));

  // ICONDIR header
  buf.writeUInt16LE(0, 0);       // reserved
  buf.writeUInt16LE(1, 2);       // type: ICO
  buf.writeUInt16LE(images.length, 4);

  // ICONDIRENTRY per image
  images.forEach((img, i) => {
    const base = headerSize + i * entrySize;
    buf.writeUInt8(img.width >= 256 ? 0 : img.width, base);
    buf.writeUInt8(img.height >= 256 ? 0 : img.height, base + 1);
    buf.writeUInt8(0, base + 2);   // color count
    buf.writeUInt8(0, base + 3);   // reserved
    buf.writeUInt16LE(1, base + 4); // planes
    buf.writeUInt16LE(32, base + 6); // bits per pixel
    buf.writeUInt32LE(img.data.length, base + 8);
    buf.writeUInt32LE(offsets[i], base + 12);
  });

  // Image data
  images.forEach((img, i) => {
    img.data.copy(buf, offsets[i]);
  });

  return buf;
}

const images = sizes.map((size, i) => ({
  width: size,
  height: size,
  data: pngBuffers[i],
}));

const icoBuf = buildIco(images);
const icoPath = path.join(outDir, 'aicut.ico');
fs.writeFileSync(icoPath, icoBuf);
console.log(`✓ build/icons/aicut.ico written (${(icoBuf.length / 1024).toFixed(1)} KB, ${sizes.join('/')}px)`);

// Also copy to public/ so Electron picks it up
fs.copyFileSync(icoPath, path.join(__dirname, '..', 'public', 'assets', 'favicon.ico'));
fs.copyFileSync(icoPath, path.join(__dirname, '..', 'public', 'favicon.ico'));
console.log('✓ Copied to public/assets/favicon.ico and public/favicon.ico');
