import { createSupabaseServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const resolvedParams = await params;
    const templateId = Number(resolvedParams.id);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Check if user is ADMIN — admins can view any coach's template
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "ADMIN";

    // Get template with sessions and exercises
    let templateQuery = supabase
      .from("training_plans")
      .select(`
        id,
        name,
        created_at,
        coach_id,
        sessions (
          id,
          day_name,
          order_index,
          week_number,
          session_exercises (
            id,
            session_id,
            exercise_id,
            target_sets,
            target_reps,
            target_weight,
            target_rpe,
            rest_seconds,
            coach_notes,
            order_index,
            superset_group,
            exercises (
              id,
              name,
              body_zone,
              category
            )
          )
        )
      `)
      .eq("id", templateId)
      .eq("is_template", true);

    if (!isAdmin) {
      templateQuery = templateQuery.eq("coach_id", user.id);
    }

    const { data: template, error } = await templateQuery.single();

    if (error) {
      console.error("Error fetching template:", error);
      throw error;
    }
    
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json(template);
    
  } catch (error) {
    console.error("Error en GET template:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error },
      { status: 500 }
    );
  }
}

