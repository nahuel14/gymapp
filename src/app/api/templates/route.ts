import { createSupabaseServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Check if user is ADMIN — admins see all coaches' templates
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "ADMIN";

    // Get templates: admins see all, coaches see only their own
    let query = supabase
      .from("training_plans")
      .select(`
        id,
        name,
        created_at,
        coach_id
      `)
      .eq("is_template", true)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("coach_id", user.id);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    // Get session and exercise counts for each template
    const transformedTemplates = await Promise.all(
      (templates || []).map(async (template) => {
        const { data: templateSessions } = await supabase
          .from("sessions")
          .select("id, week_number")
          .eq("plan_id", template.id);

        // Get session count
        const { count: sessionCount } = await supabase
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .eq("plan_id", template.id);

        // Get exercise count
        const { count: exerciseCount } = await supabase
          .from("session_exercises")
          .select("*", { count: "exact", head: true })
          .in("session_id",
            templateSessions?.map(s => s.id) || []
          );

        // Days per week = sessions in the first (minimum) week number
        const weekCounts = new Map<number, number>();
        for (const s of templateSessions || []) {
          const wk = (s as any).week_number ?? 1;
          weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
        }
        const sortedWeeks = [...weekCounts.keys()].sort((a, b) => a - b);
        const training_days_count = sortedWeeks.length > 0 ? (weekCounts.get(sortedWeeks[0]) ?? 0) : 0;

        return {
          id: template.id,
          name: template.name,
          created_at: template.created_at,
          coach_id: template.coach_id,
          session_count: sessionCount || 0,
          exercise_count: exerciseCount || 0,
          training_days_count,
        };
      })
    );

    return NextResponse.json(transformedTemplates);
    
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
