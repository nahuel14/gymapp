"use client";

import { useState, type ReactElement } from "react";
import { useStudentProgress } from "@/hooks/useStudentProgress";
import { TrendingUp, Dumbbell, Calendar } from "lucide-react";
import dynamic from "next/dynamic";

const TonnageChart = dynamic(() => import("@/components/charts/TonnageChart").then((m) => m.TonnageChart), { ssr: false });
const StrengthChart = dynamic(() => import("@/components/charts/StrengthChart").then((m) => m.StrengthChart), { ssr: false });
const AttendanceChart = dynamic(() => import("@/components/charts/AttendanceChart").then((m) => m.AttendanceChart), { ssr: false });

type Tab = "volumen" | "fuerza" | "asistencia";
type GroupBy = "semanas" | "meses";

const TABS: { id: Tab; label: string; icon: ReactElement }[] = [
  { id: "volumen", label: "Volumen", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "fuerza", label: "Fuerza", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "asistencia", label: "Asistencia", icon: <Calendar className="h-4 w-4" /> },
];

type Props = {
  studentId: string;
  studentName?: string;
  hideHeader?: boolean;
};

export function StudentProgressClient({ studentId, studentName, hideHeader }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("volumen");
  const [groupBy, setGroupBy] = useState<GroupBy>("semanas");
  const { data, isLoading, error } = useStudentProgress(studentId);

  return (
    <div className="min-h-screen bg-background">
      {!hideHeader && (
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
          <h1 className="text-sm font-black uppercase tracking-widest text-foreground">
            {studentName ? `Progreso — ${studentName}` : "Mi Progreso"}
          </h1>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Tab selector */}
        <div className="flex gap-1 rounded-xl bg-zinc-900 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? "bg-yellow-400 text-zinc-900 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Semanas / Meses toggle */}
        <div className="flex justify-center">
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-0.5">
            {(["semanas", "meses"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-widest transition-all ${
                  groupBy === g
                    ? "bg-zinc-700 text-foreground shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {g === "semanas" ? "Semanas" : "Meses"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No se pudo cargar el progreso.</p>
          </div>
        )}

        {data && !isLoading && (
          <div className="rounded-2xl border border-border bg-card p-5">
            {activeTab === "volumen" && (
              <>
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Volumen semanal</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tonelaje total movido (sets × reps × kg)</p>
                </div>
                {data.tonnageByWeek.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">Sin datos de volumen aún.</p>
                ) : (
                  <TonnageChart data={data.tonnageByWeek} groupBy={groupBy} />
                )}
              </>
            )}

            {activeTab === "fuerza" && (
              <>
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progresión de fuerza</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Peso máximo por ejercicio a lo largo del tiempo</p>
                </div>
                <StrengthChart data={data.strengthByExercise} groupBy={groupBy} />
              </>
            )}

            {activeTab === "asistencia" && (
              <>
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asistencia semanal</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sesiones completadas vs planificadas</p>
                </div>
                {data.attendanceByWeek.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">Sin datos de asistencia aún.</p>
                ) : (
                  <AttendanceChart data={data.attendanceByWeek} groupBy={groupBy} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
