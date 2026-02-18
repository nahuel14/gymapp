 "use client";
import { useStudentSession } from "@/hooks/useStudentSession";

export function StudentPlanSummaryClient() {
  const { data, isLoading } = useStudentSession();

  if (isLoading || !data) {
    return null;
  }

  const { plan, session } = data;

  if (!plan || !session) {
    return null;
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
      <p>
        Plan activo (cliente): <span className="font-medium">{plan.name}</span>
      </p>
      <p>
        Semana {session.week_number} · {session.day_name}
      </p>
    </div>
  );
}

