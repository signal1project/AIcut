import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Plus, Film, Music, Type } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import TimelineRuler from './TimelineRuler';
import TimelineTrack from './TimelineTrack';

const LABEL_WIDTH = 128; // px — must match w-32

/**
 * The playhead moves ~60x/sec during playback. Only THIS component subscribes
 * to it, so the ruler/track/clip tree above doesn't re-render every frame.
 */
const PlayheadIndicator: React.FC<{
  zoom: number;
  scrollLeft: number;
  scrollEl: React.RefObject<HTMLDivElement>;
  isDraggingPlayhead: React.MutableRefObject<boolean>;
}> = ({ zoom, scrollLeft, scrollEl, isDraggingPlayhead }) => {
  const playhead = useEditorStore((s) => s.playhead);

  // Auto-scroll to keep the playhead visible
  useEffect(() => {
    const el = scrollEl.current;
    if (!el || isDraggingPlayhead.current) return;
    const playheadPx = playhead * zoom;
    const visibleStart = scrollLeft;
    const visibleEnd = scrollLeft + el.clientWidth - LABEL_WIDTH;
    if (playheadPx > visibleEnd - 40 || playheadPx < visibleStart) {
      el.scrollLeft = Math.max(
        0,
        playheadPx - (el.clientWidth - LABEL_WIDTH) / 2,
      );
    }
  }, [playhead, zoom, scrollLeft, scrollEl, isDraggingPlayhead]);

  const playheadPx = playhead * zoom - scrollLeft;
  return (
    <div
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: LABEL_WIDTH + playheadPx, width: 1 }}
    >
      <div
        className="absolute -top-0 w-3.5 h-3.5 bg-white rounded-b-sm -translate-x-1/2 shadow"
        style={{ clipPath: 'polygon(0 0,100% 0,50% 100%)' }}
      />
      <div className="absolute top-2 bottom-0 w-px bg-white/90 left-0" />
    </div>
  );
};

const Timeline: React.FC = () => {
  const tracks = useEditorStore((s) => s.tracks);
  const duration = useEditorStore((s) => s.duration);
  const zoom = useEditorStore((s) => s.zoom);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const addTrack = useEditorStore((s) => s.addTrack);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const isDraggingPlayhead = useRef(false);

  const totalWidth = Math.max(duration * zoom + 200, 800);

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      setPlayhead(x / zoom);
      isDraggingPlayhead.current = true;

      const onMove = (me: MouseEvent) => {
        const x2 = me.clientX - rect.left + scrollLeft;
        setPlayhead(x2 / zoom);
      };
      const onUp = () => {
        isDraggingPlayhead.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [zoom, scrollLeft, setPlayhead],
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] select-none overflow-hidden">
      {/* Header row: label header + ruler */}
      <div className="flex shrink-0">
        <div
          className="bg-[#131316] border-b border-r border-[#202027] flex items-center px-3 shrink-0"
          style={{ width: LABEL_WIDTH, height: 28 }}
        >
          <span className="text-[10px] text-[#5a5a66] uppercase tracking-wider font-medium">
            Timeline
          </span>
        </div>
        <div
          className="flex-1 overflow-hidden"
          onMouseDown={handleRulerMouseDown}
          style={{ cursor: 'text' }}
        >
          <TimelineRuler
            duration={Math.max(duration + 10, 30)}
            zoom={zoom}
            scrollLeft={scrollLeft}
          />
        </div>
      </div>

      {/* Scrollable tracks */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
      >
        <PlayheadIndicator
          zoom={zoom}
          scrollLeft={scrollLeft}
          scrollEl={scrollRef}
          isDraggingPlayhead={isDraggingPlayhead}
        />

        <div
          className="flex flex-col"
          style={{ minWidth: LABEL_WIDTH + totalWidth }}
        >
          {tracks.map((track) => (
            <TimelineTrack
              key={track.id}
              track={track}
              zoom={zoom}
              totalWidth={totalWidth}
              labelWidth={LABEL_WIDTH}
            />
          ))}

          {/* Add-track row */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0c0c0f] border-t border-[#1a1a1f]">
            <button
              onClick={() => addTrack('video')}
              className="add-track add-track--video"
            >
              <Plus size={11} strokeWidth={2.5} /> <Film size={11} /> Video
            </button>
            <button
              onClick={() => addTrack('audio')}
              className="add-track add-track--audio"
            >
              <Plus size={11} strokeWidth={2.5} /> <Music size={11} /> Audio
            </button>
            <button
              onClick={() => addTrack('caption')}
              className="add-track add-track--caption"
            >
              <Plus size={11} strokeWidth={2.5} /> <Type size={11} /> Text
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .add-track {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 500; padding: 4px 9px;
          border-radius: 6px; color: #71717f; background: #161619;
          border: 1px solid #202027; transition: all 0.15s;
        }
        .add-track--video:hover  { color: #7ba0ff; border-color: #2d3d6b; background: #161b2b; }
        .add-track--audio:hover  { color: #4ade80; border-color: #1f4030; background: #122019; }
        .add-track--caption:hover{ color: #e0a93a; border-color: #4a3a18; background: #1f1a10; }
      `}</style>
    </div>
  );
};

export default Timeline;
