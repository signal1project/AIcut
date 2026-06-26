import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Rocket, ChevronRight, Check, Loader2, Cpu, Zap } from 'lucide-react';
import { PLATFORMS, type Platform } from '@mas/types';
import {
  Button,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input,
  Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import './useMasApi'; // global augmentation

const invoke = (channel: string, ...args: unknown[]) =>
  window.ipcRenderer.invoke(channel, ...args);

const STEP_LABELS = ['AI provider', 'Connect account', 'Done'];

interface StepIndicatorProps { current: number; total: number }
function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <li className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border transition-colors',
                i < current
                  ? 'bg-accent border-accent text-bg'
                  : i === current
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-ink-subtle bg-transparent',
              )}
            >
              {i < current ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={cn(
                'text-sm hidden sm:inline',
                i === current ? 'text-ink-base font-medium' : 'text-ink-muted',
              )}
            >
              {STEP_LABELS[i]}
            </span>
          </li>
          {i < total - 1 && <div className="flex-1 h-px bg-border" />}
        </React.Fragment>
      ))}
    </ol>
  );
}

/* ── Step forms ───────────────────────────────────────────────────────────── */

/** Step 0: Pick AI provider — no API key needed (OpenRouter OAuth or local Ollama). */
function Step0({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'openrouter' | 'ollama' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  const connectOpenRouter = async () => {
    setConnecting(true);
    try {
      await invoke('mas:ai:openrouter-oauth');
      toast.success('OpenRouter connected — Claude is ready');
      onDone();
    } catch (e) {
      toast.error(`OpenRouter auth failed: ${(e as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  const connectOllama = async () => {
    setConnecting(true);
    try {
      await invoke('mas:ai:ollama-set-url', ollamaUrl);
      const result = await invoke('mas:ai:ollama-discover', ollamaUrl) as { running: boolean; models: Array<{ name: string }> };
      if (!result.running) {
        toast.error('Ollama not found at that URL — is it running?');
        setConnecting(false);
        return;
      }
      await invoke('mas:settings:set-active-provider', 'ollama');
      toast.success(`Ollama connected — ${result.models.length} model(s) available`);
      onDone();
    } catch (e) {
      toast.error(`Ollama connection failed: ${(e as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        AICut uses AI to generate captions and auto-edit content. Choose how to connect — no API key required.
      </p>

      {/* OpenRouter OAuth */}
      <button
        onClick={() => setMode('openrouter')}
        className={cn(
          'w-full text-left p-4 rounded-lg border transition-colors',
          mode === 'openrouter'
            ? 'border-accent/60 bg-accent/10'
            : 'border-border hover:border-accent/30 bg-surface-2',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d2540] text-[#7ba0ff]">
            <Zap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-strong">OpenRouter (Recommended)</p>
            <p className="text-xs text-ink-muted">OAuth login — access Claude, GPT-4, Llama and more. No API key.</p>
          </div>
        </div>
        {mode === 'openrouter' && (
          <div className="mt-3">
            <Button onClick={connectOpenRouter} loading={connecting} className="w-full">
              Sign in with OpenRouter <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </button>

      {/* Ollama */}
      <button
        onClick={() => setMode('ollama')}
        className={cn(
          'w-full text-left p-4 rounded-lg border transition-colors',
          mode === 'ollama'
            ? 'border-accent/60 bg-accent/10'
            : 'border-border hover:border-accent/30 bg-surface-2',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#141a14] text-[#4ade80]">
            <Cpu size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-strong">Ollama (Local)</p>
            <p className="text-xs text-ink-muted">Run LLMs locally — completely offline. Requires Ollama installed.</p>
          </div>
        </div>
        {mode === 'ollama' && (
          <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <Input
              placeholder="Ollama URL"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="text-xs"
            />
            <Button onClick={connectOllama} loading={connecting} className="w-full">
              Connect Ollama <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </button>

      <button onClick={onDone} className="w-full text-xs text-ink-muted hover:text-ink-base transition-colors py-2">
        Skip for now →
      </button>
    </div>
  );
}

/** Step 1: Connect a social account — uses the full ConnectAccounts modal inline. */
function Step1({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Connect your first social account. Click <strong>Setup guide</strong> next to any platform
        for a step-by-step walkthrough — each one tells you exactly where to go and what permissions
        to request.
      </p>
      <div className="rounded-lg bg-surface-2 border border-border p-4 text-xs text-ink-muted space-y-1.5">
        <p className="font-semibold text-ink-base">What you'll need per platform:</p>
        <p>1. Create a developer app at the platform's developer portal (link in Setup guide)</p>
        <p>2. Add redirect URI <code className="text-accent">http://127.0.0.1:7766/callback</code></p>
        <p>3. Copy your Client ID (and optionally Client Secret)</p>
        <p>4. Paste into AICut → click "Get authorize link" → approve in browser</p>
      </div>
      <p className="text-xs text-ink-muted">
        Open the <strong>Accounts</strong> button in the editor toolbar to connect now, or skip and connect later.
      </p>
      <Button onClick={onDone} className="w-full">
        Continue <ChevronRight size={14} />
      </Button>
    </div>
  );
}

/* ── Wizard root ─────────────────────────────────────────────────────────── */

export default function OnboardingWizard(): React.ReactElement {
  const [step, setStep] = useState(0);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket size={18} className="text-accent" />
            Welcome to AICut Social Hub
          </CardTitle>
          <CardDescription>
            Set up your AI provider and connect your first social account — takes about 5 minutes.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <StepIndicator current={step} total={STEP_LABELS.length} />

          {step === 0 && <Step0 onDone={() => setStep(1)} />}

          {step === 1 && <Step1 onDone={() => setStep(2)} />}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/20 border border-success/30">
                <Check size={24} className="text-success" />
              </div>
              <p className="text-sm text-ink-base text-center font-medium">You're all set!</p>
              <p className="text-sm text-ink-muted text-center">
                Head to <strong>Publish</strong> to post immediately, <strong>Schedule</strong> to queue posts,
                or <strong>Research</strong> to find trending content ideas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
