import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Palette, Save, Globe, ExternalLink } from 'lucide-react';
import { useMasApi } from './useMasApi';
import { ipc, hasIpc } from '@/lib/ipc';
import {
  Button,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input,
  Label,
  Textarea,
} from '@/components/ui';

interface BrandKitForm {
  voice: string;
  audience: string;
  hashtags: string;
  bannedWords: string;
  signature: string;
}

const EMPTY: BrandKitForm = { voice: '', audience: '', hashtags: '', bannedWords: '', signature: '' };

/**
 * Brand page: (1) Brand Kit — persistent voice/audience/hashtag rules injected
 * into every AI generation; (2) Bio Page — exports a static link-in-bio HTML
 * file ready to host anywhere.
 */
export default function BrandPage(): React.ReactElement {
  const api = useMasApi();
  const [kit, setKit] = useState<BrandKitForm>(EMPTY);
  const [savingKit, setSavingKit] = useState(false);

  useEffect(() => {
    if (!hasIpc()) return;
    ipc
      .invoke('mas:settings:get-brand-kit')
      .then((raw) => {
        const k = raw as { voice: string; audience: string; hashtags: string[]; bannedWords: string[]; signature: string } | null;
        if (k) {
          setKit({
            voice: k.voice,
            audience: k.audience,
            hashtags: k.hashtags.join(' '),
            bannedWords: k.bannedWords.join(', '),
            signature: k.signature,
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveKit = async () => {
    if (!hasIpc()) return;
    setSavingKit(true);
    try {
      await ipc.invoke('mas:settings:set-brand-kit', {
        voice: kit.voice.trim(),
        audience: kit.audience.trim(),
        hashtags: kit.hashtags.split(/\s+/).filter(Boolean),
        bannedWords: kit.bannedWords.split(',').map((w) => w.trim()).filter(Boolean),
        signature: kit.signature.trim(),
      });
      toast.success('Brand kit saved — every AI generation now follows it');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKit(false);
    }
  };

  // ── Bio page ────────────────────────────────────────────────────────────────
  const [bioName, setBioName] = useState('');
  const [bioTagline, setBioTagline] = useState('');
  const [bioBrokerage, setBioBrokerage] = useState('');
  const [bioPhone, setBioPhone] = useState('');
  const [bioEmail, setBioEmail] = useState('');
  const [bioLinks, setBioLinks] = useState('');
  const [bioBusy, setBioBusy] = useState(false);
  const [bioResult, setBioResult] = useState<string | null>(null);

  const generateBio = async () => {
    if (!api || !bioName.trim()) return;
    setBioBusy(true);
    try {
      const links = bioLinks
        .split('\n')
        .map((line) => {
          const [label, ...rest] = line.split('|');
          return { label: (label ?? '').trim(), url: rest.join('|').trim() };
        })
        .filter((l) => l.label && l.url);
      const result = await api.generateBioPage({
        name: bioName.trim(),
        tagline: bioTagline.trim() || undefined,
        brokerage: bioBrokerage.trim() || undefined,
        phone: bioPhone.trim() || undefined,
        email: bioEmail.trim() || undefined,
        links,
      });
      setBioResult(result.path);
      toast.success('Bio page generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBioBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-strong">
          <Palette size={18} className="text-accent" />
          Brand
        </h2>
        <p className="text-sm text-ink-muted mt-0.5">
          Your voice, rules, and link-in-bio page — applied across everything AICut generates.
        </p>
      </div>

      {/* Brand kit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Brand Kit</CardTitle>
          <CardDescription>
            These rules are appended to every AI content brief (posts, carousels, listing ads).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="voice">Voice &amp; tone</Label>
            <Input
              id="voice"
              placeholder="confident, warm, zero hype"
              value={kit.voice}
              onChange={(e) => setKit({ ...kit, voice: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audience">Target audience</Label>
            <Input
              id="audience"
              placeholder="first-time homebuyers in Houston"
              value={kit.audience}
              onChange={(e) => setKit({ ...kit, audience: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bhashtags">Preferred hashtags (space-separated)</Label>
            <Input
              id="bhashtags"
              placeholder="#HoustonHomes #YourBrand"
              value={kit.hashtags}
              onChange={(e) => setKit({ ...kit, hashtags: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banned">Banned words (comma-separated)</Label>
            <Input
              id="banned"
              placeholder="cheap, guaranteed, once-in-a-lifetime"
              value={kit.bannedWords}
              onChange={(e) => setKit({ ...kit, bannedWords: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signature">Signature / CTA line</Label>
            <Input
              id="signature"
              placeholder="DM 'HOME' for a free buyer consult"
              value={kit.signature}
              onChange={(e) => setKit({ ...kit, signature: e.target.value })}
            />
          </div>
          <Button onClick={() => void saveKit()} loading={savingKit} disabled={!hasIpc()}>
            <Save size={14} />
            Save Brand Kit
          </Button>
        </CardContent>
      </Card>

      {/* Bio page generator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Globe size={14} className="text-accent" />
            Link-in-Bio Page
          </CardTitle>
          <CardDescription>
            Exports a self-contained HTML file — host it on GitHub Pages, S3, or your site and link
            it from every profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Your name *" value={bioName} onChange={(e) => setBioName(e.target.value)} />
            <Input placeholder="Tagline" value={bioTagline} onChange={(e) => setBioTagline(e.target.value)} />
            <Input placeholder="Brokerage" value={bioBrokerage} onChange={(e) => setBioBrokerage(e.target.value)} />
            <Input placeholder="Phone" value={bioPhone} onChange={(e) => setBioPhone(e.target.value)} />
            <Input placeholder="Email" value={bioEmail} onChange={(e) => setBioEmail(e.target.value)} className="col-span-2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biolinks">Links — one per line as: Label | https://url</Label>
            <Textarea
              id="biolinks"
              rows={4}
              placeholder={'Search Homes | https://example.com/search\nFree Home Valuation | https://example.com/value'}
              value={bioLinks}
              onChange={(e) => setBioLinks(e.target.value)}
            />
          </div>
          <Button onClick={() => void generateBio()} loading={bioBusy} disabled={!api || !bioName.trim()}>
            <ExternalLink size={14} />
            Generate Bio Page
          </Button>
          {bioResult && (
            <p className="text-xs text-success">
              Generated: <span className="text-ink-muted break-all select-all">{bioResult}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
