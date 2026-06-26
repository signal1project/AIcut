import { ipcMain, BrowserWindow } from 'electron';
import type { DataSource } from 'typeorm';
import { AccountStatus, AuditAction, type AIProviderName, type Platform } from '@mas/types';
import { AI_PROVIDER_INFO } from '@mas/types';
import { ConnectedAccountModel } from '../../db/models/mas/connectedAccount';
import { AuditLogModel } from '../../db/models/mas/auditLog';
import { CredentialManager } from '../credentials/credentialManager';
import { createOAuthService } from '../oauth';
import type { OAuthClientConfig } from '../oauth/oauthService';
import { Settings } from '../settings/settings';
import { runOpenRouterOAuthFlow, openOllamaInstallPage } from '../ai/openRouterOAuth';
import { realOllamaDiscoverer } from '../ai/ollamaProvider';

export interface MasIpcDeps {
  dataSource: DataSource;
  settings: Settings;
  credentials: CredentialManager;
}

/**
 * IPC surface for onboarding/settings: configure OAuth client apps + AI keys,
 * begin an OAuth authorize flow, and complete it (token exchange → encrypted
 * storage → ConnectedAccount row). Secrets never travel back to the renderer.
 */
export function registerMasIpc(deps: MasIpcDeps): void {
  const { dataSource, settings, credentials } = deps;
  const oauth = createOAuthService(credentials);

  // ── AI provider settings ───────────────────────────────────────────────────

  ipcMain.handle('mas:settings:set-ai-key', (_e, name: AIProviderName, key: string) => {
    settings.setAIProviderKey(name, key);
    // Auto-activate this provider when a key is saved (unless one is already active).
    const current = settings.getActiveAIProvider();
    if (!current) settings.setActiveAIProvider(name);
    return { ok: true };
  });

  ipcMain.handle('mas:settings:set-active-provider', (_e, name: AIProviderName) => {
    settings.setActiveAIProvider(name);
    return { ok: true };
  });

  ipcMain.handle('mas:settings:set-ai-model', (_e, name: AIProviderName, model: string) => {
    settings.setAIProviderModel(name, model);
    return { ok: true };
  });

  ipcMain.handle('mas:settings:set-oauth', (_e, platform: Platform, config: OAuthClientConfig) => {
    settings.setPlatformOAuth(platform, config);
    return { ok: true };
  });

  /**
   * Return settings status visible to the UI — no secrets included.
   * Renderer uses this to show/hide "Connected" badges.
   */
  ipcMain.handle('mas:settings:status', () => {
    const active = settings.getActiveAIProvider();
    // Per-provider "is configured" flags.
    const providers = Object.values(AI_PROVIDER_INFO).map((info) => {
      const ps = settings.getProviderSettings(info.name);
      return {
        name: info.name,
        label: info.label,
        authMethod: info.authMethod,
        supportsImages: info.supportsImages,
        dashboardUrl: info.dashboardUrl,
        isConfigured: ps !== null,
        isActive: active?.name === info.name,
        model: ps?.model ?? null,
        ollamaBaseUrl: info.name === 'ollama' ? settings.getOllamaBaseUrl() : null,
      };
    });
    return {
      activeProvider: active?.name ?? null,
      imageReady: settings.getImageProvider() !== null,
      providers,
    };
  });

  // ── Ollama ─────────────────────────────────────────────────────────────────

  /**
   * Ping the local Ollama daemon and return the list of installed models.
   * Returns { running: false, models: [] } when the daemon is not detected.
   */
  ipcMain.handle('mas:ai:ollama-discover', async (_e, baseUrl?: string) => {
    const url = baseUrl ?? settings.getOllamaBaseUrl();
    const models = await realOllamaDiscoverer.listModels(url);
    return { running: models.length > 0, models };
  });

  ipcMain.handle('mas:ai:ollama-set-url', (_e, url: string) => {
    settings.setOllamaBaseUrl(url);
    return { ok: true };
  });

  /** Open the Ollama install page in the system browser. */
  ipcMain.handle('mas:ai:ollama-install-page', () => {
    openOllamaInstallPage();
    return { ok: true };
  });

  // ── OpenRouter OAuth ───────────────────────────────────────────────────────

  /**
   * Start the OpenRouter OAuth flow in a child BrowserWindow.
   * Resolves with the obtained API key and automatically saves it.
   * The renderer awaits this IPC call for the result.
   */
  ipcMain.handle('mas:ai:openrouter-oauth', async (event) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin) throw new Error('Could not find the parent BrowserWindow.');

    const key = await runOpenRouterOAuthFlow(senderWin);
    settings.setAIProviderKey('openrouter', key);
    const current = settings.getActiveAIProvider();
    if (!current) settings.setActiveAIProvider('openrouter');

    return { ok: true };
  });

  // ── Social platform OAuth ──────────────────────────────────────────────────

  ipcMain.handle('mas:oauth:authorize-url', (_e, platform: Platform) => {
    const config = settings.getPlatformOAuth(platform);
    if (!config) throw new Error(`Configure the ${platform} OAuth app first.`);
    return oauth.buildAuthorizeUrl(platform, config);
  });

  /** List all connected accounts (no secrets — for the publish UI account picker). */
  ipcMain.handle('mas:accounts:list', async () => {
    const repo = dataSource.getRepository(ConnectedAccountModel);
    const accounts = await repo.find({ order: { platform: 'ASC', accountName: 'ASC' } });
    return accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      accountName: a.accountName,
      externalId: a.externalId,
      status: a.status,
    }));
  });

  ipcMain.handle(
    'mas:oauth:complete',
    async (
      _e,
      args: {
        platform: Platform;
        redirectUrl: string;
        expectedState: string;
        codeVerifier?: string;
        accountName: string;
        externalId: string;
      },
    ) => {
      const config = settings.getPlatformOAuth(args.platform);
      if (!config) throw new Error(`Configure the ${args.platform} OAuth app first.`);

      const { code } = oauth.parseCallback(args.redirectUrl, args.expectedState);
      const bundle = await oauth.exchangeCode(args.platform, config, {
        code,
        codeVerifier: args.codeVerifier,
      });

      const credentialRef = CredentialManager.refFor(args.platform, args.externalId);
      credentials.save(credentialRef, bundle);

      const repo = dataSource.getRepository(ConnectedAccountModel);
      const account = await repo.save(
        repo.create({
          platform: args.platform,
          accountName: args.accountName,
          externalId: args.externalId,
          status: AccountStatus.CONNECTED,
          credentialRef,
          tokenExpiresAt: bundle.expiresAt,
          metadata: {},
        }),
      );

      const auditRepo = dataSource.getRepository(AuditLogModel);
      await auditRepo.save(
        auditRepo.create({
          action: AuditAction.ACCOUNT_CONNECTED,
          entity: 'mas_connected_account',
          entityId: account.id,
          details: { platform: args.platform },
        }),
      );

      return { id: account.id, platform: account.platform, accountName: account.accountName };
    },
  );
}
