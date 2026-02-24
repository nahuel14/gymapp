 "use client";

import { useStudentRoutine } from "@/hooks/useStudentRoutine";
import { RoutineCalendarClient } from "./RoutineCalendarClient";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = {
  studentId: string;
};

export function CoachStudentDetailClient({ studentId }: Props) {
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
          No se pudo cargar la rutina del estudiante.
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur-md border-b border-border">
        <Link href="/coach" className="rounded-full p-1 transition hover:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-widest text-foreground">
          Rutina de Alumno
        </h1>
      </div>

      <RoutineCalendarClient
        role="COACH"
        profile={data.profile}
        plan={data.plan}
        sessions={data.sessions}
        exercisesBySession={data.exercisesBySession}
      />
    </div>
  );
}
