"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { AttendanceWeek } from "@/app/api/progress/[studentId]/route";

type Props = {
  data: AttendanceWeek[];
};

export function AttendanceChart({ data }: Props) {
  const totalCompleted = data.reduce((sum, w) => sum + w.completed, 0);
  const totalSessions = data.reduce((sum, w) => sum + w.total, 0);
  const avgPerWeek = data.length > 0 ? totalCompleted / data.length : 0;

  const chartData = data.map((w) => ({
    ...w,
    missed: Math.max(0, w.total - w.completed),
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
            allowDecimals={false}
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
            formatter={(value, name) => [
              value ?? 0,
              name === "completed" ? "Completadas" : "Pendientes",
            ]}
          />
          <ReferenceLine
            y={Math.round(avgPerWeek)}
            stroke="#facc15"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{ value: "Prom.", position: "insideTopRight", fill: "#facc15", fontSize: 9, fontWeight: 700 }}
          />
          <Bar dataKey="completed" fill="#4ade80" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" name="completed" />
          <Bar dataKey="missed" fill="#3f3f46" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" name="missed" />
        </BarChart>
      </ResponsiveContainer>

      {totalSessions > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Completaste{" "}
          <span className="font-black text-foreground">
            {totalCompleted} de {totalSessions}
          </span>{" "}
          sesiones ({Math.round((totalCompleted / totalSessions) * 100)}% de adherencia).
        </p>
      )}
    </div>
  );
}
