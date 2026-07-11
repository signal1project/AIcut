import type { AIAuthMethod, AIProviderName, Platform } from '@mas/types';
import { AI_PROVIDER_INFO } from '@mas/types';
import { OLLAMA_DEFAULT_BASE_URL } from '../ai/ollamaProvider';
import type { OAuthClientConfig } from '../oauth/oauthService';

// Key/value seam (electron-store in production; faked in tests). Distinct from
// the credential store — this holds non-secret-ish config (client ids, provider
// selection). API keys live here too but are only ever read in the main process.
export interface SettingsStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface AIProviderSettings {
  name: AIProviderName;
  /** The authentication method used by this provider. Derived from AI_PROVIDER_INFO. */
  authMethod: AIAuthMethod;
  /**
   * API key for `api_key` and `oauth_key` providers.
   * Empty string for `local` providers (Ollama).
   */
  apiKey: string;
  /** Override base URL — used by Ollama when running on a non-default port/host. */
  baseUrl?: string;
  /** Active model slug override (e.g. "openai/gpt-4o", "llama3"). */
  model?: string;
}

const K = {
  oauth: (p: Platform) => `mas.settings.oauth.${p}`,
  activeProvider: 'mas.settings.ai.active',
  providerKey: (n: AIProviderName) => `mas.settings.ai.key.${n}`,
  providerModel: (n: AIProviderName) => `mas.settings.ai.model.${n}`,
  ollamaBaseUrl: 'mas.settings.ai.ollama.baseUrl',
  chatgptTokens: 'mas.settings.ai.chatgpt.tokens',
  brandKit: 'mas.settings.brand.kit',
  competitors: 'mas.settings.competitors',
};

/** OAuth token bundle for ChatGPT sign-in (main-process only, like API keys). */
export interface ChatGPTTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Brand voice profile injected into every AI content brief so generated copy
 * stays on-brand across sessions and platforms.
 */
export interface BrandKit {
  /** e.g. "confident, warm, no hype" */
  voice: string;
  /** e.g. "first-time homebuyers in Houston" */
  audience: string;
  /** Hashtags appended/preferred on every post. */
  hashtags: string[];
  /** Words/phrases the AI must never use. */
  bannedWords: string[];
  /** Optional signature/CTA line. */
  signature: string;
}

/** Manually-tracked competitor for benchmarking. */
export interface CompetitorEntry {
  id: string;
  name: string;
  platform: string;
  handle: string;
  notes: string;
  /** Manual metric snapshots: { date, followers, engagementRate? } */
  snapshots: Array<{
    date: string;
    followers: number;
    engagementRate?: number;
  }>;
}

/** Typed accessor over persisted app settings used by the MAS runtime. */
export class Settings {
  constructor(private readonly store: SettingsStore) {}

  // ── Platform OAuth ─────────────────────────────────────────────────────────

  getPlatformOAuth(platform: Platform): OAuthClientConfig | null {
    const raw = this.store.get(K.oauth(platform));
    if (!raw || typeof raw !== 'object') return null;
    const cfg = raw as Partial<OAuthClientConfig>;
    if (!cfg.clientId || !cfg.redirectUri) return null;
    return {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
    };
  }

  setPlatformOAuth(platform: Platform, config: OAuthClientConfig): void {
    this.store.set(K.oauth(platform), config);
  }

  // ── AI Provider ────────────────────────────────────────────────────────────

  /**
   * Return the full settings for the currently active AI provider, or null if
   * no provider has been configured yet.
   */
  getActiveAIProvider(): AIProviderSettings | null {
    const name = this.store.get(K.activeProvider) as AIProviderName | undefined;
    if (!name) return null;
    return this.getProviderSettings(name);
  }

  /** Return settings for a specific provider (regardless of which is active). */
  getProviderSettings(name: AIProviderName): AIProviderSettings | null {
    const info = AI_PROVIDER_INFO[name];
    if (!info) return null;

    if (info.authMethod === 'local') {
      return {
        name,
        authMethod: info.authMethod,
        apiKey: '',
        baseUrl: this.getOllamaBaseUrl(),
        model: this.store.get(K.providerModel(name)) as string | undefined,
      };
    }

    // Token-based providers (ChatGPT): configured = a token bundle exists.
    // The provider refreshes/reads tokens itself; no apiKey is involved.
    if (info.authMethod === 'oauth_token') {
      if (!this.getChatGPTTokens()) return null;
      return {
        name,
        authMethod: info.authMethod,
        apiKey: '',
        model: this.store.get(K.providerModel(name)) as string | undefined,
      };
    }

    const apiKey = this.store.get(K.providerKey(name)) as string | undefined;
    if (!apiKey) return null;

    return {
      name,
      authMethod: info.authMethod,
      apiKey,
      model: this.store.get(K.providerModel(name)) as string | undefined,
    };
  }

  setAIProviderKey(name: AIProviderName, apiKey: string): void {
    this.store.set(K.providerKey(name), apiKey);
  }

  setAIProviderModel(name: AIProviderName, model: string): void {
    this.store.set(K.providerModel(name), model);
  }

  setActiveAIProvider(name: AIProviderName): void {
    this.store.set(K.activeProvider, name);
  }

  // ── ChatGPT sign-in tokens ─────────────────────────────────────────────────

  getChatGPTTokens(): ChatGPTTokenBundle | null {
    const raw = this.store.get(K.chatgptTokens);
    if (!raw || typeof raw !== 'object') return null;
    const t = raw as Partial<ChatGPTTokenBundle>;
    if (!t.accessToken) return null;
    return {
      accessToken: t.accessToken,
      refreshToken: t.refreshToken ?? '',
      expiresAt: typeof t.expiresAt === 'number' ? t.expiresAt : 0,
    };
  }

  setChatGPTTokens(tokens: ChatGPTTokenBundle): void {
    this.store.set(K.chatgptTokens, tokens);
  }

  clearChatGPTTokens(): void {
    this.store.set(K.chatgptTokens, null);
  }

  // ── Ollama-specific ────────────────────────────────────────────────────────

  getOllamaBaseUrl(): string {
    return (
      (this.store.get(K.ollamaBaseUrl) as string | undefined) ??
      OLLAMA_DEFAULT_BASE_URL
    );
  }

  setOllamaBaseUrl(url: string): void {
    this.store.set(K.ollamaBaseUrl, url);
  }

  // ── Brand kit ──────────────────────────────────────────────────────────────

  getBrandKit(): BrandKit | null {
    const raw = this.store.get(K.brandKit);
    if (!raw || typeof raw !== 'object') return null;
    const kit = raw as Partial<BrandKit>;
    return {
      voice: kit.voice ?? '',
      audience: kit.audience ?? '',
      hashtags: Array.isArray(kit.hashtags) ? kit.hashtags : [],
      bannedWords: Array.isArray(kit.bannedWords) ? kit.bannedWords : [],
      signature: kit.signature ?? '',
    };
  }

  setBrandKit(kit: BrandKit): void {
    this.store.set(K.brandKit, kit);
  }

  // ── Competitor tracking (manual benchmarks) ────────────────────────────────

  getCompetitors(): CompetitorEntry[] {
    const raw = this.store.get(K.competitors);
    return Array.isArray(raw) ? (raw as CompetitorEntry[]) : [];
  }

  setCompetitors(entries: CompetitorEntry[]): void {
    this.store.set(K.competitors, entries);
  }

  // ── Image generation (always OpenAI) ──────────────────────────────────────

  /** Image generation always routes to OpenAI (the only provider that supports it). */
  getImageProvider(): AIProviderSettings | null {
    const apiKey = this.store.get(K.providerKey('openai')) as
      | string
      | undefined;
    if (!apiKey) return null;
    return { name: 'openai', authMethod: 'api_key', apiKey };
  }
}
