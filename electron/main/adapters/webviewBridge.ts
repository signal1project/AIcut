/**
 * Webview bridge — lets users log in to social platforms via an Electron
 * BrowserWindow that persists session cookies, and posts through the real
 * web composer. No developer app registration required — this is how
 * consumer social schedulers (Buffer, CapCut, etc.) work.
 *
 * Posting pipeline per platform (all best-effort with graceful manual
 * fallback — the compose window simply stays open for the user to finish):
 *   1. open the composer with the persisted session
 *   2. PRE script surfaces the composer / file input where needed
 *   3. media attaches via CDP DOM.setFileInputFiles (walks iframes too —
 *      TikTok's uploader lives in one)
 *   4. FILL script types the caption; the caption is also on the clipboard
 *   5. SUBMIT script polls for an enabled post button and clicks it
 */

import { BrowserWindow, ipcMain, session, clipboard } from 'electron';
import { logger } from '../../global/log';

interface PlatformMeta {
  label: string;
  loginUrl: string;
  composeUrl: string;
  sessionDomain: string;
  authCookieHints: string[]; // cookie names that indicate a logged-in session
  /** Attempt to click the post button automatically. */
  autoSubmit: boolean;
}

export const WEBVIEW_PLATFORMS: Record<string, PlatformMeta> = {
  twitter: {
    label: 'X / Twitter',
    loginUrl: 'https://x.com/i/flow/login',
    composeUrl: 'https://x.com/compose/tweet',
    sessionDomain: '.x.com',
    authCookieHints: ['auth_token', 'ct0'],
    autoSubmit: true,
  },
  facebook: {
    label: 'Facebook',
    loginUrl: 'https://www.facebook.com/',
    composeUrl: 'https://www.facebook.com/',
    sessionDomain: '.facebook.com',
    authCookieHints: ['c_user', 'xs'],
    autoSubmit: false, // composer markup shifts too often — attach+fill, user clicks Post
  },
  instagram: {
    label: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    composeUrl: 'https://www.instagram.com/',
    sessionDomain: '.instagram.com',
    authCookieHints: ['sessionid', 'csrftoken'],
    autoSubmit: false, // multi-step create flow; we open + attach, user reviews
  },
  linkedin: {
    label: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    composeUrl: 'https://www.linkedin.com/feed/',
    sessionDomain: '.linkedin.com',
    authCookieHints: ['li_at', 'JSESSIONID'],
    autoSubmit: true,
  },
  threads: {
    label: 'Threads',
    loginUrl: 'https://www.threads.net/',
    composeUrl: 'https://www.threads.net/',
    sessionDomain: '.threads.net',
    authCookieHints: ['sessionid'],
    autoSubmit: false,
  },
  pinterest: {
    label: 'Pinterest',
    loginUrl: 'https://www.pinterest.com/login/',
    composeUrl: 'https://www.pinterest.com/pin-builder/',
    sessionDomain: '.pinterest.com',
    authCookieHints: ['_pinterest_sess', '_auth'],
    autoSubmit: false, // needs a board choice
  },
  youtube: {
    label: 'YouTube',
    loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube',
    composeUrl: 'https://studio.youtube.com/',
    sessionDomain: '.google.com',
    authCookieHints: ['SAPISID', 'SID'],
    autoSubmit: false, // Studio's multi-page wizard — we open + attach
  },
  tiktok: {
    label: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    composeUrl: 'https://www.tiktok.com/tiktokstudio/upload',
    sessionDomain: '.tiktok.com',
    authCookieHints: ['sessionid', 'sid_guard'],
    autoSubmit: false, // upload processing gate; we attach + fill caption
  },
};

// ── Composer scripts ─────────────────────────────────────────────────────────

/** Click something that surfaces the file input / composer. */
const PRE_SCRIPTS: Partial<Record<string, string>> = {
  instagram: `(async () => {
    for (let i = 0; i < 15; i++) {
      const create = document.querySelector('svg[aria-label="New post"], svg[aria-label="Create"]');
      if (create) { create.closest('a,button,div[role="button"]')?.click(); return; }
      await new Promise(r => setTimeout(r, 400));
    }
  })();`,
  facebook: `(async () => {
    for (let i = 0; i < 15; i++) {
      const btn = [...document.querySelectorAll('div[role="button"], span')]
        .find(el => /photo\\/video/i.test(el.textContent || '') || /photo/i.test(el.getAttribute('aria-label') || ''));
      if (btn) { btn.click(); return; }
      await new Promise(r => setTimeout(r, 400));
    }
  })();`,
  threads: `(async () => {
    for (let i = 0; i < 15; i++) {
      const create = document.querySelector('svg[aria-label="Create"], svg[aria-label="New thread"]');
      if (create) { create.closest('a,button,div[role="button"]')?.click(); return; }
      await new Promise(r => setTimeout(r, 400));
    }
  })();`,
  linkedin: `(async () => {
    for (let i = 0; i < 15; i++) {
      const trigger = document.querySelector('[data-control-name="share.sharebox_focus"], .share-box-feed-entry__trigger')
        || [...document.querySelectorAll('button')].find(b => /start a post/i.test(b.textContent || ''));
      if (trigger) { trigger.click(); return; }
      await new Promise(r => setTimeout(r, 400));
    }
  })();`,
};

function insertTextScript(selectorExpr: string, body: string): string {
  return `(async () => {
    for (let i = 0; i < 30; i++) {
      const el = ${selectorExpr};
      if (el) {
        el.focus();
        document.execCommand('insertText', false, ${JSON.stringify(body)});
        return true;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    return false;
  })();`;
}

const FILL_SCRIPTS: Partial<Record<string, (body: string) => string>> = {
  twitter: (body) =>
    insertTextScript(
      `document.querySelector('[data-testid="tweetTextarea_0"]')`,
      body,
    ),
  linkedin: (body) =>
    insertTextScript(
      `document.querySelector('.ql-editor') || document.querySelector('[data-placeholder][role="textbox"]')`,
      body,
    ),
  facebook: (body) =>
    insertTextScript(
      `[...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')].at(-1)`,
      body,
    ),
  threads: (body) =>
    insertTextScript(
      `[...document.querySelectorAll('div[contenteditable="true"]')].at(-1)`,
      body,
    ),
  tiktok: (body) =>
    insertTextScript(
      `document.querySelector('.public-DraftEditor-content') || [...document.querySelectorAll('div[contenteditable="true"]')].at(-1)`,
      body,
    ),
  pinterest: (body) =>
    insertTextScript(
      `document.querySelector('[data-test-id="pin-draft-title"] textarea, textarea[placeholder*="title" i]')`,
      body,
    ),
};

/** Poll for an ENABLED submit button and click it. Returns true when clicked. */
const SUBMIT_SCRIPTS: Partial<Record<string, string>> = {
  twitter: `(async () => {
    for (let i = 0; i < 150; i++) {
      const btn = document.querySelector('[data-testid="tweetButton"]');
      if (btn && btn.getAttribute('aria-disabled') !== 'true' && !btn.disabled) { btn.click(); return true; }
      await new Promise(r => setTimeout(r, 400));
    }
    return false;
  })();`,
  linkedin: `(async () => {
    for (let i = 0; i < 150; i++) {
      const btn = document.querySelector('.share-actions__primary-action')
        || [...document.querySelectorAll('button')].find(b => /^post$/i.test((b.textContent || '').trim()));
      if (btn && !btn.disabled) { btn.click(); return true; }
      await new Promise(r => setTimeout(r, 400));
    }
    return false;
  })();`,
};

// ── CDP media attachment ─────────────────────────────────────────────────────

interface CdpNode {
  nodeId: number;
  nodeName?: string;
  attributes?: string[];
  children?: CdpNode[];
  contentDocument?: CdpNode;
  shadowRoots?: CdpNode[];
}

function collectFileInputs(node: CdpNode, out: number[]): void {
  if (node.nodeName === 'INPUT') {
    const attrs = node.attributes ?? [];
    for (let i = 0; i < attrs.length - 1; i += 2) {
      if (attrs[i] === 'type' && attrs[i + 1].toLowerCase() === 'file') {
        out.push(node.nodeId);
      }
    }
  }
  for (const child of node.children ?? []) collectFileInputs(child, out);
  if (node.contentDocument) collectFileInputs(node.contentDocument, out);
  for (const sr of node.shadowRoots ?? []) collectFileInputs(sr, out);
}

/**
 * Attach a local file to the page's file input via the DevTools protocol.
 * Walks the FULL tree (pierce: true) so inputs inside iframes and shadow DOM
 * (TikTok, YouTube Studio) are found. Retries while the page builds its UI.
 */
export async function attachMediaViaCdp(
  win: BrowserWindow,
  mediaPath: string,
  timeoutMs = 25_000,
): Promise<boolean> {
  const dbg = win.webContents.debugger;
  try {
    dbg.attach('1.3');
  } catch {
    // already attached
  }
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      if (win.isDestroyed()) return false;
      try {
        const { root } = (await dbg.sendCommand('DOM.getDocument', {
          depth: -1,
          pierce: true,
        })) as { root: CdpNode };
        const inputs: number[] = [];
        collectFileInputs(root, inputs);
        if (inputs.length > 0) {
          await dbg.sendCommand('DOM.setFileInputFiles', {
            nodeId: inputs[0],
            files: [mediaPath],
          });
          return true;
        }
      } catch (err) {
        logger.log('[AICut] CDP file-input scan retry', err);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    return false;
  } finally {
    try {
      dbg.detach();
    } catch {
      /* already detached */
    }
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerWebviewBridge(mainWindow: BrowserWindow): void {
  /** Open platform login window. Returns when window is closed. */
  ipcMain.handle('mas:social:open-login', async (_e, platform: string) => {
    const meta = WEBVIEW_PLATFORMS[platform];
    if (!meta) throw new Error(`Unknown platform: ${platform}`);

    const ses = session.fromPartition(`persist:social-${platform}`, {
      cache: true,
    });
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      title: `Sign in to ${meta.label}`,
      parent: mainWindow,
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.setMenuBarVisibility(false);
    await win.loadURL(meta.loginUrl);

    return new Promise<{ loggedIn: boolean }>((resolve) => {
      win.on('closed', () => resolve({ loggedIn: true }));
    });
  });

  /** Check if platform has an active persisted session. */
  ipcMain.handle('mas:social:session-status', async (_e, platform: string) => {
    const meta = WEBVIEW_PLATFORMS[platform];
    if (!meta) return { loggedIn: false };

    const ses = session.fromPartition(`persist:social-${platform}`, {
      cache: true,
    });
    const cookies = await ses.cookies.get({ domain: meta.sessionDomain });
    const loggedIn = meta.authCookieHints.some((hint) =>
      cookies.some((c) => c.name === hint && c.value.length > 0),
    );
    return { loggedIn };
  });

  /** Session status for every webview platform at once (Share dialog). */
  ipcMain.handle('mas:social:session-status-all', async () => {
    const out: Record<string, boolean> = {};
    for (const [platform, meta] of Object.entries(WEBVIEW_PLATFORMS)) {
      const ses = session.fromPartition(`persist:social-${platform}`, {
        cache: true,
      });
      const cookies = await ses.cookies.get({ domain: meta.sessionDomain });
      out[platform] = meta.authCookieHints.some((hint) =>
        cookies.some((c) => c.name === hint && c.value.length > 0),
      );
    }
    return out;
  });

  /** Clear a platform's session (log out). */
  ipcMain.handle('mas:social:logout', async (_e, platform: string) => {
    const ses = session.fromPartition(`persist:social-${platform}`, {
      cache: true,
    });
    await ses.clearStorageData();
    return { ok: true };
  });

  /**
   * Post through the platform's real web composer: attach media (CDP),
   * fill the caption, and — where reliable — click Post automatically.
   * Falls back to leaving the window open for the user to finish.
   */
  ipcMain.handle(
    'mas:social:post-webview',
    async (
      _e,
      {
        platform,
        body,
        mediaPath,
      }: { platform: string; body: string; mediaPath?: string },
    ) => {
      const meta = WEBVIEW_PLATFORMS[platform];
      if (!meta) throw new Error(`Unknown platform: ${platform}`);

      // Caption always lands on the clipboard as a safety net.
      if (body) clipboard.writeText(body);

      const ses = session.fromPartition(`persist:social-${platform}`, {
        cache: true,
      });
      const win = new BrowserWindow({
        width: 720,
        height: 860,
        title: `Post to ${meta.label}`,
        parent: mainWindow,
        webPreferences: {
          session: ses,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      win.setMenuBarVisibility(false);
      await win.loadURL(meta.composeUrl);
      await new Promise((r) => setTimeout(r, 1200));

      const pre = PRE_SCRIPTS[platform];
      if (pre && !win.isDestroyed()) {
        await win.webContents.executeJavaScript(pre).catch(() => {});
        await new Promise((r) => setTimeout(r, 1500));
      }

      let attached = false;
      if (mediaPath && !win.isDestroyed()) {
        attached = await attachMediaViaCdp(win, mediaPath);
        if (attached) await new Promise((r) => setTimeout(r, 1500));
      }

      let filled = false;
      const fillFn = FILL_SCRIPTS[platform];
      if (fillFn && body && !win.isDestroyed()) {
        filled = Boolean(
          await win.webContents
            .executeJavaScript(fillFn(body))
            .catch(() => false),
        );
      }

      if (meta.autoSubmit && !win.isDestroyed()) {
        const submit = SUBMIT_SCRIPTS[platform];
        if (submit) {
          const clicked = Boolean(
            await win.webContents.executeJavaScript(submit).catch(() => false),
          );
          if (clicked) {
            // Give the platform a moment to fire the request, then close.
            await new Promise((r) => setTimeout(r, 5000));
            if (!win.isDestroyed()) win.destroy();
            return { posted: true, attached, filled, manual: false };
          }
        }
      }

      // Manual finish: window stays open until the user closes it.
      return new Promise<{
        posted: boolean;
        attached: boolean;
        filled: boolean;
        manual: boolean;
      }>((resolve) => {
        win.on('closed', () =>
          resolve({ posted: false, attached, filled, manual: true }),
        );
      });
    },
  );
}
