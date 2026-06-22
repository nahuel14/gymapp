"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import type { StrengthPoint } from "@/app/api/progress/[studentId]/route";
import { groupStrengthByMonth } from "@/lib/progress/grouping";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WINDOW = 6;
const EMPTY: StrengthPoint[] = [];

type Props = {
  data: Record<string, StrengthPoint[]>;
  groupBy: "semanas" | "meses";
};

export function StrengthChart({ data, groupBy }: Props) {
  const exercises = useMemo(() => Object.keys(data).sort(), [data]);
  const [exIdx, setExIdx] = useState(0);

  const rawPoints = exercises.length > 0 ? (data[exercises[exIdx]!] ?? EMPTY) : EMPTY;

  const points = useMemo(
    () => (groupBy === "meses" ? groupStrengthByMonth(rawPoints) : rawPoints),
    [rawPoints, groupBy]
  );

  const [windowStart, setWindowStart] = useState(() => Math.max(0, points.length - WINDOW));

  useEffect(() => {
    setWindowStart(Math.max(0, points.length - WINDOW));
  }, [points.length, groupBy, exIdx]);

  if (exercises.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        Sin datos de fuerza registrados aún.
      </p>
    );
  }

  const visible = points.slice(windowStart, windowStart + WINDOW);
  const canBack = windowStart > 0;
  const canForward = windowStart + WINDOW < points.length;

  const maxPoint = visible.length > 0
    ? visible.reduce((best, p) => (p.maxWeight > best.maxWeight ? p : best), visible[0]!)
    : null;

  const allFirst = rawPoints[0]?.maxWeight ?? 0;
  const allLast = rawPoints[rawPoints.length - 1]?.maxWeight ?? 0;
  const allDiff = allLast - allFirst;

  return (
    <div className="space-y-3">
      {/* Exercise selector */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExIdx((i) => (i - 1 + exercises.length) % exercises.length)}
          className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400 disabled:opacity-30"
          disabled={exercises.length <= 1}
          aria-label="Ejercicio anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ejercicio</p>
          <p className="text-sm font-bold text-foreground">{exercises[exIdx]}</p>
        </div>
        <button
          onClick={() => setExIdx((i) => (i + 1) % exercises.length)}
          className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400 disabled:opacity-30"
          disabled={exercises.length <= 1}
          aria-label="Ejercicio siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Timeline navigation */}
      {points.length > WINDOW && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setWindowStart((s) => Math.max(0, s - WINDOW))}
            disabled={!canBack}
            aria-label="Periodo anterior"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {visible[0]?.label} — {visible[visible.length - 1]?.label}
          </span>
          <button
            onClick={() => setWindowStart((s) => Math.min(points.length - WINDOW, s + WINDOW))}
            disabled={!canForward}
            aria-label="Periodo siguiente"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={visible} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 10, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: "#facc15", strokeWidth: 1, strokeDasharray: "4 2" }}
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}
            formatter={(value) => [`${value ?? 0} kg`, "Máx. peso"]}
          />
          <Line
            type="monotone"
            dataKey="maxWeight"
            stroke="#facc15"
            strokeWidth={2.5}
            dot={{ fill: "#facc15", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#facc15", strokeWidth: 0 }}
          />
          {maxPoint && (
            <ReferenceDot
              x={maxPoint.label}
              y={maxPoint.maxWeight}
              r={5}
              fill="#facc15"
              stroke="#18181b"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {rawPoints.length >= 2 && (
        <p className="text-center text-xs text-muted-foreground">
          {allDiff >= 0 ? "Aumentaste" : "Bajaste"} tu fuerza un{" "}
          <span className={`font-black ${allDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
            {allFirst > 0 ? `${Math.abs(Math.round((allDiff / allFirst) * 100))}%` : `${Math.abs(allDiff)} kg`}
          </span>{" "}
          ({allFirst} kg → {allLast} kg).
        </p>
      )}
    </div>
  );
}
