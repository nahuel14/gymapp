import { createSupabaseServerClient } from "@/lib/supabase";
import { buildPlanWorkbook } from "@/lib/export/planExcel";
import type { ExportExercise, ExportSession } from "@/lib/export/planExcel";
import type { Tables } from "@/types/supabase";

type RawExercise = Tables<"session_exercises"> & {
  superset_group?: number | null;
  exercise?: { name: string | null; exercise_type: string | null } | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { studentId, planId } = body as { studentId: string; planId: number };

    if (!studentId || !planId) {
      return new Response("Missing studentId or planId", { status: 400 });
    }

    // Fetch plan
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id, name, start_date")
      .eq("id", planId)
      .single();

    if (!plan) return new Response("Plan not found", { status: 404 });

    // Fetch student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, last_name")
      .eq("id", studentId)
      .single();

    // Fetch sessions for this plan ordered
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, week_number, day_name, date, order_index")
      .eq("plan_id", planId)
      .order("week_number")
      .order("order_index");

    if (!sessions || sessions.length === 0) {
      return new Response("Plan has no sessions", { status: 422 });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Fetch exercises with superset_group (*) and exercise join
    const { data: rawExercises } = await supabase
      .from("session_exercises")
      .select("*, exercise:exercises(name, exercise_type)")
      .in("session_id", sessionIds)
      .order("order_index");

    const exercises = (rawExercises ?? []) as RawExercise[];

    // Group by session_id
    const exercisesBySession: Record<number, ExportExercise[]> = {};
    for (const ex of exercises) {
      const sid = ex.session_id!;
      if (!exercisesBySession[sid]) exercisesBySession[sid] = [];
      exercisesBySession[sid].push({
        id: ex.id,
        session_id: ex.session_id,
        order_index: ex.order_index,
        superset_group: ex.superset_group ?? null,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight: ex.target_weight,
        target_rpe: ex.target_rpe,
        rest_seconds: ex.rest_seconds,
        coach_notes: ex.coach_notes,
        actual_sets: ex.actual_sets,
        actual_reps: ex.actual_reps,
        actual_weight: ex.actual_weight,
        actual_rpe: ex.actual_rpe,
        student_notes: ex.student_notes,
        exercise: ex.exercise ?? null,
      });
    }

    const studentName = [profile?.name, profile?.last_name].filter(Boolean).join(" ") || "Alumno";

    const workbook = await buildPlanWorkbook({
      planName: plan.name,
      studentName,
      planStartDate: plan.start_date ?? null,
      sessions: sessions as ExportSession[],
      exercisesBySession,
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const slug = plan.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rutina-${slug}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[export/plan]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
