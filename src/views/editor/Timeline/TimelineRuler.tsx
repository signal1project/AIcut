import React, { useMemo } from 'react';

interface Props {
  duration: number;
  zoom: number;
  scrollLeft: number;
}

const TimelineRuler: React.FC<Props> = ({ duration, zoom, scrollLeft }) => {
  const totalWidth = Math.max(duration * zoom, 800);

  const ticks = useMemo(() => {
    const interval = zoom < 30 ? 10 : zoom < 80 ? 5 : 1;
    const marks: { time: number; major: boolean }[] = [];
    for (let t = 0; t <= duration + interval; t += interval) {
      marks.push({ time: t, major: t % (interval * 5) === 0 });
    }
    return marks;
  }, [duration, zoom]);

  return (
    <div className="relative bg-[#131316] border-b border-[#202027] overflow-hidden select-none shrink-0" style={{ height: 28 }}>
      <div className="absolute top-0 left-0 h-full" style={{ width: totalWidth, transform: `translateX(${-scrollLeft}px)` }}>
        {ticks.map(({ time, major }) => (
          <div key={time} className="absolute top-0 flex flex-col items-start" style={{ left: time * zoom }}>
            {major ? (
              <>
                <span className="text-[9px] text-[#71717f] mt-1 ml-1 leading-none tabular-nums">{fmt(time)}</span>
                <div className="absolute top-0 left-0 w-px h-2 bg-[#3a3a44]" />
              </>
            ) : (
              <div className="w-px h-1.5 bg-[#26262d]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default TimelineRuler;
