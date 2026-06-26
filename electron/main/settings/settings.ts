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
};

/** Typed accessor over persisted app settings used by the MAS runtime. */
export class Settings {
  constructor(private readonly store: SettingsStore) {}

  // ── Platform OAuth ─────────────────────────────────────────────────────────

  getPlatformOAuth(platform: Platform): OAuthClientConfig | null {
    const raw = this.store.get(K.oauth(platform));
    if (!raw || typeof raw !== 'object') return null;
    const cfg = raw as Partial<OAuthClientConfig>;
    if (!cfg.clientId || !cfg.redirectUri) return null;
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri };
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

    const info = AI_PROVIDER_INFO[name];
    if (!info) return null;

    // Local providers (Ollama) don't need an API key.
    if (info.authMethod === 'local') {
      return {
        name,
        authMethod: info.authMethod,
        apiKey: '',
        baseUrl: this.getOllamaBaseUrl(),
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

  // ── Ollama-specific ────────────────────────────────────────────────────────

  getOllamaBaseUrl(): string {
    return (this.store.get(K.ollamaBaseUrl) as string | undefined) ?? OLLAMA_DEFAULT_BASE_URL;
  }

  setOllamaBaseUrl(url: string): void {
    this.store.set(K.ollamaBaseUrl, url);
  }

  // ── Image generation (always OpenAI) ──────────────────────────────────────

  /** Image generation always routes to OpenAI (the only provider that supports it). */
  getImageProvider(): AIProviderSettings | null {
    const apiKey = this.store.get(K.providerKey('openai')) as string | undefined;
    if (!apiKey) return null;
    return { name: 'openai', authMethod: 'api_key', apiKey };
  }
}
