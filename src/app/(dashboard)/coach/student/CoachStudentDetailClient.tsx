"use client";

import { useState } from "react";
import { useStudentRoutine } from "@/hooks/useStudentRoutine";
import { RoutineCalendarClient } from "./RoutineCalendarClient";
import { StudentProgressClient } from "@/app/(dashboard)/student/progreso/StudentProgressClient";
import { ChevronLeft, Dumbbell, TrendingUp } from "lucide-react";
import Link from "next/link";

type View = "plan" | "progreso";

type Props = {
  studentId: string;
  viewerRole: "COACH" | "ADMIN" | "SUPER_STUDENT";
};

export function CoachStudentDetailClient({ studentId, viewerRole }: Props) {
  const [view, setView] = useState<View>("plan");
  const { data, isLoading, error } = useStudentRoutine(studentId);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          No se pudo cargar la rutina del alumno.
        </p>
        <Link
          href="/coach"
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  const studentName = [data.profile?.name, data.profile?.last_name].filter(Boolean).join(" ") || undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur-md border-b border-border">
        {viewerRole !== "SUPER_STUDENT" && (
          <Link href="/coach" className="rounded-full p-1 transition hover:bg-muted">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        )}
        <h1 className="flex-1 text-sm font-bold uppercase tracking-widest text-foreground truncate">
          {viewerRole === "SUPER_STUDENT" ? "Mi Rutina" : (studentName ?? "Alumno")}
        </h1>

        {/* Plan / Progreso toggle — only for COACH and ADMIN */}
        {viewerRole !== "SUPER_STUDENT" && (
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-0.5 shrink-0">
            <button
              onClick={() => setView("plan")}
              aria-label="Ver plan"
              className={`flex items-center justify-center rounded-md p-2 transition-all ${
                view === "plan"
                  ? "bg-yellow-400 text-zinc-900 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Dumbbell className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("progreso")}
              aria-label="Ver progreso"
              className={`flex items-center justify-center rounded-md p-2 transition-all ${
                view === "progreso"
                  ? "bg-yellow-400 text-zinc-900 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {view === "plan" ? (
        <RoutineCalendarClient
          studentId={studentId}
          role={viewerRole}
          profile={data.profile}
          plan={data.plan}
          allPlans={data.allPlans}
          sessions={data.sessions}
          exercisesBySession={data.exercisesBySession}
        />
      ) : (
        <StudentProgressClient studentId={studentId} studentName={studentName} hideHeader />
      )}
    </div>
  );
}

