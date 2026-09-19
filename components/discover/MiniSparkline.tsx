"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

interface MiniSparklineProps {
  delta?: number;
  seed?: string;
  className?: string;
  height?: number;
  width?: number;
  showArea?: boolean;
}

export function MiniSparkline({
  delta = 0,
  seed = "cook",
  className,
  height = 48,
  width = 160,
  showArea = true,
}: MiniSparklineProps) {
  const isPositive = delta >= 0;
  const strokeColor = isPositive ? "#3BB273" : "#E53935";
  const rawId = useId();
  const gradientId = `spark-${rawId.replace(/:/g, "")}`;

  // Deterministic organic curve points
  const points = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const count = 7;
    const pts: { x: number; y: number }[] = [];
    const trend = isPositive ? -1 : 1; // in SVG, smaller y is higher

    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1)) * width;
      const pseudoRand = Math.abs(Math.sin(hash + i * 1.83));
      const progress = i / (count - 1);
      const baseline = height / 2;
      const noise = (height * 0.28) * (pseudoRand - 0.5);
      const trendOffset = (progress - 0.5) * (height * 0.4) * trend;
      const y = Math.max(4, Math.min(height - 4, baseline + noise + trendOffset));
      pts.push({ x, y });
    }

    // Anchor first and last points cleanly
    pts[0].y = isPositive ? height * 0.65 : height * 0.35;
    pts[pts.length - 1].y = isPositive ? height * 0.18 : height * 0.82;
    return pts;
  }, [seed, height, width, isPositive]);

  // Construct smooth SVG bezier path
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = prev.x + (curr.x - prev.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (!showArea || !pathD) return "";
    return `${pathD} L ${width} ${height} L 0 ${height} Z`;
  }, [pathD, width, height, showArea]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {showArea && <path d={areaD} fill={`url(#${gradientId})`} />}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
