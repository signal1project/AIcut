import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { SlidersHorizontal, Film, Music, Type as TypeIcon } from 'lucide-react';

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  video: { icon: Film, label: 'Video clip', color: '#4d7cff' },
  audio: { icon: Music, label: 'Audio clip', color: '#22c55e' },
  caption: { icon: TypeIcon, label: 'Text', color: '#e0a93a' },
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-[10px] text-[#71717f] uppercase tracking-wider font-medium">{label}</label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const inputCls =
  'w-full bg-[#0c0c0f] text-xs text-ink-strong rounded-lg px-2.5 py-2 border border-[#26262d] focus:outline-none focus:border-[#4d7cff] transition-colors';

const PropertiesPanel: React.FC = () => {
  const { selectedClipId, tracks, updateClip, trimClip } = useEditorStore();

  const selectedClip = (() => {
    for (const track of tracks) {
      const c = track.clips.find((cl) => cl.id === selectedClipId);
      if (c) return c;
    }
    return null;
  })();

  if (!selectedClip) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 h-11 border-b border-[#202027] shrink-0">
          <span className="text-[13px] font-semibold text-ink-strong tracking-tight">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#4a4a55]">
            <SlidersHorizontal size={22} strokeWidth={1.4} className="mx-auto mb-2.5" />
            <p className="text-xs text-[#5a5a66]">Select a clip to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[selectedClip.type] ?? TYPE_META.video;
  const Icon = meta.icon;
  const effectiveDuration = selectedClip.duration - selectedClip.trimStart - selectedClip.trimEnd;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-3 h-11 border-b border-[#202027] shrink-0">
        <span className="text-[13px] font-semibold text-ink-strong tracking-tight">Properties</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Clip identity banner */}
        <div className="flex items-center gap-2.5 px-3 py-3 border-b border-[#202027]">
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: `${meta.color}22`, color: meta.color }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-strong truncate">{selectedClip.name}</p>
            <p className="text-[10px] text-[#71717f]">{meta.label} · {effectiveDuration.toFixed(1)}s</p>
          </div>
        </div>

        <div className="p-3 space-y-4">
          <Field label="Name">
            <input
              value={selectedClip.name}
              onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="Start time">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={Number(selectedClip.startTime.toFixed(2))}
                step={0.1}
                min={0}
                onChange={(e) => updateClip(selectedClip.id, { startTime: Number(e.target.value) })}
                className={inputCls}
              />
              <span className="text-[10px] text-[#71717f]">sec</span>
            </div>
          </Field>

          <Field label="Trim">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#71717f] w-7">In</span>
                <input
                  type="range"
                  min={0}
                  max={selectedClip.duration - selectedClip.trimEnd - 0.1}
                  step={0.1}
                  value={selectedClip.trimStart}
                  onChange={(e) => trimClip(selectedClip.id, Number(e.target.value), selectedClip.trimEnd)}
                  className="flex-1 accent-[#4d7cff]"
                />
                <span className="text-[10px] text-ink-base w-10 text-right tabular-nums">{selectedClip.trimStart.toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#71717f] w-7">Out</span>
                <input
                  type="range"
                  min={0}
                  max={selectedClip.duration - selectedClip.trimStart - 0.1}
                  step={0.1}
                  value={selectedClip.trimEnd}
                  onChange={(e) => trimClip(selectedClip.id, selectedClip.trimStart, Number(e.target.value))}
                  className="flex-1 accent-[#4d7cff]"
                />
                <span className="text-[10px] text-ink-base w-10 text-right tabular-nums">{selectedClip.trimEnd.toFixed(1)}s</span>
              </div>
            </div>
          </Field>

          {selectedClip.type !== 'caption' && (
            <Field label="Volume">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedClip.volume ?? 1}
                  onChange={(e) => updateClip(selectedClip.id, { volume: Number(e.target.value) })}
                  className="flex-1 accent-[#4d7cff]"
                />
                <span className="text-[10px] text-ink-base w-9 text-right tabular-nums">{Math.round((selectedClip.volume ?? 1) * 100)}%</span>
              </div>
            </Field>
          )}

          {selectedClip.type === 'caption' && (
            <Field label="Caption text">
              <textarea
                value={selectedClip.captionText ?? ''}
                onChange={(e) => updateClip(selectedClip.id, { captionText: e.target.value })}
                className={`${inputCls} h-20 resize-none`}
              />
            </Field>
          )}

          {selectedClip.type !== 'caption' && (
            <Field label="Speed">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.25}
                    value={selectedClip.speed ?? 1}
                    onChange={(e) => updateClip(selectedClip.id, { speed: Number(e.target.value) })}
                    className="flex-1 accent-[#4d7cff]"
                  />
                  <span className="text-[10px] text-ink-base w-9 text-right tabular-nums font-medium">
                    {(selectedClip.speed ?? 1).toFixed(2)}x
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0.25, 0.5, 1, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateClip(selectedClip.id, { speed: s })}
                      className={`flex-1 text-[9px] font-medium rounded py-1 transition-colors ${
                        (selectedClip.speed ?? 1) === s
                          ? 'bg-[#4d7cff] text-white'
                          : 'bg-[#1d1d22] text-[#71717f] hover:bg-[#26262d]'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          )}

          {selectedClip.type !== 'caption' && (
            <Field label="Transitions">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#71717f] w-14 shrink-0">Fade In</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selectedClip.fadeIn ?? 0}
                    onChange={(e) => updateClip(selectedClip.id, { fadeIn: Number(e.target.value) })}
                    className="flex-1 accent-[#4d7cff]"
                  />
                  <span className="text-[10px] text-ink-base w-9 text-right tabular-nums">{(selectedClip.fadeIn ?? 0).toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#71717f] w-14 shrink-0">Fade Out</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selectedClip.fadeOut ?? 0}
                    onChange={(e) => updateClip(selectedClip.id, { fadeOut: Number(e.target.value) })}
                    className="flex-1 accent-[#4d7cff]"
                  />
                  <span className="text-[10px] text-ink-base w-9 text-right tabular-nums">{(selectedClip.fadeOut ?? 0).toFixed(1)}s</span>
                </div>
              </div>
            </Field>
          )}

          {selectedClip.src && (
            <Field label="Source">
              <p className="text-[9px] text-[#4a4a55] break-all leading-relaxed font-mono">{selectedClip.src}</p>
            </Field>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
