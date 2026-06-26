import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Lightbulb, TrendingUp, ChevronDown } from 'lucide-react';
import { PLATFORMS, type Platform } from '@mas/types';
import { PlatformBadge, type GeneratedContent } from '@mas/ui';
import { useMasApi } from './useMasApi';
import { useAlgorithmHints } from './useAlgorithmHints';
import {
  Button,
  Badge,
  Card, CardHeader, CardTitle, CardContent,
  Collapsible, CollapsibleTrigger, CollapsibleContent,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';

interface FormValues {
  brief: string;
  platforms: Platform[];
  tone?: string;
}

/** Generate platform-tailored copy from a single brief via the active AI provider. */
export default function ContentPage(): React.ReactElement {
  const api = useMasApi();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['facebook', 'instagram']);
  const [openHint, setOpenHint] = useState<Platform | null>(null);

  const { hints, loading: hintsLoading } = useAlgorithmHints(api, selectedPlatforms);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { platforms: selectedPlatforms },
  });

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      setValue('platforms', next);
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.generateContent(values);
      setItems(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-ink-strong">Generate Content</h2>

      {/* Brief form */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brief">Brief</Label>
              <Textarea
                id="brief"
                rows={3}
                placeholder="Describe what to post about"
                {...register('brief', { required: 'Required' })}
              />
              {errors.brief && <p className="text-xs text-error">{errors.brief.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors',
                      selectedPlatforms.includes(p)
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'border-border text-ink-muted hover:border-accent/30 hover:text-ink-base',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {/* hidden field to satisfy react-hook-form */}
              <Controller name="platforms" control={control} render={() => <></>} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input id="tone" placeholder="excited, professional, witty…" {...register('tone')} />
            </div>

            <Button type="submit" loading={loading} disabled={!api}>
              Generate
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Algorithm hints */}
      {selectedPlatforms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb size={15} className="text-accent" />
              Algorithm Insights
              {hintsLoading && (
                <span className="ml-auto text-xs text-ink-muted animate-pulse">Loading…</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {hints.length === 0 && !hintsLoading && (
              <p className="text-sm text-ink-muted">Select a platform to see algorithm tips</p>
            )}
            {hints.map((hint) => (
              <Collapsible
                key={hint.platform}
                open={openHint === hint.platform}
                onOpenChange={(open) => setOpenHint(open ? hint.platform : null)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 hover:bg-surface-2 transition-colors group">
                  <PlatformBadge platform={hint.platform} />
                  <ChevronDown
                    size={14}
                    className={cn(
                      'text-ink-muted transition-transform',
                      openHint === hint.platform && 'rotate-180',
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3 space-y-2 text-sm">
                  <p className="text-ink-muted text-xs">{hint.summary}</p>

                  <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-accent shrink-0" />
                    <span className="text-ink-muted text-xs">Top format:</span>
                    <span className="text-ink-base text-xs">{hint.topFormat}</span>
                  </div>

                  <div>
                    <p className="text-xs text-ink-muted mb-1">Reward signals:</p>
                    <div className="flex flex-wrap gap-1">
                      {hint.topRewardSignals.map((s, i) => (
                        <Badge key={i} variant={i === 0 ? 'default' : 'secondary'} className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-ink-muted">
                    <span className="font-medium text-ink-base">Hook: </span>
                    <span className="italic">{hint.hookAdvice}</span>
                  </p>

                  <p className="text-xs text-ink-muted">
                    <span className="font-medium text-ink-base">Hashtags: </span>
                    {hint.hashtagStrategy}
                  </p>

                  {hint.bonusTips.length > 0 && (
                    <ul className="bg-info/10 border border-info/20 rounded-md px-3 py-2 space-y-0.5">
                      {hint.bonusTips.map((tip, i) => (
                        <li key={i} className="text-xs text-ink-muted list-disc list-inside">{tip}</li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Generated content */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <PlatformBadge platform={item.platform} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-ink-base whitespace-pre-wrap">{item.body}</p>
                {item.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.hashtags.map((tag) => (
                      <Badge key={tag} variant="info" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length === 0 && !loading && (
        <p className="text-center text-ink-muted py-8 text-sm">
          No generated content yet — fill in the brief and click Generate
        </p>
      )}
    </div>
  );
}
