import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Send, RefreshCw, Trash2 } from 'lucide-react';
import { PubType, PLATFORMS, type Platform } from '@mas/types';
import { PlatformBadge } from '@mas/ui';
import { useMasApi } from './useMasApi';
import { ipc, hasIpc } from '@/lib/ipc';
import {
  Button,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input,
  Label,
  Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge,
} from '@/components/ui';
import { toast } from 'sonner';

interface ConnectedAccount {
  id: string;
  platform: Platform;
  accountName: string;
  externalId: string;
}

/** Scheduler: pick accounts, write caption, set date/time, queue the post. */
export default function SchedulerPage(): React.ReactElement {
  const api = useMasApi();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [pubType, setPubType] = useState<PubType>(PubType.IMAGE_TEXT);
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAccounts = async () => {
    if (!hasIpc()) return;
    setLoadingAccounts(true);
    try {
      const list = await ipc.invoke('mas:accounts:list') as ConnectedAccount[];
      setAccounts(list);
    } catch {
      toast.error('Could not load connected accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => { void loadAccounts(); }, []);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (!api) { toast.error('API not ready'); return; }
    if (selectedAccountIds.length === 0) { toast.error('Select at least one account'); return; }
    if (!scheduledAt) { toast.error('Set a date and time'); return; }
    const runAt = new Date(scheduledAt);
    if (runAt <= new Date()) { toast.error('Scheduled time must be in the future'); return; }
    setSubmitting(true);
    try {
      const result = await api.publish({
        accountIds: selectedAccountIds,
        pubType,
        body,
        hashtags: hashtags.split(/\s+/).filter(Boolean),
        mediaRefs: imageUrl.trim() ? [imageUrl.trim()] : [],
        runAt: runAt.toISOString(),
      });
      if ('scheduled' in result && result.scheduled) {
        toast.success(`Scheduled for ${runAt.toLocaleString()}`);
        setBody('');
        setHashtags('');
        setImageUrl('');
        setScheduledAt('');
        setSelectedAccountIds([]);
      } else {
        toast.success('Published immediately (time was too soon)');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Schedule failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Default to 24 hours from now for the datetime picker
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-strong">
          <Calendar size={18} className="text-accent" />
          Schedule a Post
        </h2>
        <p className="text-sm text-ink-muted mt-0.5">
          Compose a post and pick a future date/time — AICut will publish it automatically.
        </p>
      </div>

      {!hasIpc() && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Running in browser — scheduling requires the desktop app.
        </div>
      )}

      {/* Account picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            Publish to
            <button
              onClick={loadAccounts}
              className="text-ink-muted hover:text-ink-base transition-colors"
              title="Refresh accounts"
            >
              <RefreshCw size={13} className={loadingAccounts ? 'animate-spin' : ''} />
            </button>
          </CardTitle>
          <CardDescription>
            {accounts.length === 0
              ? 'No connected accounts — go to Accounts in the editor to connect.'
              : 'Click to toggle accounts for this post.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {accounts.map((acc) => {
            const selected = selectedAccountIds.includes(acc.id);
            return (
              <button
                key={acc.id}
                onClick={() => toggleAccount(acc.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'border-border text-ink-muted hover:border-accent/30'
                }`}
              >
                <PlatformBadge platform={acc.platform} />
                <span>{acc.accountName}</span>
                {selected && <span className="text-accent">✓</span>}
              </button>
            );
          })}
          {accounts.length === 0 && !loadingAccounts && (
            <p className="text-xs text-ink-subtle">No accounts yet</p>
          )}
        </CardContent>
      </Card>

      {/* Post composer */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Post type</Label>
            <Select value={pubType} onValueChange={(v) => setPubType(v as PubType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PubType.IMAGE_TEXT}>Image + Caption</SelectItem>
                <SelectItem value={PubType.VIDEO}>Video</SelectItem>
                <SelectItem value={PubType.ARTICLE}>Article / Link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(pubType === PubType.IMAGE_TEXT || pubType === PubType.VIDEO) && (
            <div className="space-y-1.5">
              <Label htmlFor="imageUrl">
                {pubType === PubType.VIDEO ? 'Video URL' : 'Image URL'}
                <span className="text-ink-subtle ml-1 font-normal text-xs">(publicly accessible)</span>
              </Label>
              <Input
                id="imageUrl"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="body">Caption / Body</Label>
            <Textarea
              id="body"
              rows={4}
              placeholder="Write your post caption here…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hashtags">Hashtags (space-separated)</Label>
            <Input
              id="hashtags"
              placeholder="#realestate #homebuying"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt" className="flex items-center gap-1.5">
              <Clock size={13} />
              Scheduled date &amp; time
            </Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              min={minDateTime}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <Button
            onClick={submit}
            loading={submitting}
            disabled={!api || selectedAccountIds.length === 0 || !scheduledAt}
            className="w-full"
          >
            <Send size={15} />
            Schedule Post
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
