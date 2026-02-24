 "use client";

import { useStudentRoutine } from "@/hooks/useStudentRoutine";
import { RoutineCalendarClient } from "../coach/student/RoutineCalendarClient";
import { useUserProfile } from "@/hooks/useUserProfile";

export function StudentRoutineViewClient() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data, isLoading, error } = useStudentRoutine(profile?.id || "");

  if (profileLoading || isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          No se pudo cargar tu rutina de entrenamiento.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <RoutineCalendarClient
        role="STUDENT"
        profile={data.profile}
        plan={data.plan}
        sessions={data.sessions}
        exercisesBySession={data.exercisesBySession}
      />
    </div>
  );
}
