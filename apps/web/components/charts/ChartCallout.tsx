"use client";

/**
 * Small white callout box used as a ReferenceDot label (e.g. "Projected
 * shortfall $4,800"). Purely presentational: it only renders the values it is
 * given, next to a point the chart already placed.
 */
interface CalloutViewBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ChartCalloutProps {
  title: string;
  value: string;
  valueColor: string;
  /** Which side of the marker the box sits on. */
  side?: "left" | "right";
  viewBox?: CalloutViewBox;
}

const PADDING_X = 10;
const CHAR_WIDTH = 6.2;

export function ChartCallout({ title, value, valueColor, side = "left", viewBox }: ChartCalloutProps) {
  const cx = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) / 2;
  const cy = (viewBox?.y ?? 0) + (viewBox?.height ?? 0) / 2;
  const width = Math.round(Math.max(title.length, value.length * 1.3) * CHAR_WIDTH + PADDING_X * 2);
  const height = 46;
  const gap = 14;
  const placeLeft = side === "left";
  const x = placeLeft ? cx - gap - width : cx + gap;
  const y = Math.max(4, cy - height - 8);
  const tipX = placeLeft ? x + width : x;
  const tipDir = placeLeft ? 1 : -1;

  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill="#fff"
        stroke="#E6E8EE"
        style={{ filter: "drop-shadow(0 4px 10px rgba(15,27,49,0.12))" }}
      />
      <path
        d={`M ${tipX} ${y + height - 16} l ${tipDir * 7} 6 l ${-tipDir * 7} 6 z`}
        fill="#fff"
        stroke="#E6E8EE"
      />
      <text x={x + PADDING_X} y={y + 17} fontSize={11} fill="#64748B" fontWeight={500}>
        {title}
      </text>
      <text x={x + PADDING_X} y={y + 36} fontSize={14} fill={valueColor} fontWeight={700}>
        {value}
      </text>
    </g>
  );
}
