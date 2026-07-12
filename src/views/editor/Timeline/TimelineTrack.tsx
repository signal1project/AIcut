import React from 'react';
import {
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Trash2,
  Film,
  Music,
  Type,
} from 'lucide-react';
import { useEditorStore, type Track } from '@/store/editorStore';
import TimelineClip from './TimelineClip';

interface Props {
  track: Track;
  zoom: number;
  totalWidth: number;
  labelWidth: number;
}

const TRACK_HEIGHT = 60;

const TYPE_ICON = {
  video: Film,
  audio: Music,
  caption: Type,
  image: Film,
} as const;
const TYPE_DOT = {
  video: '#4d7cff',
  audio: '#22c55e',
  caption: '#e0a93a',
  image: '#a78bfa',
} as const;

const TimelineTrack: React.FC<Props> = ({
  track,
  zoom,
  totalWidth,
  labelWidth,
}) => {
  // Individual action selectors: actions are stable refs, so this component
  // never re-renders from store churn (e.g. 60fps playhead updates).
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const toggleTrackLock = useEditorStore((s) => s.toggleTrackLock);
  const removeTrack = useEditorStore((s) => s.removeTrack);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const Icon = TYPE_ICON[track.type];
  const dot = TYPE_DOT[track.type];

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (track.locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setPlayhead(x / zoom);
  };

  return (
    <div className="flex shrink-0 group/track" style={{ height: TRACK_HEIGHT }}>
      {/* Label column */}
      <div
        className="relative shrink-0 flex items-center gap-2 px-3 bg-[#131316] border-b border-r border-[#202027]"
        style={{ width: labelWidth }}
      >
        <span
          className="flex items-center justify-center w-5 h-5 rounded shrink-0"
          style={{ color: dot }}
        >
          <Icon size={13} />
        </span>
        <span className="text-[11px] text-[#b8b8c2] truncate flex-1 font-medium">
          {track.label}
        </span>
        {/* Controls overlay — appear on hover without consuming label width */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pl-3 pr-0.5 bg-gradient-to-l from-[#131316] via-[#131316] to-transparent opacity-0 group-hover/track:opacity-100 transition-opacity">
          <button
            onClick={() => toggleTrackMute(track.id)}
            className={`p-1 rounded hover:bg-[#26262d] ${track.muted ? 'text-[#f0556a]' : 'text-[#5a5a66] hover:text-[#b8b8c2]'}`}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          <button
            onClick={() => toggleTrackLock(track.id)}
            className={`p-1 rounded hover:bg-[#26262d] ${track.locked ? 'text-[#e0a93a]' : 'text-[#5a5a66] hover:text-[#b8b8c2]'}`}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            {track.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
          <button
            onClick={() => removeTrack(track.id)}
            className="p-1 rounded hover:bg-[#3a1a1f] text-[#5a5a66] hover:text-[#f0556a]"
            title="Remove track"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Clip lane */}
      <div
        className="flex-1 relative border-b border-[#1a1a1f] bg-[#0e0e11] hover:bg-[#101014] cursor-text overflow-hidden transition-colors"
        style={{ minWidth: totalWidth }}
        onClick={handleTrackClick}
      >
        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            zoom={zoom}
            trackLocked={!!track.locked}
          />
        ))}
      </div>
    </div>
  );
};

export default TimelineTrack;
