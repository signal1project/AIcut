import React from 'react';
import { fmtNum } from '../utils';

export interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
}

/** Compact stat card for analytics dashboards. */
export function MetricCard({ title, value, suffix }: MetricCardProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-sm">
      <p className="text-xs text-ink-muted mb-1">{title}</p>
      <p className="text-2xl font-bold text-ink-strong">
        {fmtNum(value)}
        {suffix && <span className="text-sm font-normal text-ink-muted ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
