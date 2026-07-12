import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore } from '../src/store/editorStore';

function addTestClip(startTime = 0) {
  const s = useEditorStore.getState();
  const track = s.tracks.find((t) => t.type === 'video')!;
  return s.addClipToTrack(track.id, {
    src: 'C:/v/a.mp4',
    name: 'clip',
    duration: 10,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    type: 'video',
  });
}

describe('editorStore undo/redo', () => {
  beforeEach(() => {
    useEditorStore.getState().resetProject();
    vi.useFakeTimers({ now: 1_000_000 });
  });
  afterEach(() => vi.useRealTimers());

  it('undoes and redoes a clip add', () => {
    addTestClip();
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().tracks[0].clips).toHaveLength(1);
  });

  it('undo restores prior clip position after a move', () => {
    const id = addTestClip(0);
    vi.advanceTimersByTime(2000); // separate gesture
    useEditorStore.getState().moveClip(id, 5);
    expect(useEditorStore.getState().tracks[0].clips[0].startTime).toBe(5);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().tracks[0].clips[0].startTime).toBe(0);
  });

  it('coalesces a continuous drag into ONE undo step', () => {
    const id = addTestClip(0);
    vi.advanceTimersByTime(2000);
    // Simulated drag: many moveClip calls in rapid succession
    for (let i = 1; i <= 20; i++) {
      useEditorStore.getState().moveClip(id, i * 0.1);
      vi.advanceTimersByTime(30);
    }
    expect(useEditorStore.getState().tracks[0].clips[0].startTime).toBeCloseTo(2);

    useEditorStore.getState().undo();
    // One undo returns to the pre-drag position, not one mousemove back.
    expect(useEditorStore.getState().tracks[0].clips[0].startTime).toBe(0);
  });

  it('a new action clears the redo stack', () => {
    const id = addTestClip(0);
    vi.advanceTimersByTime(2000);
    useEditorStore.getState().moveClip(id, 5);
    useEditorStore.getState().undo();
    vi.advanceTimersByTime(2000);
    useEditorStore.getState().moveClip(id, 8);
    expect(useEditorStore.getState().future).toHaveLength(0);
    useEditorStore.getState().redo(); // no-op
    expect(useEditorStore.getState().tracks[0].clips[0].startTime).toBe(8);
  });

  it('undo is a no-op on empty history and reset clears it', () => {
    useEditorStore.getState().undo(); // must not throw
    addTestClip();
    useEditorStore.getState().resetProject();
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().future).toHaveLength(0);
  });
});
