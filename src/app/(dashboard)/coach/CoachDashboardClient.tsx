 "use client";
import { useCoachStudents } from "@/hooks/useCoachStudents";

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
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <p className="text-sm text-zinc-500">Cargando estudiantes...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <p className="text-sm text-zinc-500">
          No se pudo cargar la información del coach.
        </p>
      </div>
    );
  }

  const { coach, students } = data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Panel de estudiantes
        </h1>
        <p className="text-sm text-zinc-500">
          {coach.full_name
            ? `Hola, ${coach.full_name}.`
            : "Hola, revisa el estado de tus estudiantes."}
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-sm text-zinc-600 shadow-sm">
          No tienes estudiantes con planes activos asignados.
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.planId}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {student.studentName}
                </p>
                <p className="text-xs text-zinc-500">
                  Plan activo: {student.planName}
                </p>
                {student.startDate ? (
                  <p className="text-xs text-zinc-400">
                    Inicio: {new Date(student.startDate).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-900"
              >
                Ver detalle
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
