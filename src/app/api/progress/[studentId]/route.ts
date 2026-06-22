import { createSupabaseServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  calculateExerciseTonnage,
  getMaxWeight,
  getISOWeek,
  formatProgressDateLabel,
  getWeekMondayLabel,
} from "@/lib/progress/calculations";

export type TonnageWeek = {
  label: string;
  week: string;
  tonnage: number;
};

export type StrengthPoint = {
  date: string;
  label: string;
  maxWeight: number;
};

export type AttendanceWeek = {
  label: string;
  week: string;
  completed: number;
  total: number;
};

export type ProgressData = {
  tonnageByWeek: TonnageWeek[];
  strengthByExercise: Record<string, StrengthPoint[]>;
  attendanceByWeek: AttendanceWeek[];
};


export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const { searchParams } = new URL(request.url);
    const weeks = Math.min(parseInt(searchParams.get("weeks") ?? "12", 10), 52);

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id as never)
      .single();

    const role = (viewerProfile as { role: string } | null)?.role;

    // Authorization: student sees own data; coach must own this student; admin sees all
    if (user.id !== studentId) {
      if (role === "COACH") {
        const { data: rel } = await supabase
          .from("coach_students")
          .select("student_id")
          .eq("coach_id", user.id as never)
          .eq("student_id", studentId as never)
          .single();
        if (!rel) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      } else if (role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    // Date range
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Get student's plans
    const { data: plans } = await supabase
      .from("training_plans")
      .select("id")
      .eq("student_id", studentId as never)
      .eq("is_template", false as never);

    const planIds = (plans ?? []).map((p: { id: number }) => p.id);
    if (planIds.length === 0) {
      return NextResponse.json({ tonnageByWeek: [], strengthByExercise: {}, attendanceByWeek: [] });
    }

    // Get sessions in range
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, date, is_completed")
      .in("plan_id", planIds as never)
      .not("date", "is", null)
      .gte("date", cutoffStr as never)
      .order("date", { ascending: true });

    const typedSessions = (sessions ?? []) as { id: number; date: string; is_completed: boolean | null }[];

    if (typedSessions.length === 0) {
      return NextResponse.json({ tonnageByWeek: [], strengthByExercise: {}, attendanceByWeek: [] });
    }

    const sessionIds = typedSessions.map((s) => s.id);
    const sessionDateById: Record<number, string> = {};
    typedSessions.forEach((s) => { sessionDateById[s.id] = s.date; });

    // Get session exercises with exercise names
    const { data: sessionExercises } = await supabase
      .from("session_exercises")
      .select("session_id, actual_weight, actual_reps, actual_sets, exercise:exercises(name)")
      .in("session_id", sessionIds as never);

    type RawExercise = {
      session_id: number;
      actual_weight: string[] | null;
      actual_reps: string[] | null;
      actual_sets: number | null;
      exercise: { name: string } | null;
    };

    const typedExercises = (sessionExercises ?? []) as RawExercise[];

    // Aggregate tonnage and attendance by ISO week
    const tonnageMap = new Map<string, number>();
    const attendanceMap = new Map<string, { completed: number; total: number }>();
    const strengthMap = new Map<string, Map<string, number>>();

    // Initialize attendance from sessions
    for (const session of typedSessions) {
      const isoWeek = getISOWeek(session.date);
      if (!attendanceMap.has(isoWeek)) {
        attendanceMap.set(isoWeek, { completed: 0, total: 0 });
      }
      const att = attendanceMap.get(isoWeek)!;
      att.total += 1;
      if (session.is_completed) att.completed += 1;
    }

    // Aggregate from exercises
    for (const ex of typedExercises) {
      const date = sessionDateById[ex.session_id];
      if (!date) continue;

      const weights = ex.actual_weight ?? [];
      const reps = ex.actual_reps ?? [];
      if (weights.length === 0) continue;

      const isoWeek = getISOWeek(date);

      // Tonnage
      const exTonnage = calculateExerciseTonnage(weights, reps);
      tonnageMap.set(isoWeek, (tonnageMap.get(isoWeek) ?? 0) + exTonnage);

      // Strength per exercise
      const exerciseName = ex.exercise?.name;
      if (exerciseName && weights.length > 0) {
        const maxW = getMaxWeight(weights);
        if (maxW > 0) {
          if (!strengthMap.has(exerciseName)) strengthMap.set(exerciseName, new Map());
          const byDate = strengthMap.get(exerciseName)!;
          byDate.set(date, Math.max(byDate.get(date) ?? 0, maxW));
        }
      }
    }

    // Sort weeks and assign labels
    const sortedWeeks = [...new Set([...tonnageMap.keys(), ...attendanceMap.keys()])].sort();
    const weekLabel = (isoWeek: string) => getWeekMondayLabel(isoWeek);

    const tonnageByWeek: TonnageWeek[] = sortedWeeks.map((week) => ({
      label: weekLabel(week),
      week,
      tonnage: Math.round(tonnageMap.get(week) ?? 0),
    }));

    const attendanceByWeek: AttendanceWeek[] = sortedWeeks.map((week) => {
      const att = attendanceMap.get(week) ?? { completed: 0, total: 0 };
      return { label: weekLabel(week), week, ...att };
    });

    // Strength: sort each exercise's points by date
    const strengthByExercise: Record<string, StrengthPoint[]> = {};
    for (const [name, byDate] of strengthMap.entries()) {
      const points = [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, maxWeight]) => ({
          date,
          label: formatProgressDateLabel(date),
          maxWeight,
        }));
      if (points.length >= 1) {
        strengthByExercise[name] = points;
      }
    }

    return NextResponse.json({ tonnageByWeek, strengthByExercise, attendanceByWeek } satisfies ProgressData);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
