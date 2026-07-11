import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';

export type ClipType = 'video' | 'audio' | 'caption';

export interface Clip {
  id: string;
  trackId: string;
  src: string;
  previewSrc?: string; // renderer-playable proxy (HEVC/odd containers); export uses src
  name: string;
  duration: number; // total source duration in seconds
  startTime: number; // position on timeline (seconds from start)
  trimStart: number; // seconds trimmed from clip head
  trimEnd: number; // seconds trimmed from clip tail
  type: ClipType;
  thumbnail?: string; // path to thumbnail image
  captionText?: string; // for caption clips
  volume?: number; // 0-1
  speed?: number; // playback speed multiplier (default 1.0); 2.0 = 2x faster
  fadeIn?: number; // fade-in duration in seconds (default 0)
  fadeOut?: number; // fade-out duration in seconds (default 0)
}

export interface Track {
  id: string;
  type: ClipType;
  label: string;
  clips: Clip[];
  muted?: boolean;
  locked?: boolean;
}

export interface MediaItem {
  id: string;
  src: string;
  previewSrc?: string; // renderer-playable proxy (HEVC/odd containers); export uses src
  name: string;
  duration: number;
  type: 'video' | 'audio';
  thumbnail?: string;
  width?: number;
  height?: number;
  missing?: boolean; // source file not found on disk (project loaded after move/delete)
}

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved';

/** Serializable snapshot persisted by the project system. */
export interface ProjectSnapshot {
  version: 1;
  id: string;
  name: string;
  tracks: Track[];
  mediaLibrary: MediaItem[];
  zoom: number;
}

export interface EditorState {
  projectId: string;
  projectName: string;
  saveState: SaveState;
  lastSavedAt: string | null;
  tracks: Track[];
  playhead: number; // current time in seconds
  duration: number; // total project duration in seconds
  selectedClipId: string | null;
  selectedTrackId: string | null;
  zoom: number; // pixels per second (10-200)
  isPlaying: boolean;
  mediaLibrary: MediaItem[];
  exportProgress: number | null; // 0-100 during export, null otherwise
  captionJobId: string | null;

  // Actions
  setProjectName: (name: string) => void;
  hydrateProject: (snapshot: ProjectSnapshot) => void;
  snapshotProject: () => ProjectSnapshot;
  setSaveState: (state: SaveState, savedAt?: string) => void;
  forkProjectAs: (name: string) => void;
  addMediaItem: (item: MediaItem) => void;
  addClipToTrack: (
    trackId: string,
    clip: Omit<Clip, 'id' | 'trackId'>,
  ) => string;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  splitClip: (clipId: string, atTime: number) => void;
  selectClip: (clipId: string | null) => void;
  setPlayhead: (time: number) => void;
  setZoom: (zoom: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addTrack: (type: ClipType, label?: string) => string;
  removeTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  setExportProgress: (progress: number | null) => void;
  recalcDuration: () => void;
  undo: () => void;
  redo: () => void;
  resetProject: () => void;
}

const DEFAULT_TRACKS: Track[] = [
  { id: 'track-video-1', type: 'video', label: 'Video 1', clips: [] },
  { id: 'track-audio-1', type: 'audio', label: 'Audio 1', clips: [] },
  { id: 'track-caption-1', type: 'caption', label: 'Captions', clips: [] },
];

export function clipEffectiveDuration(clip: Clip): number {
  return (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed ?? 1);
}

/** Clip of the given type under `time` on the timeline (speed-aware). */
export function findClipAt(
  tracks: Track[],
  type: ClipType,
  time: number,
): { clip: Clip; track: Track } | null {
  for (const track of tracks) {
    if (track.type !== type) continue;
    for (const clip of track.clips) {
      const end = clip.startTime + clipEffectiveDuration(clip);
      if (time >= clip.startTime && time < end) return { clip, track };
    }
  }
  return null;
}

function calcDuration(tracks: Track[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clipEffectiveDuration(clip);
      if (end > max) max = end;
    }
  }
  return max;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    projectId: uuidv4(),
    projectName: 'Untitled Project',
    saveState: 'clean',
    lastSavedAt: null,
    tracks: DEFAULT_TRACKS,
    playhead: 0,
    duration: 0,
    selectedClipId: null,
    selectedTrackId: null,
    zoom: 60,
    isPlaying: false,
    mediaLibrary: [],
    exportProgress: null,
    captionJobId: null,

    setProjectName: (name) =>
      set((s) => {
        s.projectName = name;
        s.saveState = 'dirty';
      }),

    hydrateProject: (snapshot) =>
      set((s) => {
        s.projectId = snapshot.id;
        s.projectName = snapshot.name || 'Untitled Project';
        s.tracks = snapshot.tracks?.length
          ? snapshot.tracks
          : DEFAULT_TRACKS.map((t) => ({ ...t, clips: [] }));
        s.mediaLibrary = snapshot.mediaLibrary ?? [];
        s.zoom = snapshot.zoom ?? 60;
        s.playhead = 0;
        s.isPlaying = false;
        s.selectedClipId = null;
        s.selectedTrackId = null;
        s.exportProgress = null;
        s.captionJobId = null;
        s.duration = calcDuration(s.tracks);
        s.saveState = 'saved';
      }),

    snapshotProject: () => {
      const s = get();
      return {
        version: 1 as const,
        id: s.projectId,
        name: s.projectName,
        tracks: s.tracks,
        mediaLibrary: s.mediaLibrary,
        zoom: s.zoom,
      };
    },

    setSaveState: (state, savedAt) =>
      set((s) => {
        s.saveState = state;
        if (savedAt) s.lastSavedAt = savedAt;
      }),

    // "Save As": current editor content becomes a NEW project (new id + name);
    // the previously saved project file is left untouched on disk.
    forkProjectAs: (name) =>
      set((s) => {
        s.projectId = uuidv4();
        s.projectName = name.trim() || 'Untitled Project';
        s.lastSavedAt = null;
        s.saveState = 'dirty';
      }),

    addMediaItem: (item) =>
      set((s) => {
        if (!s.mediaLibrary.find((m) => m.id === item.id)) {
          s.mediaLibrary.push(item);
          s.saveState = 'dirty';
        }
      }),

    addClipToTrack: (trackId, clip) => {
      const id = uuidv4();
      set((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        if (track) {
          track.clips.push({ ...clip, id, trackId });
          s.duration = calcDuration(s.tracks);
          s.saveState = 'dirty';
        }
      });
      return id;
    },

    removeClip: (clipId) =>
      set((s) => {
        for (const track of s.tracks) {
          const idx = track.clips.findIndex((c) => c.id === clipId);
          if (idx !== -1) {
            track.clips.splice(idx, 1);
            break;
          }
        }
        if (s.selectedClipId === clipId) s.selectedClipId = null;
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    updateClip: (clipId, patch) =>
      set((s) => {
        for (const track of s.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            Object.assign(clip, patch);
            break;
          }
        }
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    moveClip: (clipId, newStartTime, newTrackId) =>
      set((s) => {
        let found: Clip | undefined;
        let fromTrack: Track | undefined;
        for (const track of s.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            found = clip;
            fromTrack = track;
            break;
          }
        }
        if (!found || !fromTrack) return;
        found.startTime = Math.max(0, newStartTime);
        if (newTrackId && newTrackId !== fromTrack.id) {
          const toTrack = s.tracks.find((t) => t.id === newTrackId);
          if (toTrack && toTrack.type === fromTrack.type) {
            fromTrack.clips = fromTrack.clips.filter((c) => c.id !== clipId);
            found.trackId = newTrackId;
            toTrack.clips.push(found);
          }
        }
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    trimClip: (clipId, trimStart, trimEnd) =>
      set((s) => {
        for (const track of s.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            clip.trimStart = Math.max(0, trimStart);
            clip.trimEnd = Math.max(0, trimEnd);
            break;
          }
        }
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    splitClip: (clipId, atTime) =>
      set((s) => {
        for (const track of s.tracks) {
          const idx = track.clips.findIndex((c) => c.id === clipId);
          if (idx === -1) continue;
          const clip = track.clips[idx];
          const splitPoint = atTime - clip.startTime + clip.trimStart;
          if (
            splitPoint <= clip.trimStart ||
            splitPoint >= clip.duration - clip.trimEnd
          )
            return;

          const right: Clip = {
            ...clip,
            id: uuidv4(),
            trimStart: splitPoint,
            startTime: atTime,
          };
          clip.trimEnd = clip.duration - splitPoint;
          track.clips.splice(idx + 1, 0, right);
          break;
        }
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    selectClip: (clipId) =>
      set((s) => {
        s.selectedClipId = clipId;
        if (clipId) {
          for (const track of s.tracks) {
            if (track.clips.find((c) => c.id === clipId)) {
              s.selectedTrackId = track.id;
              break;
            }
          }
        }
      }),

    setPlayhead: (time) =>
      set((s) => {
        s.playhead = Math.max(0, Math.min(time, s.duration || 0));
      }),

    setZoom: (zoom) =>
      set((s) => {
        s.zoom = Math.max(10, Math.min(200, zoom));
      }),

    setIsPlaying: (playing) =>
      set((s) => {
        s.isPlaying = playing;
      }),

    addTrack: (type, label) => {
      const id = uuidv4();
      set((s) => {
        const count = s.tracks.filter((t) => t.type === type).length + 1;
        s.tracks.push({
          id,
          type,
          label:
            label ?? `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
          clips: [],
        });
        s.saveState = 'dirty';
      });
      return id;
    },

    removeTrack: (trackId) =>
      set((s) => {
        s.tracks = s.tracks.filter((t) => t.id !== trackId);
        s.duration = calcDuration(s.tracks);
        s.saveState = 'dirty';
      }),

    toggleTrackMute: (trackId) =>
      set((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        if (track) track.muted = !track.muted;
      }),

    toggleTrackLock: (trackId) =>
      set((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        if (track) track.locked = !track.locked;
      }),

    setExportProgress: (progress) =>
      set((s) => {
        s.exportProgress = progress;
      }),

    recalcDuration: () =>
      set((s) => {
        s.duration = calcDuration(s.tracks);
      }),

    undo: () => {},
    redo: () => {},

    resetProject: () =>
      set((s) => {
        s.projectId = uuidv4();
        s.projectName = 'Untitled Project';
        s.saveState = 'clean';
        s.lastSavedAt = null;
        s.tracks = DEFAULT_TRACKS.map((t) => ({ ...t, clips: [] }));
        s.playhead = 0;
        s.duration = 0;
        s.selectedClipId = null;
        s.selectedTrackId = null;
        s.zoom = 60;
        s.isPlaying = false;
        s.mediaLibrary = [];
        s.exportProgress = null;
        s.captionJobId = null;
      }),
  })),
);
