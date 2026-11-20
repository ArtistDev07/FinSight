import React from 'react';
import { formatINR } from '../../utils/financialMath';

export interface CashFlowSeriesPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export const CashFlowTrendChart: React.FC<{
  series: CashFlowSeriesPoint[];
  height?: number;
}> = ({ series, height = 210 }) => {
  if (!series || series.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-[#819188] dark:text-[#A3B9AD]">
        Add transactions to populate cash-flow timeline.
      </div>
    );
  }

  const width = 620;
  const padX = 36;
  const padTop = 20;
  const padBottom = 34;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const maxVal = Math.max(
    1,
    ...series.flatMap(s => [s.inflow, s.outflow, Math.abs(s.net)])
  );

  const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW / 2;
  const barGroupW = Math.min(34, Math.max(12, innerW / Math.max(series.length * 2.2, 4)));

  const netPoints = series
    .map((s, idx) => {
      const x = series.length === 1 ? padX + innerW / 2 : padX + idx * stepX;
      const y = padTop + innerH - Math.max(0, s.net / maxVal) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[380px] h-auto" role="img" aria-label="Income, expenses, and net cash flow chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padTop + innerH * (1 - t);
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} className="stroke-[#DEE7E0] dark:stroke-[#29453A]" strokeDasharray="3 3" />
            </g>
          );
        })}

        {/* Bars for Inflow & Outflow */}
        {series.map((point, idx) => {
          const cx = series.length === 1 ? padX + innerW / 2 : padX + idx * stepX;
          const inflowH = Math.max(2, (point.inflow / maxVal) * innerH);
          const outflowH = Math.max(2, (point.outflow / maxVal) * innerH);
          const half = barGroupW / 2;
          return (
            <g key={point.label}>
              <rect
                x={cx - half - 1}
                y={padTop + innerH - inflowH}
                width={half}
                height={inflowH}
                rx="3"
                className="fill-[#21845D]/80 dark:fill-[#58C993]/80"
              >
                <title>{`${point.label} Income: ${formatINR(point.inflow)}`}</title>
              </rect>
              <rect
                x={cx + 1}
                y={padTop + innerH - outflowH}
                width={half}
                height={outflowH}
                rx="3"
                className="fill-[#CB5252]/75 dark:fill-[#EF8585]/75"
              >
                <title>{`${point.label} Expenses: ${formatINR(point.outflow)}`}</title>
              </rect>
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                className="fill-[#819188] dark:fill-[#A3B9AD]"
                fontFamily="IBM Plex Mono, monospace"
              >
                {point.label}
              </text>
            </g>
          );
        })}

        {/* Net Trend Line */}
        {series.length > 1 && (
          <polyline
            fill="none"
            points={netPoints}
            className="stroke-[#123D32] dark:stroke-[#BCE8D3]"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};

export const AllocationRingChart: React.FC<{
  slices: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
}> = ({ slices, centerLabel, centerValue }) => {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-36 w-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 132 132" className="h-36 w-36 -rotate-90" role="img" aria-label="Portfolio asset allocation">
          <circle cx="66" cy="66" r={radius} fill="none" className="stroke-[#EDF3EF] dark:stroke-[#17342A]" strokeWidth="14" />
          {total > 0 &&
            slices.map(slice => {
              const pct = slice.value / total;
              const dash = pct * circumference;
              const currentOffset = offset;
              offset += dash;
              return (
                <circle
                  key={slice.label}
                  cx="66"
                  cy="66"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-currentOffset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          <span className="text-[10px] text-[#819188] dark:text-[#A3B9AD]">{centerLabel}</span>
          <span className="font-mono-num text-xs font-bold text-[#172923] dark:text-[#F0F6F2] truncate max-w-[84px]">
            {centerValue}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {slices.map(s => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-[#53675E] dark:text-[#A3B9AD] truncate">{s.label}</span>
              </div>
              <div className="font-mono-num text-right shrink-0">
                <span className="font-semibold text-[#172923] dark:text-[#F0F6F2]">{formatINR(s.value)}</span>
                <span className="text-[#819188] dark:text-[#A3B9AD] ml-1.5">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BalanceProjectionLineChart: React.FC<{
  points: Array<{ label: string; balance: number }>;
}> = ({ points }) => {
  if (!points || points.length === 0) return null;
  const width = 620;
  const height = 180;
  const padX = 32;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const minVal = Math.min(0, ...points.map(p => p.balance));
  const maxVal = Math.max(1, ...points.map(p => p.balance));
  const span = Math.max(1, maxVal - minVal);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const coords = points.map((p, i) => ({
    ...p,
    x: padX + i * stepX,
    y: padY + innerH - ((p.balance - minVal) / span) * innerH,
  }));

  const polyline = coords.map(c => `${c.x},${c.y}`).join(' ');
  const zeroY = padY + innerH - ((0 - minVal) / span) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Projected cash balance line chart">
      <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} className="stroke-[#DEE7E0] dark:stroke-[#29453A]" strokeDasharray="4 4" />
      {coords.length > 1 && (
        <polyline
          fill="none"
          points={polyline}
          className="stroke-[#168366] dark:stroke-[#66C49F]"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {coords.map(c => (
        <g key={c.label}>
          <circle
            cx={c.x}
            cy={c.y}
            r="4"
            className={c.balance < 0 ? 'fill-[#CB5252] dark:fill-[#EF8585]' : 'fill-[#123D32] dark:fill-[#BCE8D3]'}
          >
            <title>{`${c.label}: ${formatINR(c.balance)}`}</title>
          </circle>
          <text
            x={c.x}
            y={height - 6}
            textAnchor="middle"
            fontSize="10"
            className="fill-[#819188] dark:fill-[#A3B9AD]"
            fontFamily="IBM Plex Mono, monospace"
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
