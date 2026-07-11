/**
 * Builds a renderer-loadable URL for a local media file.
 *
 * `file://` URLs are blocked by webSecurity (and malformed for Windows paths
 * anyway), so the main process serves media through the aicut-media://
 * protocol with Range support. See electron/main/aicuts/mediaProtocol.ts.
 */
export function toMediaUrl(absolutePath: string | undefined | null): string {
  if (!absolutePath) return '';
  return `aicut-media://media/?p=${encodeURIComponent(absolutePath)}`;
}
