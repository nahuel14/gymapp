 "use client";
import { useCoachStudents } from "@/hooks/useCoachStudents";
import Link from "next/link";

type Props = {
  errorKey?: string;
};

export function CoachDashboardClient({ errorKey }: Props) {
  const { data, isLoading } = useCoachStudents();

  let errorMessage = "";

  if (errorKey === "save") {
    errorMessage = "Ocurrió un error al realizar la acción.";
  }

  if (isLoading && !data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground">Cargando estudiantes...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground">
          No se pudo cargar la información del coach.
        </p>
      </div>
    );
  }

  const { coach, students } = data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Panel de estudiantes
        </h1>
        <p className="text-sm text-muted-foreground">
          {(coach as any).name
            ? `Hola, ${(coach as any).name}.`
            : "Hola, revisa el estado de tus estudiantes."}
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="rounded-lg bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No tienes estudiantes con planes activos asignados.
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.planId}
              className="flex flex-col items-start justify-between gap-3 rounded-lg bg-card p-4 shadow-sm md:flex-row md:items-center"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {student.studentName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Plan activo: {student.planName}
                </p>
                {student.startDate ? (
                  <p className="text-xs text-muted-foreground">
                    Inicio: {new Date(student.startDate).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/coach/student/${student.studentId}`}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground"
              >
                Ver detalle
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
