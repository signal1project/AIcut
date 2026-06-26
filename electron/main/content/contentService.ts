import type { AIProvider, GenerateImageOptions, Platform } from '@mas/types';
import type { PlatformAlgorithmAgent } from '../algorithm/algorithmAgent';

export interface GeneratedContent {
  platform: Platform;
  body: string;
  hashtags: string[];
}

export interface GenerateResult {
  provider: string;
  items: GeneratedContent[];
}

export interface ContentServiceDeps {
  /** The active text provider (from Settings). */
  resolveProvider: () => AIProvider;
  /** A provider that supports image generation (OpenAI); used by generateImage. */
  resolveImageProvider: () => AIProvider;
  /**
   * Optional algorithm agent — when provided, each platform prompt is prefixed
   * with algorithm-aware guidance to help the AI produce more algorithm-friendly
   * content.
   */
  algorithmAgent?: PlatformAlgorithmAgent;
}

/** Pull #hashtags out of generated copy (deduped, order-preserving). */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}0-9_]+/gu) ?? [];
  return [...new Set(matches)];
}

/**
 * Combine the user's brief with an algorithm hint so the AI understands the
 * platform's current reward signals.
 */
export function buildAlgorithmAwareBrief(brief: string, algorithmHint: string): string {
  return `${algorithmHint}\n\n---\nContent brief: ${brief}`;
}

/**
 * Generates platform-tailored copy from a single brief by fanning out to the
 * active AI provider once per target platform (each call shaped by the
 * platform's length limit + tone via systemPrompt). When an algorithmAgent is
 * configured, each brief is prepended with the platform's algorithm playbook
 * hint for more algorithm-friendly output.
 */
export class ContentService {
  constructor(private readonly deps: ContentServiceDeps) {}

  async generate(input: {
    brief: string;
    platforms: Platform[];
    tone?: string;
    /** Explicitly opt-out of algorithm injection even if an agent is configured. */
    skipAlgorithmHints?: boolean;
  }): Promise<GenerateResult> {
    const provider = this.deps.resolveProvider();
    const items = await Promise.all(
      input.platforms.map(async (platform): Promise<GeneratedContent> => {
        let brief = input.brief;

        // Inject algorithm hint when available and not opted out.
        if (this.deps.algorithmAgent && !input.skipAlgorithmHints) {
          const hint = this.deps.algorithmAgent.getPromptHint(platform);
          brief = buildAlgorithmAwareBrief(brief, hint);
        }

        const body = await provider.generateText(brief, { platform, tone: input.tone });
        return { platform, body, hashtags: extractHashtags(body) };
      }),
    );
    return { provider: provider.name, items };
  }

  async generateImage(prompt: string, options?: GenerateImageOptions): Promise<{ url: string }> {
    const provider = this.deps.resolveImageProvider();
    const url = await provider.generateImage(prompt, options);
    return { url };
  }
}
