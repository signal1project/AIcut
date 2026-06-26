import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import type { AIProvider, AIProviderName } from '@mas/types';
import { ClaudeProvider, type AnthropicLike } from './claudeProvider';
import { OpenAIProvider, type OpenAILike } from './openaiProvider';
import { GroqProvider, type GroqLike } from './groqProvider';
import { OpenRouterProvider, OPENROUTER_BASE_URL } from './openRouterProvider';
import { OllamaProvider, OLLAMA_DEFAULT_BASE_URL, OLLAMA_OPENAI_COMPAT_PATH } from './ollamaProvider';

export { ClaudeProvider } from './claudeProvider';
export { OpenAIProvider } from './openaiProvider';
export { GroqProvider } from './groqProvider';
export { OpenRouterProvider, createOpenRouterProvider } from './openRouterProvider';
export { OllamaProvider, createOllamaProvider, realOllamaDiscoverer } from './ollamaProvider';
export type { OllamaModel, OllamaDiscoverer } from './ollamaProvider';
export { runOpenRouterOAuthFlow, openOllamaInstallPage } from './openRouterOAuth';
export { systemPrompt, resolveMaxTokens } from './prompt';

export interface CreateAIProviderOptions {
  /** Required for api_key and oauth_key providers. */
  apiKey?: string;
  /** Override base URL (Ollama: defaults to http://localhost:11434). */
  baseUrl?: string;
  /** Model slug override. */
  model?: string;
}

/** Construct an AI provider from a name + options. Options come from Settings. */
export function createAIProvider(
  name: AIProviderName,
  opts: CreateAIProviderOptions,
): AIProvider {
  switch (name) {
    case 'claude':
      return new ClaudeProvider(
        new Anthropic({ apiKey: opts.apiKey }) as unknown as AnthropicLike,
        opts.model,
      );
    case 'openai':
      return new OpenAIProvider(
        new OpenAI({ apiKey: opts.apiKey }) as unknown as OpenAILike,
        opts.model,
      );
    case 'openrouter':
      return new OpenRouterProvider(
        new OpenAI({
          apiKey: opts.apiKey,
          baseURL: OPENROUTER_BASE_URL,
          defaultHeaders: {
            'HTTP-Referer': 'https://github.com/blk-ink/master-ai-social',
            'X-Title': 'Social Manager AI',
          },
        }) as unknown as OpenAILike,
        opts.model,
      );
    case 'ollama': {
      const base = opts.baseUrl ?? OLLAMA_DEFAULT_BASE_URL;
      return new OllamaProvider(
        new OpenAI({
          apiKey: 'ollama',
          baseURL: `${base}${OLLAMA_OPENAI_COMPAT_PATH}`,
        }) as unknown as OpenAILike,
        opts.model,
      );
    }
    case 'groq':
      return new GroqProvider(
        new Groq({ apiKey: opts.apiKey }) as unknown as GroqLike,
        opts.model,
      );
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown AI provider: ${exhaustive}`);
    }
  }
}
