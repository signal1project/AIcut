// Runs the MAS end-to-end integration harness under Electron's node ABI so the
// Electron-built better-sqlite3 binary loads. Bundles the TS harness with esbuild
// (workspace @mas/* inlined, node_modules external), then spawns Electron with
// ELECTRON_RUN_AS_NODE. Usage: npm run test:e2e
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'electron/main/mas/__e2e__/e2e.integration.ts');
const outfile = path.join(root, 'electron/main/mas/__e2e__/_bundle.cjs');

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: {
    '@mas/types': path.join(root, 'packages/types/src/index.ts'),
    '@mas/ui': path.join(root, 'packages/ui/src/index.ts'),
  },
});

const electronPath = require('electron');
const child = spawn(electronPath, [outfile], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
