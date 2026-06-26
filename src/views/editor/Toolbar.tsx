import React, { useState } from 'react';
import {
  Play, Pause, Square, Scissors, Trash2, Undo2, Redo2,
  Download, Wand2, ZoomIn, ZoomOut, Type, Loader2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { ipc } from '@/lib/ipc';

const RESOLUTIONS = ['1080p', '4k', '720p'] as const;

const Toolbar: React.FC = () => {
  const {
    isPlaying, playhead, duration, setIsPlaying, setPlayhead,
    selectedClipId, removeClip, splitClip, zoom, setZoom,
    exportProgress, setExportProgress, tracks,
  } = useEditorStore();

  const [autoEditPrompt, setAutoEditPrompt] = useState('');
  const [showAutoEdit, setShowAutoEdit] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [resolution, setResolution] = useState<'1080p' | '4k' | '720p'>('1080p');
  const [autoEditing, setAutoEditing] = useState(false);

  const togglePlay = () => {
    if (duration === 0) return;
    if (playhead >= duration) setPlayhead(0);
    setIsPlaying(!isPlaying);
  };

  const stop = () => {
    setIsPlaying(false);
    setPlayhead(0);
  };

  const handleSplit = () => {
    if (!selectedClipId) return;
    splitClip(selectedClipId, playhead);
  };

  const handleDelete = () => {
    if (!selectedClipId) return;
    removeClip(selectedClipId);
  };

  const addCaption = () => {
    const { addTrack, addClipToTrack, tracks: t } = useEditorStore.getState();
    const captionTrack = t.find((tr) => tr.type === 'caption') ?? { id: addTrack('caption') };
    addClipToTrack(captionTrack.id, {
      src: '', name: 'Caption', duration: 3, startTime: playhead,
      trimStart: 0, trimEnd: 0, type: 'caption', captionText: 'Caption text',
    });
  };

  const handleExport = async () => {
    const allClips = tracks.flatMap((t) =>
      t.clips.map((c) => ({
        id: c.id, src: c.src, startTime: c.startTime, trimStart: c.trimStart,
        trimEnd: c.trimEnd, duration: c.duration, type: c.type,
        captionText: c.captionText, volume: c.volume,
      })),
    );
    if (allClips.length === 0) return;
    setExportProgress(0);
    const result = (await ipc.invoke('aicuts:export', allClips, {
      resolution, format: 'mp4', fps: 30,
    })) as { success?: boolean; outputPath?: string; error?: string } | undefined;
    setExportProgress(null);
    setShowExport(false);
    if (result?.success) {
      alert(`Exported to: ${result.outputPath}`);
    } else if (result?.error) {
      alert(`Export failed: ${result.error}`);
    }
  };

  const handleAutoEdit = async () => {
    if (!autoEditPrompt.trim()) return;
    setAutoEditing(true);
    const allClips = tracks.flatMap((t) =>
      t.clips.map((c) => ({ id: c.id, name: c.name, duration: c.duration, src: c.src })),
    );
    const result = (await ipc.invoke('aicuts:auto-edit', {
      clips: allClips,
      prompt: autoEditPrompt,
    })) as {
      decisions?: { clipId: string; trimStart: number; trimEnd: number; startTime: number }[];
      summary?: string;
      error?: string;
    } | undefined;
    setAutoEditing(false);
    if (result?.decisions) {
      const { updateClip } = useEditorStore.getState();
      for (const d of result.decisions) {
        updateClip(d.clipId, { trimStart: d.trimStart, trimEnd: d.trimEnd, startTime: d.startTime });
      }
      alert(`Auto-edit complete: ${result.summary}`);
    } else if (result?.error) {
      alert(`Auto-edit failed: ${result.error}`);
    }
    setShowAutoEdit(false);
    setAutoEditPrompt('');
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex items-center gap-1.5 px-3 h-12 bg-[#131316] border-b border-[#202027] shrink-0">
      {/* Transport */}
      <button onClick={stop} className="tb-btn" title="Stop">
        <Square size={14} />
      </button>
      <button
        onClick={togglePlay}
        className="flex items-center justify-center w-9 h-8 rounded-md bg-[#26262d] hover:bg-[#303039] text-ink-strong transition-colors"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>

      {/* Timecode */}
      <div className="font-mono text-xs text-[#9a9aa6] bg-[#0c0c0f] px-2.5 py-1.5 rounded-md min-w-[112px] text-center select-none tabular-nums border border-[#202027]">
        <span className="text-ink-strong">{fmt(playhead)}</span>
        <span className="text-[#4a4a55]"> / {fmt(duration)}</span>
      </div>

      <div className="tb-sep" />

      {/* Edit ops */}
      <button onClick={handleSplit} disabled={!selectedClipId} className="tb-btn" title="Split at playhead (S)">
        <Scissors size={14} />
      </button>
      <button onClick={handleDelete} disabled={!selectedClipId} className="tb-btn tb-btn--danger" title="Delete selected (Del)">
        <Trash2 size={14} />
      </button>
      <button onClick={addCaption} className="tb-btn" title="Add text">
        <Type size={14} />
      </button>

      <div className="tb-sep" />

      {/* Undo/Redo */}
      <button className="tb-btn" title="Undo (Ctrl+Z)"><Undo2 size={14} /></button>
      <button className="tb-btn" title="Redo (Ctrl+Y)"><Redo2 size={14} /></button>

      <div className="flex-1" />

      {/* Zoom */}
      <button onClick={() => setZoom(zoom - 10)} className="tb-btn" title="Zoom out"><ZoomOut size={14} /></button>
      <span className="text-[10px] text-[#71717f] min-w-[42px] text-center tabular-nums">{zoom} px/s</span>
      <button onClick={() => setZoom(zoom + 10)} className="tb-btn" title="Zoom in"><ZoomIn size={14} /></button>

      <div className="tb-sep" />

      {/* Auto-edit */}
      <div className="relative">
        <button
          onClick={() => setShowAutoEdit((v) => !v)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-[#1d2540] hover:bg-[#243056] text-[#8aa6ff] text-xs font-medium transition-colors"
        >
          <Wand2 size={13} />
          Auto-Edit
        </button>
        {showAutoEdit && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#1d1d22] border border-[#303039] rounded-xl shadow-2xl p-3.5 w-80">
            <p className="text-xs font-medium text-ink-strong mb-2 flex items-center gap-1.5">
              <Wand2 size={13} className="text-[#8aa6ff]" /> Describe your edit
            </p>
            <textarea
              value={autoEditPrompt}
              onChange={(e) => setAutoEditPrompt(e.target.value)}
              placeholder="e.g. Make a 60-second highlight reel with the best moments"
              className="w-full bg-[#0c0c0f] text-xs text-ink-base rounded-lg p-2.5 h-20 resize-none border border-[#303039] focus:outline-none focus:border-[#4d7cff] placeholder:text-[#4a4a55]"
            />
            <button
              onClick={handleAutoEdit}
              disabled={autoEditing || !autoEditPrompt.trim()}
              className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#4d7cff] hover:bg-[#3d6cf0] disabled:opacity-50 text-white text-xs font-medium rounded-lg py-2 transition-colors"
            >
              {autoEditing ? <><Loader2 size={12} className="animate-spin" /> Editing…</> : 'Apply AI Edit'}
            </button>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => setShowExport((v) => !v)}
          className="flex items-center gap-1.5 px-3.5 h-8 rounded-md bg-[#22c55e] hover:bg-[#1faa52] text-[#06210f] text-xs font-semibold transition-colors shadow-sm"
        >
          {exportProgress != null
            ? <><Loader2 size={13} className="animate-spin" />{exportProgress}%</>
            : <><Download size={13} strokeWidth={2.5} />Export</>}
        </button>
        {showExport && exportProgress == null && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#1d1d22] border border-[#303039] rounded-xl shadow-2xl p-3.5 w-52">
            <p className="text-[10px] text-[#71717f] uppercase tracking-wider mb-2">Resolution</p>
            <div className="flex gap-1.5 mb-3">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors ${
                    resolution === r ? 'bg-[#4d7cff] text-white' : 'bg-[#26262d] text-[#9a9aa6] hover:bg-[#303039]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={handleExport} className="w-full bg-[#22c55e] hover:bg-[#1faa52] text-[#06210f] text-xs font-semibold rounded-lg py-2 transition-colors">
              Export MP4
            </button>
          </div>
        )}
      </div>

      <style>{`
        .tb-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 6px; color: #9a9aa6;
          transition: background 0.15s, color 0.15s;
        }
        .tb-btn:hover:not(:disabled) { background: #26262d; color: #f4f4f6; }
        .tb-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .tb-btn--danger:hover:not(:disabled) { background: #3a1a1f; color: #f0556a; }
        .tb-sep { width: 1px; height: 20px; background: #26262d; margin: 0 4px; }
      `}</style>
    </div>
  );
};

export default Toolbar;
