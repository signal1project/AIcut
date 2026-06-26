import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Film, Music, Type, Sparkles, Wand2, Link2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
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
  const { isPlaying, playhead, duration, setPlayhead, setIsPlaying } = useEditorStore();
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [section, setSection] = useState<PanelSection>('media');
  const [showAccounts, setShowAccounts] = useState(false);

  // Playback engine
  const tick = useCallback((now: number) => {
    if (lastTimeRef.current == null) lastTimeRef.current = now;
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    const next = playhead + delta;
    if (duration > 0 && next >= duration) {
      setPlayhead(duration);
      setIsPlaying(false);
      return;
    }
    setPlayhead(next);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [playhead, duration, setPlayhead, setIsPlaying]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, tick]);

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
                <span className="text-[9px] font-medium tracking-tight">{label}</span>
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
            <span className="text-[9px] font-medium tracking-tight">Accounts</span>
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

      {showAccounts && <ConnectAccounts onClose={() => setShowAccounts(false)} />}
    </div>
  );
};

export default EditorPage;
