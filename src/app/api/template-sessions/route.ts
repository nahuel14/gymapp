import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();
    
    const {
      templateId,
      dayName,
      orderIndex,
      weekNumber
    } = await request.json();

    console.log("Insertando sesión:", {
      templateId,
      dayName,
      orderIndex,
      weekNumber
    });

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

    const payload = {
        plan_id: templateId,
        day_name: dayName,
        order_index: orderIndex,
        week_number: weekNumber,
        is_completed: false,
        date: null // Las plantillas no tienen fecha específica
      };
      
    console.log("Insertando sesión:", payload);

    // Add session to template
    const { data: session, error } = await adminClient
      .from("sessions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error insertando sesión:", error);
      throw error;
    }

    console.log("Sesión insertada exitosamente:", session);

    return NextResponse.json({ success: true, session });
    
  } catch (error) {
    console.error("Error adding session to template:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error },
      { status: 500 }
    );
  }
}
