import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
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

    // Get template with sessions and exercises - SIN columnas que no existen
    const { data: template, error } = await supabase
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
            exercise_id,
            target_sets,
            target_reps,
            target_weight,
            target_rpe,
            rest_seconds,
            coach_notes,
            order_index,
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
      .eq("is_template", true)
      .eq("coach_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching template:", error);
      throw error;
    }
    
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    console.log("Template fetched successfully:", template);
    return NextResponse.json(template);
    
  } catch (error) {
    console.error("Error en GET template:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const templateId = Number(params.id);
    const { name } = await request.json();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Update template name
    const { data: template, error } = await supabase
      .from("training_plans")
      .update({ name })
      .eq("id", templateId)
      .eq("coach_id", user.id)
      .eq("is_template", true)
      .select()
      .single();

    if (error) throw error;
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json(template);
    
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
