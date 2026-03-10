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
            (await supabase
              .from("sessions")
              .select("id")
              .eq("plan_id", template.id)
            ).data?.map(s => s.id) || []
          );

        return {
          id: template.id,
          name: template.name,
          created_at: template.created_at,
          coach_id: template.coach_id,
          session_count: sessionCount || 0,
          exercise_count: exerciseCount || 0
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
