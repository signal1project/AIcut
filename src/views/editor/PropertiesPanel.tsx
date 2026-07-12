import React from 'react';
import { useEditorStore, type Clip } from '@/store/editorStore';
import {
  SlidersHorizontal,
  Film,
  Music,
  Type as TypeIcon,
  Image as ImageIcon,
} from 'lucide-react';

const TYPE_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  video: { icon: Film, label: 'Video clip', color: '#4d7cff' },
  audio: { icon: Music, label: 'Audio clip', color: '#22c55e' },
  caption: { icon: TypeIcon, label: 'Text', color: '#e0a93a' },
  image: { icon: ImageIcon, label: 'Image', color: '#a78bfa' },
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="text-[10px] text-[#71717f] uppercase tracking-wider font-medium">
      {label}
    </label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const Slider: React.FC<{
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display?: string;
  onChange: (v: number) => void;
}> = ({ label, min, max, step, value, display, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-[#71717f] w-14 shrink-0">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-[#4d7cff]"
    />
    <span className="text-[10px] text-ink-base w-10 text-right tabular-nums">
      {display ?? value}
    </span>
  </div>
);

const Chips: React.FC<{
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => (
      <button
        key={o.id}
        onClick={() => onChange(o.id)}
        className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
          value === o.id
            ? 'bg-[#4d7cff] text-white'
            : 'bg-[#26262d] text-[#9a9aa6] hover:bg-[#303039]'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const CAPTION_COLORS = [
  '#ffffff',
  '#ffdd00',
  '#ff5555',
  '#4ade80',
  '#7ba0ff',
  '#000000',
];
const TRANSITIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'wipeleft', label: 'Wipe ←' },
  { id: 'wiperight', label: 'Wipe →' },
  { id: 'slideup', label: 'Slide ↑' },
  { id: 'circleopen', label: 'Circle' },
];
const COLOR_PRESETS = [
  { id: 'none', label: 'None' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'mono', label: 'B&W' },
  { id: 'bright', label: 'Bright' },
];
const MOTIONS = [
  { id: 'none', label: 'None' },
  { id: 'zoom_in', label: 'Zoom in' },
  { id: 'zoom_out', label: 'Zoom out' },
];

const inputCls =
  'w-full bg-[#0c0c0f] text-xs text-ink-strong rounded-lg px-2.5 py-2 border border-[#26262d] focus:outline-none focus:border-[#4d7cff] transition-colors';

const PropertiesPanel: React.FC = () => {
  // Narrow selectors — avoids re-rendering every slider on 60fps playhead ticks.
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const tracks = useEditorStore((s) => s.tracks);
  const updateClip = useEditorStore((s) => s.updateClip);
  const trimClip = useEditorStore((s) => s.trimClip);

  let selectedClip: Clip | null = null;
  let videoTrackIndex = 0;
  {
    let vIdx = 0;
    for (const track of tracks) {
      const idx = track.type === 'video' ? vIdx++ : 0;
      const c = track.clips.find((cl) => cl.id === selectedClipId);
      if (c) {
        selectedClip = c;
        videoTrackIndex = idx;
        break;
      }
    }
  }

  if (!selectedClip) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 h-11 border-b border-[#202027] shrink-0">
          <span className="text-[13px] font-semibold text-ink-strong tracking-tight">
            Properties
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#4a4a55]">
            <SlidersHorizontal
              size={22}
              strokeWidth={1.4}
              className="mx-auto mb-2.5"
            />
            <p className="text-xs text-[#5a5a66]">
              Select a clip to edit its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const clip = selectedClip;
  const meta = TYPE_META[clip.type] ?? TYPE_META.video;
  const Icon = meta.icon;
  const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
  const isVisual = clip.type === 'video' || clip.type === 'image';
  const isOverlay = isVisual && videoTrackIndex > 0;
  const style = clip.captionStyle ?? {};
  const adjust = clip.adjust ?? {};
  const overlay = clip.overlay ?? { x: 0.65, y: 0.05, scale: 0.3, opacity: 1 };
  const chroma = clip.chromaKey ?? {
    enabled: false,
    color: '#00ff00',
    similarity: 0.1,
    blend: 0.1,
  };

  const patchStyle = (p: Partial<typeof style>) =>
    updateClip(clip.id, { captionStyle: { ...style, ...p } });
  const patchAdjust = (p: Partial<typeof adjust>) =>
    updateClip(clip.id, { adjust: { ...adjust, ...p } });
  const patchOverlay = (p: Partial<typeof overlay>) =>
    updateClip(clip.id, { overlay: { ...overlay, ...p } });
  const patchChroma = (p: Partial<typeof chroma>) =>
    updateClip(clip.id, { chromaKey: { ...chroma, ...p } });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-3 h-11 border-b border-[#202027] shrink-0">
        <span className="text-[13px] font-semibold text-ink-strong tracking-tight">
          Properties
        </span>
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
            <p className="text-xs font-medium text-ink-strong truncate">
              {clip.name}
            </p>
            <p className="text-[10px] text-[#71717f]">
              {meta.label}
              {isOverlay ? ' · overlay' : ''} · {effectiveDuration.toFixed(1)}s
            </p>
          </div>
        </div>

        <div className="p-3 space-y-4">
          <Field label="Name">
            <input
              value={clip.name}
              onChange={(e) => updateClip(clip.id, { name: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="Start time">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={Number(clip.startTime.toFixed(2))}
                step={0.1}
                min={0}
                onChange={(e) =>
                  updateClip(clip.id, { startTime: Number(e.target.value) })
                }
                className={inputCls}
              />
              <span className="text-[10px] text-[#71717f]">sec</span>
            </div>
          </Field>

          {/* Image clips: on-screen duration instead of trim */}
          {clip.type === 'image' ? (
            <Field label="Duration">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={Number(clip.duration.toFixed(1))}
                  step={0.5}
                  min={0.5}
                  onChange={(e) =>
                    updateClip(clip.id, {
                      duration: Math.max(0.5, Number(e.target.value)),
                    })
                  }
                  className={inputCls}
                />
                <span className="text-[10px] text-[#71717f]">sec</span>
              </div>
            </Field>
          ) : (
            <Field label="Trim">
              <div className="space-y-2.5">
                <Slider
                  label="In"
                  min={0}
                  max={Math.max(0.1, clip.duration - clip.trimEnd - 0.1)}
                  step={0.1}
                  value={clip.trimStart}
                  display={`${clip.trimStart.toFixed(1)}s`}
                  onChange={(v) => trimClip(clip.id, v, clip.trimEnd)}
                />
                <Slider
                  label="Out"
                  min={0}
                  max={Math.max(0.1, clip.duration - clip.trimStart - 0.1)}
                  step={0.1}
                  value={clip.trimEnd}
                  display={`${clip.trimEnd.toFixed(1)}s`}
                  onChange={(v) => trimClip(clip.id, clip.trimStart, v)}
                />
              </div>
            </Field>
          )}

          {clip.type !== 'caption' && clip.type !== 'image' && (
            <Field label="Volume">
              <Slider
                label="Vol"
                min={0}
                max={1}
                step={0.05}
                value={clip.volume ?? 1}
                display={`${Math.round((clip.volume ?? 1) * 100)}%`}
                onChange={(v) => updateClip(clip.id, { volume: v })}
              />
            </Field>
          )}

          {clip.type === 'video' && (
            <Field label="Speed">
              <div className="space-y-2">
                <Slider
                  label="Rate"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={clip.speed ?? 1}
                  display={`${clip.speed ?? 1}x`}
                  onChange={(v) => updateClip(clip.id, { speed: v })}
                />
                <Chips
                  options={[
                    { id: '0.5', label: '0.5x' },
                    { id: '1', label: '1x' },
                    { id: '1.5', label: '1.5x' },
                    { id: '2', label: '2x' },
                  ]}
                  value={String(clip.speed ?? 1)}
                  onChange={(v) => updateClip(clip.id, { speed: Number(v) })}
                />
              </div>
            </Field>
          )}

          {isVisual && (
            <Field label="Fade in / out">
              <div className="space-y-2.5">
                <Slider
                  label="In"
                  min={0}
                  max={3}
                  step={0.1}
                  value={clip.fadeIn ?? 0}
                  display={`${(clip.fadeIn ?? 0).toFixed(1)}s`}
                  onChange={(v) => updateClip(clip.id, { fadeIn: v })}
                />
                <Slider
                  label="Out"
                  min={0}
                  max={3}
                  step={0.1}
                  value={clip.fadeOut ?? 0}
                  display={`${(clip.fadeOut ?? 0).toFixed(1)}s`}
                  onChange={(v) => updateClip(clip.id, { fadeOut: v })}
                />
              </div>
            </Field>
          )}

          {/* Transition into this clip (base video track only) */}
          {isVisual && !isOverlay && (
            <Field label="Transition (from previous clip)">
              <div className="space-y-2">
                <Chips
                  options={TRANSITIONS}
                  value={clip.transitionIn?.type ?? 'none'}
                  onChange={(id) =>
                    updateClip(clip.id, {
                      transitionIn:
                        id === 'none'
                          ? undefined
                          : {
                              type: id as NonNullable<
                                Clip['transitionIn']
                              >['type'],
                              duration: clip.transitionIn?.duration ?? 0.5,
                            },
                    })
                  }
                />
                {clip.transitionIn && (
                  <Slider
                    label="Length"
                    min={0.25}
                    max={2}
                    step={0.25}
                    value={clip.transitionIn.duration}
                    display={`${clip.transitionIn.duration}s`}
                    onChange={(v) =>
                      updateClip(clip.id, {
                        transitionIn: { ...clip.transitionIn!, duration: v },
                      })
                    }
                  />
                )}
              </div>
            </Field>
          )}

          {/* Color adjustments */}
          {isVisual && (
            <Field label="Color">
              <div className="space-y-2">
                <Chips
                  options={COLOR_PRESETS}
                  value={adjust.preset ?? 'none'}
                  onChange={(id) =>
                    patchAdjust({ preset: id as typeof adjust.preset })
                  }
                />
                <Slider
                  label="Bright"
                  min={-0.5}
                  max={0.5}
                  step={0.05}
                  value={adjust.brightness ?? 0}
                  display={(adjust.brightness ?? 0).toFixed(2)}
                  onChange={(v) => patchAdjust({ brightness: v })}
                />
                <Slider
                  label="Contrast"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={adjust.contrast ?? 1}
                  display={(adjust.contrast ?? 1).toFixed(2)}
                  onChange={(v) => patchAdjust({ contrast: v })}
                />
                <Slider
                  label="Satur."
                  min={0}
                  max={2}
                  step={0.1}
                  value={adjust.saturation ?? 1}
                  display={(adjust.saturation ?? 1).toFixed(1)}
                  onChange={(v) => patchAdjust({ saturation: v })}
                />
              </div>
            </Field>
          )}

          {/* Motion preset */}
          {isVisual && !isOverlay && (
            <Field label="Motion">
              <Chips
                options={MOTIONS}
                value={clip.motion ?? 'none'}
                onChange={(id) =>
                  updateClip(clip.id, { motion: id as Clip['motion'] })
                }
              />
            </Field>
          )}

          {/* Green screen */}
          {clip.type === 'video' && (
            <Field label="Green screen (chroma key)">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={chroma.enabled}
                    onChange={(e) => patchChroma({ enabled: e.target.checked })}
                    className="accent-[#4d7cff]"
                  />
                  <span className="text-[11px] text-ink-base">
                    Remove color
                  </span>
                  <input
                    type="color"
                    value={chroma.color}
                    onChange={(e) => patchChroma({ color: e.target.value })}
                    className="w-7 h-6 rounded border border-[#303039] bg-transparent ml-auto"
                  />
                </div>
                {chroma.enabled && (
                  <>
                    <Slider
                      label="Similar"
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      value={chroma.similarity}
                      display={chroma.similarity.toFixed(2)}
                      onChange={(v) => patchChroma({ similarity: v })}
                    />
                    <Slider
                      label="Blend"
                      min={0}
                      max={0.5}
                      step={0.01}
                      value={chroma.blend}
                      display={chroma.blend.toFixed(2)}
                      onChange={(v) => patchChroma({ blend: v })}
                    />
                  </>
                )}
              </div>
            </Field>
          )}

          {/* Overlay placement (clips on video track 2+) */}
          {isOverlay && (
            <Field label="Overlay placement">
              <div className="space-y-2">
                <Slider
                  label="X"
                  min={0}
                  max={0.95}
                  step={0.01}
                  value={overlay.x}
                  display={`${Math.round(overlay.x * 100)}%`}
                  onChange={(v) => patchOverlay({ x: v })}
                />
                <Slider
                  label="Y"
                  min={0}
                  max={0.95}
                  step={0.01}
                  value={overlay.y}
                  display={`${Math.round(overlay.y * 100)}%`}
                  onChange={(v) => patchOverlay({ y: v })}
                />
                <Slider
                  label="Size"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={overlay.scale}
                  display={`${Math.round(overlay.scale * 100)}%`}
                  onChange={(v) => patchOverlay({ scale: v })}
                />
                <Slider
                  label="Opacity"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={overlay.opacity}
                  display={`${Math.round(overlay.opacity * 100)}%`}
                  onChange={(v) => patchOverlay({ opacity: v })}
                />
              </div>
            </Field>
          )}

          {/* Caption text + styling */}
          {clip.type === 'caption' && (
            <>
              <Field label="Caption text">
                <textarea
                  value={clip.captionText ?? ''}
                  onChange={(e) =>
                    updateClip(clip.id, { captionText: e.target.value })
                  }
                  className={`${inputCls} h-20 resize-none`}
                />
              </Field>
              <Field label="Text style">
                <div className="space-y-2.5">
                  <Slider
                    label="Size"
                    min={24}
                    max={96}
                    step={2}
                    value={style.fontSize ?? 48}
                    display={String(style.fontSize ?? 48)}
                    onChange={(v) => patchStyle({ fontSize: v })}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#71717f] w-14 shrink-0">
                      Color
                    </span>
                    {CAPTION_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => patchStyle({ color: c })}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          (style.color ?? '#ffffff') === c
                            ? 'border-[#4d7cff] scale-110'
                            : 'border-[#303039]'
                        }`}
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                    <input
                      type="color"
                      value={style.color ?? '#ffffff'}
                      onChange={(e) => patchStyle({ color: e.target.value })}
                      className="w-6 h-5 rounded border border-[#303039] bg-transparent"
                      title="Custom color"
                    />
                  </div>
                  <Chips
                    options={[
                      { id: 'top', label: 'Top' },
                      { id: 'middle', label: 'Middle' },
                      { id: 'bottom', label: 'Bottom' },
                    ]}
                    value={style.position ?? 'bottom'}
                    onChange={(id) =>
                      patchStyle({ position: id as typeof style.position })
                    }
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-base">
                      <input
                        type="checkbox"
                        checked={style.bold !== false}
                        onChange={(e) => patchStyle({ bold: e.target.checked })}
                        className="accent-[#4d7cff]"
                      />
                      Bold
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-base">
                      <input
                        type="checkbox"
                        checked={!!style.background}
                        onChange={(e) =>
                          patchStyle({ background: e.target.checked })
                        }
                        className="accent-[#4d7cff]"
                      />
                      Background box
                    </label>
                  </div>
                </div>
              </Field>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
