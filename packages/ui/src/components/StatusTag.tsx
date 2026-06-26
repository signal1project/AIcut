import React from 'react';
import { PubStatus, EngagementStatus } from '@mas/types';

const STATUS_CLASSES: Record<string, string> = {
  [PubStatus.DRAFT]:        'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  [PubStatus.QUEUED]:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  [PubStatus.PUBLISHING]:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  [PubStatus.PUBLISHED]:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  [PubStatus.FAILED]:       'bg-red-500/15 text-red-400 border-red-500/30',
  [PubStatus.PART_SUCCESS]: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  [EngagementStatus.PENDING]:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  [EngagementStatus.APPROVED]:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  [EngagementStatus.DISMISSED]: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

export interface StatusTagProps {
  status: PubStatus | EngagementStatus | string;
}

/** Maps a publish/engagement status to a colored badge. */
export function StatusTag({ status }: StatusTagProps): React.ReactElement {
  const classes =
    STATUS_CLASSES[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}
