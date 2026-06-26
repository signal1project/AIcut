import React, { useRef, useCallback } from 'react';
import { Type } from 'lucide-react';
import { useEditorStore, type Clip } from '@/store/editorStore';

interface Props {
  clip: Clip;
  zoom: number;
  trackLocked: boolean;
}

const TYPE_STYLE: Record<string, { from: string; to: string; bar: string }> = {
  video: { from: '#3f6fef', to: '#5b87ff', bar: 'rgba(255,255,255,0.18)' },
  audio: { from: '#179a57', to: '#27c46e', bar: 'rgba(255,255,255,0.35)' },
  caption: { from: '#b9842c', to: '#e0a93a', bar: 'rgba(255,255,255,0.2)' },
};

// deterministic pseudo-waveform heights for audio clips
const WAVE = Array.from({ length: 48 }, (_, i) =>
  0.35 + 0.6 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)),
);

const TimelineClip: React.FC<Props> = ({ clip, zoom, trackLocked }) => {
  const { selectedClipId, selectClip, moveClip, trimClip, setPlayhead } = useEditorStore();
  const isSelected = selectedClipId === clip.id;
  const dragRef = useRef<{ startX: number; startTime: number } | null>(null);
  const trimRef = useRef<{ startX: number; edge: 'left' | 'right'; origTrimStart: number; origTrimEnd: number } | null>(null);

  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed ?? 1);
  const left = clip.startTime * zoom;
  const width = Math.max(effectiveDuration * zoom, 6);
  const style = TYPE_STYLE[clip.type] ?? TYPE_STYLE.video;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (trackLocked) return;
    e.stopPropagation();
    selectClip(clip.id);
    dragRef.current = { startX: e.clientX, startTime: clip.startTime };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (me.clientX - dragRef.current.startX) / zoom;
      moveClip(clip.id, dragRef.current.startTime + delta);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip, zoom, trackLocked, selectClip, moveClip]);

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, edge: 'left' | 'right') => {
    if (trackLocked) return;
    e.stopPropagation();
    trimRef.current = { startX: e.clientX, edge, origTrimStart: clip.trimStart, origTrimEnd: clip.trimEnd };

    const onMove = (me: MouseEvent) => {
      if (!trimRef.current) return;
      const delta = (me.clientX - trimRef.current.startX) / zoom;
      if (trimRef.current.edge === 'left') {
        const newTrimStart = Math.max(0, Math.min(trimRef.current.origTrimStart + delta, clip.duration - clip.trimEnd - 0.1));
        trimClip(clip.id, newTrimStart, clip.trimEnd);
        moveClip(clip.id, clip.startTime + (newTrimStart - clip.trimStart));
      } else {
        const newTrimEnd = Math.max(0, Math.min(trimRef.current.origTrimEnd - delta, clip.duration - clip.trimStart - 0.1));
        trimClip(clip.id, clip.trimStart, newTrimEnd);
      }
    };
    const onUp = () => {
      trimRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip, zoom, trackLocked, trimClip, moveClip]);

  return (
    <div
      className="absolute top-1.5 bottom-1.5 rounded-md overflow-hidden flex items-center cursor-grab active:cursor-grabbing select-none transition-shadow"
      style={{
        left,
        width,
        background: `linear-gradient(180deg, ${style.from}, ${style.to})`,
        boxShadow: isSelected
          ? '0 0 0 2px #fff, 0 4px 12px rgba(0,0,0,0.45)'
          : '0 1px 3px rgba(0,0,0,0.35)',
        zIndex: isSelected ? 10 : 1,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => setPlayhead(clip.startTime)}
    >
      {/* Video thumbnail fill */}
      {clip.type === 'video' && clip.thumbnail && (
        <img
          src={`file://${clip.thumbnail}`}
          className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
          alt=""
        />
      )}

      {/* Audio waveform */}
      {clip.type === 'audio' && (
        <div className="absolute inset-0 flex items-center gap-px px-1 pointer-events-none opacity-90">
          {WAVE.map((h, i) => (
            <div key={i} className="flex-1 rounded-full" style={{ height: `${h * 70}%`, background: style.bar, minWidth: 1 }} />
          ))}
        </div>
      )}

      {/* Top sheen */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 pointer-events-none" />

      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-black/25 group/handle"
        onMouseDown={(e) => handleTrimMouseDown(e, 'left')}
      >
        <div className="w-0.5 h-5 bg-white/70 rounded-full" />
      </div>

      {/* Label */}
      <span className="relative px-3.5 text-[10px] text-white font-semibold truncate leading-none pointer-events-none flex items-center gap-1.5 drop-shadow-sm">
        {clip.type === 'caption' && <Type size={10} className="shrink-0" />}
        {clip.type === 'caption' ? (clip.captionText ?? clip.name) : clip.name}
        {clip.speed != null && clip.speed !== 1 && (
          <span className="shrink-0 bg-black/40 text-white text-[8px] font-bold px-1 py-0.5 rounded">
            {clip.speed}x
          </span>
        )}
      </span>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-black/25"
        onMouseDown={(e) => handleTrimMouseDown(e, 'right')}
      >
        <div className="w-0.5 h-5 bg-white/70 rounded-full" />
      </div>
    </div>
  );
};

export default TimelineClip;
