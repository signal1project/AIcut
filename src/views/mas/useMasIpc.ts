import { useCallback } from 'react';
import type { AIProviderName } from '@mas/types';
import type { SettingsStatus } from '@mas/ui';

/**
 * Thin typed wrapper over window.ipcRenderer for MAS-specific IPC calls.
 * The renderer never holds a stable reference to the raw ipcRenderer; all
 * calls are isolated here to keep components testable.
 */
export function useMasIpc() {
  /** Fetch all provider status flags (configured, active, etc.). */
  const getSettingsStatus = useCallback(async (): Promise<SettingsStatus> => {
    return window.ipcRenderer.invoke('mas:settings:status') as Promise<SettingsStatus>;
  }, []);

  /** Save an API key for a provider. Returns { ok: true }. */
  const setAIKey = useCallback(async (name: AIProviderName, key: string) => {
    return window.ipcRenderer.invoke('mas:settings:set-ai-key', name, key) as Promise<{ ok: boolean }>;
  }, []);

  /** Change the active AI provider. Returns { ok: true }. */
  const setActiveProvider = useCallback(async (name: AIProviderName) => {
    return window.ipcRenderer.invoke('mas:settings:set-active-provider', name) as Promise<{ ok: boolean }>;
  }, []);

  /** Save a model override for a provider. Returns { ok: true }. */
  const setAIModel = useCallback(async (name: AIProviderName, model: string) => {
    return window.ipcRenderer.invoke('mas:settings:set-ai-model', name, model) as Promise<{ ok: boolean }>;
  }, []);

  /**
   * Start the OpenRouter OAuth flow in a child browser window.
   * Resolves when the user completes auth; rejects if they close the window.
   */
  const connectOpenRouter = useCallback(async () => {
    return window.ipcRenderer.invoke('mas:ai:openrouter-oauth') as Promise<{ ok: boolean }>;
  }, []);

  /**
   * Ping the local Ollama daemon and return available models.
   * Returns { running: boolean, models: { name: string; size: number }[] }.
   */
  const discoverOllama = useCallback(async (baseUrl?: string) => {
    return window.ipcRenderer.invoke('mas:ai:ollama-discover', baseUrl) as Promise<{
      running: boolean;
      models: Array<{ name: string; size: number; modified_at: string }>;
    }>;
  }, []);

  /** Persist a custom Ollama base URL. */
  const setOllamaUrl = useCallback(async (url: string) => {
    return window.ipcRenderer.invoke('mas:ai:ollama-set-url', url) as Promise<{ ok: boolean }>;
  }, []);

  /** Open the Ollama install page in the system browser. */
  const openOllamaInstallPage = useCallback(async () => {
    return window.ipcRenderer.invoke('mas:ai:ollama-install-page') as Promise<{ ok: boolean }>;
  }, []);

  return {
    getSettingsStatus,
    setAIKey,
    setActiveProvider,
    setAIModel,
    connectOpenRouter,
    discoverOllama,
    setOllamaUrl,
    openOllamaInstallPage,
  };
}
