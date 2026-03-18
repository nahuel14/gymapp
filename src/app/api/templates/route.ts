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

    // Get templates for this coach
    const { data: templates, error } = await supabase
      .from("training_plans")
      .select(`
        id,
        name,
        created_at,
        coach_id
      `)
      .eq("is_template", true)
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get session and exercise counts for each template
    const transformedTemplates = await Promise.all(
      (templates || []).map(async (template) => {
        const { data: templateSessions } = await supabase
          .from("sessions")
          .select("id, day_name")
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

        const distinctTrainingDays = new Set(
          (templateSessions || []).map((session) => {
            const normalizedDayName = (session.day_name || "").toLowerCase();
            if (normalizedDayName.includes("monday") || normalizedDayName.includes("lunes")) return 1;
            if (normalizedDayName.includes("tuesday") || normalizedDayName.includes("martes")) return 2;
            if (normalizedDayName.includes("wednesday") || normalizedDayName.includes("miércoles") || normalizedDayName.includes("miercoles")) return 3;
            if (normalizedDayName.includes("thursday") || normalizedDayName.includes("jueves")) return 4;
            if (normalizedDayName.includes("friday") || normalizedDayName.includes("viernes")) return 5;
            if (normalizedDayName.includes("saturday") || normalizedDayName.includes("sábado") || normalizedDayName.includes("sabado")) return 6;
            if (normalizedDayName.includes("sunday") || normalizedDayName.includes("domingo")) return 0;
            return normalizedDayName;
          })
        );

        return {
          id: template.id,
          name: template.name,
          created_at: template.created_at,
          coach_id: template.coach_id,
          session_count: sessionCount || 0,
          exercise_count: exerciseCount || 0,
          training_days_count: distinctTrainingDays.size
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
