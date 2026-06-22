"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TonnageWeek } from "@/app/api/progress/[studentId]/route";
import { groupTonnageByMonth } from "@/lib/progress/grouping";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WINDOW = 6;

type Props = {
  data: TonnageWeek[];
  groupBy: "semanas" | "meses";
};

export function TonnageChart({ data, groupBy }: Props) {
  const items = useMemo(
    () => (groupBy === "meses" ? groupTonnageByMonth(data) : data),
    [data, groupBy]
  );

  const [windowStart, setWindowStart] = useState(() => Math.max(0, items.length - WINDOW));

  useEffect(() => {
    setWindowStart(Math.max(0, items.length - WINDOW));
  }, [items.length, groupBy]);

  const visible = items.slice(windowStart, windowStart + WINDOW);
  const canBack = windowStart > 0;
  const canForward = windowStart + WINDOW < items.length;
  const total = visible.reduce((sum, w) => sum + w.tonnage, 0);

  return (
    <div className="space-y-3">
      {items.length > WINDOW && (
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
            onClick={() => setWindowStart((s) => Math.min(items.length - WINDOW, s + WINDOW))}
            disabled={!canForward}
            aria-label="Periodo siguiente"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-yellow-400 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={visible} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
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
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(250,204,21,0.08)" }}
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}
            labelFormatter={(label) => groupBy === "meses" ? `Mes de ${label}` : `Semana del ${label}`}
            formatter={(value) => [`${Number(value ?? 0).toLocaleString("es-AR")} kg`, "Volumen"]}
          />
          <Bar dataKey="tonnage" fill="#facc15" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>

      {total > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Moviste un total de{" "}
          <span className="font-black text-foreground">
            {total.toLocaleString("es-AR")} kg
          </span>{" "}
          en {groupBy === "meses"
            ? `${visible.length} ${visible.length === 1 ? "mes" : "meses"}`
            : `${visible.length} semanas`}.
        </p>
      )}
    </div>
  );
}
