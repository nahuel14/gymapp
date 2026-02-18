import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

type CoachPageProps = {
  searchParams?: {
    error?: string;
  };
};

async function getCoachContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id as any)
    .single()) as any;

  if (!profile || profile.role !== "COACH") {
    redirect("/login");
  }

  const { data: rawPlans } = await supabase
    .from("training_plans")
    .select("id, name, student_id, is_active, start_date")
    .eq("coach_id", user.id as any)
    .eq("is_active", true as any)
    .order("created_at", { ascending: false });

  const plans = (rawPlans ?? []) as any[];

  if (!plans || plans.length === 0) {
    return {
      coach: profile,
      students: [],
    };
  }

  const studentIds = Array.from(
    new Set(plans.map((plan) => plan.student_id).filter(Boolean)),
  ) as string[];

  let studentsById = new Map<string, { full_name: string | null }>();

  if (studentIds.length > 0) {
    const studentsResponse = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds as any);

    const students = (studentsResponse.data ?? []) as any[];

    studentsById = new Map(
      students.map((student) => [student.id, { full_name: student.full_name }]),
    );
  }

  const students = plans.map((plan) => {
    const student = studentsById.get(plan.student_id) ?? {
      full_name: null,
    };

    return {
      planId: plan.id,
      planName: plan.name,
      studentId: plan.student_id,
      studentName: student.full_name ?? "Sin nombre",
      startDate: plan.start_date,
    };
  });

  return {
    coach: profile,
    students,
  };
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const { coach, students } = await getCoachContext();

  const errorKey = searchParams?.error;

  let errorMessage = "";

  if (errorKey === "save") {
    errorMessage = "Ocurrió un error al realizar la acción.";
  }

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
