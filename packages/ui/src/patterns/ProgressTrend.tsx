import React from 'react';

export interface DataPoint {
  label: string;
  value: number; // 0 to 100
}

export interface ProgressTrendProps {
  data: DataPoint[];
  height?: number;
  width?: number;
  lineColor?: string;
  showPoints?: boolean;
}

export const ProgressTrend: React.FC<ProgressTrendProps> = ({
  data,
  height = 160,
  lineColor = '#0967F7',
  showPoints = true,
}) => {
  if (!data || data.length === 0) return null;

  const padding = 24;
  const graphHeight = height - padding * 2;
  const viewBoxWidth = 500;
  const graphWidth = viewBoxWidth - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * graphWidth;
    const y = padding + graphHeight - (d.value / 100) * graphHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${viewBoxWidth} ${height}`} className="w-full overflow-visible">
        {/* Y Axis Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding + graphHeight - (val / 100) * graphHeight;
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={viewBoxWidth - padding} y2={y} stroke="#F3F6FC" strokeWidth="1.5" />
              <text x={padding - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#656C79">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showPoints &&
          points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#FFFFFF" stroke={lineColor} strokeWidth="2.5" />
              <text x={p.x} y={height - 6} textAnchor="middle" fontSize="11" fill="#656C79">
                {p.label}
              </text>
            </g>
          ))}
      </svg>
    </div>
  );
};
