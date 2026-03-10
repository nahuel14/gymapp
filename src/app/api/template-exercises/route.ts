import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();
    
    const {
      templateId,
      sessionId,
      exerciseId,
      targetSets,
      targetReps,
      targetWeight,
      targetRpe,
      rest,
      notes
    } = await request.json();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verify template ownership
    const { data: template, error: templateError } = await supabase
      .from("training_plans")
      .select("coach_id")
      .eq("id", templateId)
      .eq("is_template", true)
      .single();

    if (templateError || !template || template.coach_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Get next order index for the session
    const { data: existing } = await supabase
      .from("session_exercises")
      .select("order_index")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;

    // Add exercise to session
    const { data: exercise, error } = await adminClient
      .from("session_exercises")
      .insert({
        session_id: sessionId,
        exercise_id: exerciseId,
        target_sets: targetSets,
        target_reps: targetReps,
        target_weight: targetWeight,
        target_rpe: targetRpe,
        rest_seconds: rest,
        coach_notes: notes,
        order_index: nextOrder
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, exercise });
    
  } catch (error) {
    console.error("Error adding exercise to template:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
