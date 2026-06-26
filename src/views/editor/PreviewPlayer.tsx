import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

const PreviewPlayer: React.FC = () => {
  const { tracks, playhead, duration, isPlaying, setPlayhead, setIsPlaying } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  // Find the video clip that should be playing at the current playhead
  const activeClip = (() => {
    for (const track of tracks) {
      if (track.type !== 'video') continue;
      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd);
        if (playhead >= clipStart && playhead < clipEnd) return clip;
      }
    }
    return null;
  })();

  // Active caption at playhead
  const activeCaption = (() => {
    for (const track of tracks) {
      if (track.type !== 'caption') continue;
      for (const clip of track.clips) {
        const end = clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd);
        if (playhead >= clip.startTime && playhead < end) return clip.captionText;
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!activeClip) {
      setCurrentSrc(null);
      return;
    }
    const newSrc = `file://${activeClip.src}`;
    if (newSrc !== currentSrc) setCurrentSrc(newSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip || !currentSrc) return;
    const clipTime = activeClip.trimStart + (playhead - activeClip.startTime);
    if (Math.abs(video.currentTime - clipTime) > 0.15) {
      video.currentTime = clipTime;
    }
  }, [playhead, activeClip, currentSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, currentSrc]);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setPlayhead(ratio * duration);
  }, [duration, setPlayhead]);

  const pct = duration > 0 ? (playhead / duration) * 100 : 0;

  return (
    <div className="flex flex-col items-center w-full h-full px-6 pt-5 pb-4 gap-3">
      {/* Video stage */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
        <div className="relative max-w-full max-h-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-[#202027] flex items-center justify-center"
             style={{ width: '100%' }}>
          {currentSrc ? (
            <video
              ref={videoRef}
              src={currentSrc}
              muted={muted}
              className="max-w-full max-h-full w-full h-full object-contain"
              preload="auto"
              onEnded={() => setIsPlaying(false)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#3f3f4a]">
              <div className="w-16 h-16 rounded-2xl border-2 border-[#2a2a33] flex items-center justify-center">
                <Play size={26} strokeWidth={1.4} className="translate-x-0.5" />
              </div>
              <p className="text-xs text-[#5a5a66]">Import media and add it to the timeline</p>
            </div>
          )}

          {/* Caption overlay */}
          {activeCaption && (
            <div className="absolute inset-x-0 bottom-6 flex justify-center px-6 pointer-events-none">
              <span className="text-white text-lg font-semibold text-center px-3 py-1 rounded"
                    style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>
                {activeCaption}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transport + scrubber */}
      <div className="w-full max-w-3xl flex flex-col gap-2">
        <div
          className="group w-full h-1.5 bg-[#26262d] rounded-full cursor-pointer relative"
          onClick={handleScrub}
        >
          <div className="h-full bg-[#4d7cff] rounded-full relative" style={{ width: `${pct}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={duration === 0}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#26262d] hover:bg-[#303039] text-ink-strong disabled:opacity-30 transition-colors"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} className="translate-x-0.5" />}
            </button>
            <button
              onClick={() => setMuted((m) => !m)}
              className="flex items-center justify-center w-7 h-7 rounded text-[#71717f] hover:text-ink-base transition-colors"
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
          <span className="text-[11px] font-mono text-[#71717f] tabular-nums">
            {fmt(playhead)} <span className="text-[#3f3f4a]">/ {fmt(duration)}</span>
          </span>
          <button className="flex items-center justify-center w-7 h-7 rounded text-[#71717f] hover:text-ink-base transition-colors" title="Fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
}

export default PreviewPlayer;
