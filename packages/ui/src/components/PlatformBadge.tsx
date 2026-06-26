import React from 'react';
import { PLATFORM_CONFIG, type Platform } from '@mas/types';

const VARIANT_CLASSES: Record<Platform, string> = {
  facebook:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  instagram: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  twitter:   'bg-sky-500/15 text-sky-400 border-sky-500/30',
  threads:   'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  pinterest: 'bg-red-500/15 text-red-400 border-red-500/30',
  youtube:   'bg-red-600/15 text-red-500 border-red-600/30',
  tiktok:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  linkedin:  'bg-blue-700/15 text-blue-500 border-blue-700/30',
};

export interface PlatformBadgeProps {
  platform: Platform;
  showTier?: boolean;
}

/** Colored badge for a platform, optionally noting its API tier. */
export function PlatformBadge({ platform, showTier }: PlatformBadgeProps): React.ReactElement {
  const cfg = PLATFORM_CONFIG[platform];
  const classes = VARIANT_CLASSES[platform] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {cfg.label}
      {showTier ? ` · T${cfg.tier}` : ''}
    </span>
  );
}
