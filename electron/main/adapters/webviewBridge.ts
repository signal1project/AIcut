/**
 * Webview bridge — lets users log in to social platforms via an Electron BrowserWindow
 * that persists session cookies. No developer app registration required.
 * This is how consumer social schedulers (Buffer, CapCut, etc.) work.
 */

import { BrowserWindow, ipcMain, session } from 'electron';

interface PlatformMeta {
  label: string;
  loginUrl: string;
  composeUrl: string;
  sessionDomain: string;
  authCookieHints: string[]; // cookie names that indicate a logged-in session
}

export const WEBVIEW_PLATFORMS: Record<string, PlatformMeta> = {
  twitter: {
    label: 'X / Twitter',
    loginUrl: 'https://x.com/i/flow/login',
    composeUrl: 'https://x.com/compose/tweet',
    sessionDomain: '.x.com',
    authCookieHints: ['auth_token', 'ct0'],
  },
  facebook: {
    label: 'Facebook',
    loginUrl: 'https://www.facebook.com/',
    composeUrl: 'https://www.facebook.com/',
    sessionDomain: '.facebook.com',
    authCookieHints: ['c_user', 'xs'],
  },
  instagram: {
    label: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    composeUrl: 'https://www.instagram.com/',
    sessionDomain: '.instagram.com',
    authCookieHints: ['sessionid', 'csrftoken'],
  },
  linkedin: {
    label: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    composeUrl: 'https://www.linkedin.com/feed/',
    sessionDomain: '.linkedin.com',
    authCookieHints: ['li_at', 'JSESSIONID'],
  },
  threads: {
    label: 'Threads',
    loginUrl: 'https://www.threads.net/',
    composeUrl: 'https://www.threads.net/',
    sessionDomain: '.threads.net',
    authCookieHints: ['sessionid'],
  },
  pinterest: {
    label: 'Pinterest',
    loginUrl: 'https://www.pinterest.com/login/',
    composeUrl: 'https://www.pinterest.com/pin-builder/',
    sessionDomain: '.pinterest.com',
    authCookieHints: ['_pinterest_sess', '_auth'],
  },
  youtube: {
    label: 'YouTube',
    loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube',
    composeUrl: 'https://studio.youtube.com/',
    sessionDomain: '.google.com',
    authCookieHints: ['SAPISID', 'SID'],
  },
  tiktok: {
    label: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    composeUrl: 'https://www.tiktok.com/creator-center/upload',
    sessionDomain: '.tiktok.com',
    authCookieHints: ['sessionid', 'sid_guard'],
  },
};

// ── Auto-fill scripts ─────────────────────────────────────────────────────────
// These run after compose page loads to prefill the post body.

function twitterFill(body: string): string {
  return `(async () => {
    for (let i = 0; i < 20; i++) {
      const ta = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (ta) { ta.focus(); document.execCommand('insertText', false, ${JSON.stringify(body)}); return; }
      await new Promise(r => setTimeout(r, 300));
    }
  })();`;
}

function linkedInFill(body: string): string {
  return `(async () => {
    // Click "Start a post"
    const trigger = document.querySelector('[data-control-name="share.sharebox_focus"]')
      || document.querySelector('.share-box-feed-entry__trigger')
      || document.querySelector('[placeholder*="post"]');
    if (trigger) trigger.click();
    await new Promise(r => setTimeout(r, 1500));
    const editor = document.querySelector('.ql-editor')
      || document.querySelector('[data-placeholder][role="textbox"]');
    if (editor) { editor.focus(); document.execCommand('insertText', false, ${JSON.stringify(body)}); }
  })();`;
}

const FILL_SCRIPTS: Partial<Record<string, (body: string) => string>> = {
  twitter: twitterFill,
  linkedin: linkedInFill,
};

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerWebviewBridge(mainWindow: BrowserWindow): void {
  /** Open platform login window. Returns when window is closed. */
  ipcMain.handle('mas:social:open-login', async (_e, platform: string) => {
    const meta = WEBVIEW_PLATFORMS[platform];
    if (!meta) throw new Error(`Unknown platform: ${platform}`);

    const ses = session.fromPartition(`persist:social-${platform}`, { cache: true });
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

    const ses = session.fromPartition(`persist:social-${platform}`, { cache: true });
    const cookies = await ses.cookies.get({ domain: meta.sessionDomain });
    const loggedIn = meta.authCookieHints.some((hint) =>
      cookies.some((c) => c.name === hint && c.value.length > 0),
    );
    return { loggedIn };
  });

  /** Clear a platform's session (log out). */
  ipcMain.handle('mas:social:logout', async (_e, platform: string) => {
    const ses = session.fromPartition(`persist:social-${platform}`, { cache: true });
    await ses.clearStorageData();
    return { ok: true };
  });

  /**
   * Open compose window with content pre-filled.
   * For most platforms this opens the site and injects text — user clicks Post.
   * Twitter auto-fills via execCommand.
   */
  ipcMain.handle(
    'mas:social:post-webview',
    async (_e, { platform, body }: { platform: string; body: string }) => {
      const meta = WEBVIEW_PLATFORMS[platform];
      if (!meta) throw new Error(`Unknown platform: ${platform}`);

      const ses = session.fromPartition(`persist:social-${platform}`, { cache: true });
      const win = new BrowserWindow({
        width: 620,
        height: 820,
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

      const fillFn = FILL_SCRIPTS[platform];
      if (fillFn) {
        win.webContents.once('did-finish-load', () => {
          setTimeout(() => {
            win.webContents.executeJavaScript(fillFn(body)).catch(() => {});
          }, 800);
        });
      }

      return new Promise<{ done: boolean }>((resolve) => {
        win.on('closed', () => resolve({ done: true }));
      });
    },
  );
}
