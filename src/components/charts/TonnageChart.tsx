"use client";

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

type Props = {
  data: TonnageWeek[];
};

export function TonnageChart({ data }: Props) {
  const total = data.reduce((sum, w) => sum + w.tonnage, 0);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
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
          en las últimas {data.length} semanas.
        </p>
      )}
    </div>
  );
}
