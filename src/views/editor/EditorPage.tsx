import React, { useEffect, useRef, useState } from 'react';
import { Film, Music, Type, Sparkles, Wand2, Link2 } from 'lucide-react';
import { useEditorStore, findClipAt } from '@/store/editorStore';
import { useAutosave, saveCurrentProject } from '@/lib/projectPersistence';
import Toolbar from './Toolbar';
import MediaPanel, { type PanelSection } from './MediaPanel';
import PreviewPlayer from './PreviewPlayer';
import PropertiesPanel from './PropertiesPanel';
import Timeline from './Timeline';
import ConnectAccounts from '../onboarding/ConnectAccounts';

const TOOLS: { id: PanelSection; label: string; icon: React.ElementType }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'ai', label: 'AI', icon: Wand2 },
];

const EditorPage: React.FC = () => {
  // Subscribe to isPlaying ONLY — the playhead updates ~60x/sec during
  // playback, and a full-store subscription here would re-render the entire
  // editor tree every frame (the main cause of choppy playback).
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [section, setSection] = useState<PanelSection>('media');
  const [showAccounts, setShowAccounts] = useState(false);

  // Autosave project as it changes; Ctrl+S forces an immediate save.
  useAutosave();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      // Don't hijack undo/redo while typing in inputs.
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (key === 's') {
        e.preventDefault();
        void saveCurrentProject();
      } else if (!typing && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
      } else if (!typing && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Playback engine — advances the playhead only when NO video clip is under
  // it (gaps, caption/audio-only regions). While a video clip is active, the
  // <video> element in PreviewPlayer is the clock master and drives the
  // playhead from its own currentTime; ticking here too would fight it and
  // cause stutter. Reads state via getState() so this component never
  // re-renders per frame.
  useEffect(() => {
    if (!isPlaying) return;
    lastTimeRef.current = null;
    const tick = (now: number) => {
      const s = useEditorStore.getState();
      if (!s.isPlaying) return;
      if (lastTimeRef.current == null) lastTimeRef.current = now;
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (!findClipAt(s.tracks, 'video', s.playhead)) {
        const next = s.playhead + delta;
        if (s.duration > 0 && next >= s.duration) {
          s.setPlayhead(s.duration);
          s.setIsPlaying(false);
          return;
        }
        s.setPlayhead(next);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
    };
  }, [isPlaying]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0c0f]">
      {/* Toolbar */}
      <Toolbar />

      {/* Main work area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Far-left tool rail */}
        <nav className="w-16 shrink-0 flex flex-col items-center gap-1 py-3 bg-[#101013] border-r border-[#202027]">
          {TOOLS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`group flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-lg transition-colors ${
                  active
                    ? 'bg-[#1d2540] text-[#7ba0ff]'
                    : 'text-[#71717f] hover:bg-[#1a1a1f] hover:text-[#c8c8d2]'
                }`}
                title={label}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[9px] font-medium tracking-tight">
                  {label}
                </span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setShowAccounts(true)}
            className="flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-lg text-[#71717f] hover:bg-[#1a1a1f] hover:text-[#7ba0ff] transition-colors"
            title="Connect social accounts"
          >
            <Link2 size={18} strokeWidth={1.8} />
            <span className="text-[9px] font-medium tracking-tight">
              Accounts
            </span>
          </button>
        </nav>

        {/* Left: contextual library panel */}
        <div className="w-64 shrink-0 border-r border-[#202027] overflow-hidden flex flex-col bg-[#131316]">
          <MediaPanel section={section} />
        </div>

        {/* Center: Preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0f] min-w-0">
          <PreviewPlayer />
        </div>

        {/* Right: Properties */}
        <div className="w-72 shrink-0 border-l border-[#202027] overflow-hidden flex flex-col bg-[#131316]">
          <PropertiesPanel />
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="h-72 shrink-0 border-t border-[#202027] overflow-hidden">
        <Timeline />
      </div>

      {showAccounts && (
        <ConnectAccounts onClose={() => setShowAccounts(false)} />
      )}
    </div>
  );
};

export default EditorPage;
