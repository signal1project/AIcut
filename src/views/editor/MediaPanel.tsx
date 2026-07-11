import React, { useState } from 'react';
import {
  Plus,
  Film,
  Music,
  Loader2,
  Type,
  Sparkles,
  UploadCloud,
  Wand2,
  Captions,
  Mic,
  Eraser,
  Scissors,
} from 'lucide-react';
import { useEditorStore, type MediaItem } from '@/store/editorStore';
import { ipc } from '@/lib/ipc';
import { toMediaUrl } from '@/lib/media';
import { v4 as uuidv4 } from 'uuid';
import { useMasApi } from '@/views/mas/useMasApi';

export type PanelSection = 'media' | 'audio' | 'text' | 'effects' | 'ai';

const SECTION_TITLE: Record<PanelSection, string> = {
  media: 'Media',
  audio: 'Audio',
  text: 'Text',
  effects: 'Effects',
  ai: 'AI Tools',
};

const TEXT_PRESETS = [
  { label: 'Default caption', text: 'Add your text', size: 'text-sm' },
  { label: 'Bold title', text: 'BIG TITLE', size: 'text-base font-extrabold' },
  { label: 'Subtitle', text: 'Subtitle line', size: 'text-xs' },
];

interface Props {
  section: PanelSection;
}

const MediaPanel: React.FC<Props> = ({ section }) => {
  const {
    mediaLibrary,
    addMediaItem,
    addClipToTrack,
    tracks,
    addTrack,
    playhead,
  } = useEditorStore();
  const [importing, setImporting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [captionsBusy, setCaptionsBusy] = useState(false);
  const [autoEditPrompt, setAutoEditPrompt] = useState('');
  const [autoEditBusy, setAutoEditBusy] = useState(false);
  const masApi = useMasApi();
  const [clipSrt, setClipSrt] = useState('');
  const [clipBusy, setClipBusy] = useState(false);
  const [clipStatus, setClipStatus] = useState<string | null>(null);

  const handleAutoClip = async () => {
    const sourceVideo = mediaLibrary.find((m) => m.type === 'video');
    if (!masApi || !sourceVideo) return;
    setClipBusy(true);
    setClipStatus(null);
    try {
      const result = await masApi.autoClip({
        videoPath: sourceVideo.src,
        transcriptSrt: clipSrt.trim() || undefined,
        maxClips: 3,
      });
      for (const clip of result.clips) {
        addMediaItem({
          id: uuidv4(),
          name: clip.hook
            ? `Clip: ${clip.hook.slice(0, 40)}`
            : `Clip ${clip.start}s`,
          src: clip.path,
          duration: clip.durationSeconds,
          type: 'video',
        } as MediaItem);
      }
      setClipStatus(
        `✓ ${result.clips.length} clip${result.clips.length === 1 ? '' : 's'} added to library (picked by ${result.pickedBy})`,
      );
      setClipSrt('');
    } catch (err) {
      setClipStatus(err instanceof Error ? err.message : 'Auto-clip failed');
    } finally {
      setClipBusy(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const items = (await ipc.invoke('aicuts:import-video')) as
      | Omit<MediaItem, 'id'>[]
      | undefined;
    setImporting(false);
    if (!items) return;
    for (const item of items) {
      addMediaItem({ id: uuidv4(), ...item });
    }
  };

  const handleAddToTimeline = (item: MediaItem) => {
    const targetTrack = tracks.find((t) => t.type === item.type) ?? tracks[0];
    if (!targetTrack) return;
    const lastEnd = targetTrack.clips.reduce((max, c) => {
      const end = c.startTime + (c.duration - c.trimStart - c.trimEnd);
      return Math.max(max, end);
    }, 0);
    addClipToTrack(targetTrack.id, {
      src: item.src,
      previewSrc: item.previewSrc,
      name: item.name,
      duration: item.duration,
      startTime: lastEnd,
      trimStart: 0,
      trimEnd: 0,
      type: item.type,
      thumbnail: item.thumbnail,
    });
  };

  const addCaption = (text: string) => {
    const captionTrack = tracks.find((t) => t.type === 'caption') ?? {
      id: addTrack('caption'),
    };
    addClipToTrack(captionTrack.id, {
      src: '',
      name: 'Caption',
      duration: 3,
      startTime: playhead,
      trimStart: 0,
      trimEnd: 0,
      type: 'caption',
      captionText: text,
    });
  };

  const handleGenerateCaptions = async () => {
    if (!transcript.trim()) return;
    setCaptionsBusy(true);
    const allClips = tracks.flatMap((t) =>
      t.clips.map((c) => ({
        id: c.id,
        src: c.src,
        startTime: c.startTime,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        duration: c.duration,
        type: c.type,
      })),
    );
    const result = (await ipc.invoke(
      'aicuts:generate-captions',
      transcript,
      allClips,
    )) as
      | Array<{ startTime: number; endTime: number; text: string }>
      | undefined;
    setCaptionsBusy(false);
    if (!result || result.length === 0) return;
    const captionTrack = tracks.find((t) => t.type === 'caption') ?? {
      id: addTrack('caption'),
    };
    for (const seg of result) {
      addClipToTrack(captionTrack.id, {
        src: '',
        name: 'Caption',
        duration: seg.endTime - seg.startTime,
        startTime: seg.startTime,
        trimStart: 0,
        trimEnd: 0,
        type: 'caption',
        captionText: seg.text,
      });
    }
    setTranscript('');
  };

  const handleAutoEdit = async () => {
    if (!autoEditPrompt.trim()) return;
    setAutoEditBusy(true);
    const allClips = tracks.flatMap((t) =>
      t.clips.map((c) => ({
        id: c.id,
        name: c.name,
        duration: c.duration,
        src: c.src,
      })),
    );
    const result = (await ipc.invoke('aicuts:auto-edit', {
      clips: allClips,
      prompt: autoEditPrompt,
    })) as
      | {
          decisions?: Array<{
            clipId: string;
            trimStart: number;
            trimEnd: number;
            startTime: number;
          }>;
          summary?: string;
          error?: string;
        }
      | undefined;
    setAutoEditBusy(false);
    if (result?.decisions) {
      const { updateClip } = useEditorStore.getState();
      for (const d of result.decisions) {
        updateClip(d.clipId, {
          trimStart: d.trimStart,
          trimEnd: d.trimEnd,
          startTime: d.startTime,
        });
      }
      setAutoEditPrompt('');
    }
  };

  const visibleMedia = mediaLibrary.filter((m) =>
    section === 'audio' ? m.type === 'audio' : m.type !== 'audio',
  );

  const showImport = section === 'media' || section === 'audio';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-[#202027] shrink-0">
        <span className="text-[13px] font-semibold text-ink-strong tracking-tight">
          {SECTION_TITLE[section]}
        </span>
        {showImport && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 text-[11px] font-medium bg-[#4d7cff] hover:bg-[#3d6cf0] text-white rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            {importing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} strokeWidth={2.5} />
            )}
            Import
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {/* Media / Audio grid */}
        {showImport && (
          <>
            {visibleMedia.length === 0 ? (
              <button
                onClick={handleImport}
                className="flex flex-col items-center justify-center gap-3 w-full mt-4 py-10 rounded-xl border border-dashed border-[#2f2f38] text-[#5a5a66] hover:border-[#4d7cff]/50 hover:text-[#8a8a96] transition-colors"
              >
                <UploadCloud size={30} strokeWidth={1.4} />
                <div className="text-center">
                  <p className="text-xs font-medium text-[#b8b8c2]">
                    Import {section === 'audio' ? 'audio' : 'media'}
                  </p>
                  <p className="text-[10px] mt-0.5">Click or drag files here</p>
                </div>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleMedia.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddToTimeline(item)}
                    className="group relative flex flex-col rounded-lg overflow-hidden bg-[#1d1d22] border border-transparent hover:border-[#4d7cff] transition-colors text-left"
                    title={`Add to timeline: ${item.name}`}
                  >
                    <div className="relative aspect-video bg-[#0c0c0f] flex items-center justify-center overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={toMediaUrl(item.thumbnail)}
                          className="w-full h-full object-cover"
                          alt=""
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : item.type === 'audio' ? (
                        <Music size={20} className="text-[#5a5a66]" />
                      ) : (
                        <Film size={20} className="text-[#5a5a66]" />
                      )}
                      <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white/90 bg-black/60 px-1 rounded">
                        {fmt(item.duration)}
                      </span>
                      {item.missing && (
                        <span className="absolute top-1 left-1 text-[9px] font-medium bg-red-600/85 text-white px-1 rounded">
                          file missing
                        </span>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-[#4d7cff]/0 group-hover:bg-[#4d7cff]/15 transition-colors">
                        <Plus
                          size={22}
                          strokeWidth={2.5}
                          className="text-white opacity-0 group-hover:opacity-100 drop-shadow"
                        />
                      </div>
                    </div>
                    <p className="px-1.5 py-1 text-[10px] text-[#b8b8c2] truncate leading-tight">
                      {item.name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Text section */}
        {section === 'text' && (
          <div className="space-y-2">
            <button
              onClick={() => addCaption('Add your text')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#4d7cff] hover:bg-[#3d6cf0] text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Type size={14} /> Add text to timeline
            </button>
            <p className="text-[10px] text-[#5a5a66] uppercase tracking-wider pt-2 px-0.5">
              Styles
            </p>
            {TEXT_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => addCaption(p.text)}
                className="flex items-center w-full h-16 rounded-lg bg-[#1d1d22] hover:bg-[#26262d] border border-[#26262d] hover:border-[#4d7cff]/50 transition-colors px-4"
              >
                <span className={`text-[#f4f4f6] ${p.size}`}>{p.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Effects section */}
        {section === 'effects' && (
          <div className="space-y-3">
            <p className="text-[10px] text-[#5a5a66] uppercase tracking-wider px-0.5">
              Transitions
            </p>
            <p className="text-[10px] text-[#71717f] leading-relaxed">
              Select a clip then use the{' '}
              <span className="text-[#c8c8d2]">Properties</span> panel on the
              right to set Fade In / Fade Out duration for that clip.
            </p>
            <div className="mt-3 p-3 rounded-lg bg-[#1d1d22] border border-[#26262d]">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={13} className="text-[#4d7cff]" />
                <span className="text-[11px] font-medium text-ink-strong">
                  Per-clip fades
                </span>
              </div>
              <p className="text-[10px] text-[#71717f]">
                Fade in / fade out are burned into the export via FFmpeg — no
                quality loss.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#1d1d22] border border-[#26262d] opacity-50">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-ink-strong">
                  Clip transitions
                </span>
                <span className="text-[9px] bg-[#26262d] text-[#71717f] px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
              <p className="text-[10px] text-[#71717f]">
                Cross-dissolve, wipe, slide between clips
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#1d1d22] border border-[#26262d] opacity-50">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-ink-strong">
                  Color grading
                </span>
                <span className="text-[9px] bg-[#26262d] text-[#71717f] px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
              <p className="text-[10px] text-[#71717f]">
                Brightness, contrast, saturation, LUTs
              </p>
            </div>
          </div>
        )}

        {/* AI Tools section */}
        {section === 'ai' && (
          <div className="space-y-4">
            {/* Auto-Captions */}
            <div className="p-3 rounded-xl bg-[#1d1d22] border border-[#26262d]">
              <div className="flex items-center gap-2 mb-2">
                <Captions size={14} className="text-[#4d7cff]" />
                <span className="text-[12px] font-semibold text-ink-strong">
                  Auto-Captions
                </span>
              </div>
              <p className="text-[10px] text-[#71717f] mb-2.5">
                Paste your transcript and Claude will place caption clips on the
                timeline.
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste transcript here…"
                className="w-full bg-[#0c0c0f] text-[10px] text-ink-base rounded-lg p-2 h-20 resize-none border border-[#303039] focus:outline-none focus:border-[#4d7cff] placeholder:text-[#4a4a55]"
              />
              <button
                onClick={handleGenerateCaptions}
                disabled={captionsBusy || !transcript.trim()}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-[#4d7cff] hover:bg-[#3d6cf0] disabled:opacity-50 text-white text-[11px] font-medium rounded-lg py-2 transition-colors"
              >
                {captionsBusy ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate Captions'
                )}
              </button>
            </div>

            {/* Auto-Edit */}
            <div className="p-3 rounded-xl bg-[#1d1d22] border border-[#26262d]">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 size={14} className="text-[#8aa6ff]" />
                <span className="text-[12px] font-semibold text-ink-strong">
                  AI Auto-Edit
                </span>
              </div>
              <p className="text-[10px] text-[#71717f] mb-2.5">
                Describe your edit — Claude Sonnet applies trim decisions across
                all clips.
              </p>
              <textarea
                value={autoEditPrompt}
                onChange={(e) => setAutoEditPrompt(e.target.value)}
                placeholder="e.g. Make a 60-second highlight reel with the best moments"
                className="w-full bg-[#0c0c0f] text-[10px] text-ink-base rounded-lg p-2 h-16 resize-none border border-[#303039] focus:outline-none focus:border-[#4d7cff] placeholder:text-[#4a4a55]"
              />
              <button
                onClick={handleAutoEdit}
                disabled={autoEditBusy || !autoEditPrompt.trim()}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-[#1d2540] hover:bg-[#243056] disabled:opacity-50 text-[#8aa6ff] text-[11px] font-medium rounded-lg py-2 transition-colors"
              >
                {autoEditBusy ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Editing…
                  </>
                ) : (
                  'Apply AI Edit'
                )}
              </button>
            </div>

            {/* Auto-Clip (Opus-Clip-style repurposing) */}
            <div className="p-3 rounded-xl bg-[#1d1d22] border border-[#26262d]">
              <div className="flex items-center gap-2 mb-2">
                <Scissors size={14} className="text-[#34d399]" />
                <span className="text-[12px] font-semibold text-ink-strong">
                  Auto-Clip
                </span>
              </div>
              <p className="text-[10px] text-[#71717f] mb-2.5">
                Finds the best moments in your first library video and cuts
                vertical short clips with burned captions. Paste an SRT/VTT
                transcript, or leave empty to use Whisper (OpenAI key in
                Settings).
              </p>
              <textarea
                value={clipSrt}
                onChange={(e) => setClipSrt(e.target.value)}
                placeholder="Optional: paste SRT/VTT transcript…"
                className="w-full bg-[#0c0c0f] text-[10px] text-ink-base rounded-lg p-2 h-16 resize-none border border-[#303039] focus:outline-none focus:border-[#34d399] placeholder:text-[#4a4a55]"
              />
              <button
                onClick={handleAutoClip}
                disabled={
                  clipBusy ||
                  !masApi ||
                  !mediaLibrary.some((m) => m.type === 'video')
                }
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-[#12352a] hover:bg-[#174534] disabled:opacity-50 text-[#34d399] text-[11px] font-medium rounded-lg py-2 transition-colors"
              >
                {clipBusy ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Clipping…
                  </>
                ) : (
                  'Find & Cut Clips'
                )}
              </button>
              {clipStatus && (
                <p className="text-[10px] text-[#a1a1ab] mt-1.5">
                  {clipStatus}
                </p>
              )}
            </div>

            {/* Remove Background stub */}
            <div className="p-3 rounded-xl bg-[#1d1d22] border border-[#26262d] opacity-60">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Eraser size={14} className="text-[#e0a93a]" />
                  <span className="text-[12px] font-semibold text-ink-strong">
                    Remove Background
                  </span>
                </div>
                <span className="text-[9px] bg-[#26262d] text-[#71717f] px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
              <p className="text-[10px] text-[#71717f]">
                AI-powered background removal for video clips
              </p>
            </div>

            {/* Voice Studio stub */}
            <div className="p-3 rounded-xl bg-[#1d1d22] border border-[#26262d] opacity-60">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Mic size={14} className="text-[#22c55e]" />
                  <span className="text-[12px] font-semibold text-ink-strong">
                    Voice Studio
                  </span>
                </div>
                <span className="text-[9px] bg-[#26262d] text-[#71717f] px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
              <p className="text-[10px] text-[#71717f]">
                Text-to-speech voiceover generation (ElevenLabs)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default MediaPanel;
