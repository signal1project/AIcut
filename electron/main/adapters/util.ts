import type { PublishInput } from './types';

/** Append hashtags to the body as a trailing block (shared across adapters). */
export function buildCaption(input: PublishInput): string {
  const tags = input.hashtags.length ? '\n\n' + input.hashtags.join(' ') : '';
  return input.body + tags;
}
