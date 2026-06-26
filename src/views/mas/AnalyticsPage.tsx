import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { MetricCard, PlatformBadge, type AnalyticsSnapshot } from '@mas/ui';
import { useMasApi } from './useMasApi';
import {
  Button,
  Card, CardHeader, CardTitle, CardContent,
  Input,
  Label,
} from '@/components/ui';

interface FormValues { accountId: string }

/** View captured metric snapshots for an account's posts. */
export default function AnalyticsPage(): React.ReactElement {
  const api = useMasApi();
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const { register, handleSubmit } = useForm<FormValues>();

  const load = async (values: FormValues) => {
    if (!api) return;
    setLoading(true);
    try {
      const { snapshots: rows } = await api.getAnalyticsByAccount(values.accountId);
      setSnapshots(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const totals = snapshots.reduce(
    (acc, s) => ({
      reach: acc.reach + s.reach,
      impressions: acc.impressions + s.impressions,
      engagements: acc.engagements + s.engagements,
      clicks: acc.clicks + s.clicks,
    }),
    { reach: 0, impressions: 0, engagements: 0, clicks: 0 },
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(load)} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="accountId" className="sr-only">Account ID</Label>
              <Input
                id="accountId"
                placeholder="Account ID"
                {...register('accountId', { required: true })}
              />
            </div>
            <Button type="submit" loading={loading} disabled={!api}>
              Load
            </Button>
          </form>
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <>
          {/* Metric totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard title="Reach" value={totals.reach} />
            <MetricCard title="Impressions" value={totals.impressions} />
            <MetricCard title="Engagements" value={totals.engagements} />
            <MetricCard title="Clicks" value={totals.clicks} />
          </div>

          {/* Data table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Platform', 'Post', 'Reach', 'Impressions', 'Engagements', 'Clicks', 'Captured'].map(
                        (h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-ink-muted">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3">
                          <PlatformBadge platform={s.platform} />
                        </td>
                        <td className="px-4 py-3 text-ink-muted truncate max-w-[180px]">{s.externalPostId}</td>
                        <td className="px-4 py-3">{s.reach.toLocaleString()}</td>
                        <td className="px-4 py-3">{s.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3">{s.engagements.toLocaleString()}</td>
                        <td className="px-4 py-3">{s.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs">
                          {new Date(s.capturedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {snapshots.length === 0 && !loading && (
        <p className="text-center text-ink-muted py-12 text-sm">
          Enter an account ID above and click Load
        </p>
      )}
    </div>
  );
}
