 "use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function addWeekToPlan(planId: number, nextWeekNumber: number) {
  const supabase = await createSupabaseServerClient();

  // 1. Verificar permisos (opcional pero recomendado)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 2. Crear al menos un día por defecto en esa semana para que sea visible
  const { error } = await supabase
    .from("sessions")
    .insert({
      plan_id: planId,
      week_number: nextWeekNumber,
      day_name: "Monday",
      order_index: 1,
      is_completed: false
    });

  if (error) throw error;
  
  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function addDayToWeek(planId: number, weekNumber: number, nextOrderIndex: number, dayName: string = "Monday", date?: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("sessions")
    .insert({
      plan_id: planId,
      week_number: weekNumber,
      day_name: dayName,
      order_index: nextOrderIndex,
      is_completed: false,
      date: date || null
    } as any);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function duplicateSession(sessionId: number, targetDate: string) {
  const supabase = await createSupabaseServerClient();

  // 1. Obtener sesión original
  const { data: originalSession, error: fetchSessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchSessionError || !originalSession) throw new Error("No se encontró la sesión original");

  // 2. Crear nueva sesión
  const { data: newSession, error: createSessionError } = await supabase
    .from("sessions")
    .insert({
      plan_id: originalSession.plan_id,
      week_number: originalSession.week_number,
      day_name: originalSession.day_name,
      order_index: (originalSession.order_index ?? 0) + 1, // O alguna lógica de orden
      is_completed: false,
      date: targetDate
    } as any)
    .select()
    .single();

  if (createSessionError || !newSession) throw createSessionError;

  // 3. Obtener ejercicios originales
  const { data: exercises, error: fetchExError } = await supabase
    .from("session_exercises")
    .select("*")
    .eq("session_id", sessionId);

  if (fetchExError) throw fetchExError;

  // 4. Duplicar ejercicios
  if (exercises && exercises.length > 0) {
    const duplicatedExercises = exercises.map((ex: any) => ({
      session_id: newSession.id,
      exercise_id: ex.exercise_id,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      target_rpe: ex.target_rpe,
      rest_seconds: ex.rest_seconds,
      coach_notes: ex.coach_notes,
      order_index: ex.order_index
    }));

    const { error: insertExError } = await supabase
      .from("session_exercises")
      .insert(duplicatedExercises as any);

    if (insertExError) throw insertExError;
  }

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true, newSessionId: newSession.id };
}

export async function duplicatePlan(planId: number, targetStudentId?: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // 1. Obtener plan original
  const { data: originalPlan, error: fetchPlanError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (fetchPlanError || !originalPlan) throw new Error("No se encontró el plan original");

  // 2. Crear nuevo plan
  const { data: newPlan, error: createPlanError } = await adminClient
    .from("training_plans")
    .insert({
      name: targetStudentId ? originalPlan.name : `${originalPlan.name} (Copia)`,
      coach_id: originalPlan.coach_id,
      student_id: targetStudentId || null,
      is_active: !!targetStudentId,
      is_template: !targetStudentId,
      start_date: originalPlan.start_date
    } as any)
    .select()
    .single();

  if (createPlanError || !newPlan) throw createPlanError;

  // 3. Obtener sesiones originales
  const { data: sessions, error: fetchSessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("plan_id", planId);

  if (fetchSessionsError) throw fetchSessionsError;

  // 4. Duplicar sesiones y sus ejercicios en cascada
  for (const session of (sessions || [])) {
    const s = session as any;
    const { data: newSession, error: sErr } = await adminClient
      .from("sessions")
      .insert({
        plan_id: newPlan.id,
        week_number: s.week_number,
        day_name: s.day_name,
        order_index: s.order_index,
        is_completed: false,
        date: s.date
      } as any)
      .select()
      .single();

    if (sErr || !newSession) continue;

    const { data: exercises } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("session_id", session.id);

    if (exercises && exercises.length > 0) {
      const duplicatedEx = exercises.map((ex: any) => ({
        session_id: newSession.id,
        exercise_id: ex.exercise_id,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight: ex.target_weight,
        target_rpe: ex.target_rpe,
        rest_seconds: ex.rest_seconds,
        coach_notes: ex.coach_notes,
        order_index: ex.order_index
      }));

      await adminClient.from("session_exercises").insert(duplicatedEx as any);
    }
  }

  revalidatePath("/coach");
  revalidatePath("/coach/student/[studentId]", "page");
  return { success: true, newPlanId: newPlan.id };
}

export async function addExerciseToSession(
  sessionId: number, 
  exerciseId: number, 
  targetSets: number, 
  targetReps: number[], 
  targetWeight: (number | null)[],
  targetRpe: number, 
  rest: number, 
  notes: string
) {
  const supabase = await createSupabaseServerClient();

  // Obtener el último order_index
  const { data: existing } = await supabase
    .from("session_exercises")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;

  const { error } = await supabase
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
    } as any);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function deleteExerciseFromSession(exerciseSessionId: number) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("session_exercises")
    .delete()
    .eq("id", exerciseSessionId);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function createTrainingPlan(studentId: string, planName: string, startDate: string) {
  // 1. Cliente normal: Lee las cookies y averigua quién está logueado
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) throw new Error("No autenticado");

  // 2. Cliente administrador: Usa la llave maestra para saltar la seguridad (RLS)
  const supabaseAdmin = createSupabaseAdminClient();

  // Desactivar planes anteriores del estudiante
  await supabaseAdmin
    .from("training_plans")
    .update({ is_active: false } as any)
    .eq("student_id", studentId as any);

  // Insertar nuevo plan
  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id, // Acá usamos el ID que sacamos en el paso 1
      name: planName,
      start_date: startDate,
      is_active: true
    } as any)
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/coach");
  return { success: true, planId: plan.id };
}

export async function updateExerciseInSession(
  id: number, 
  data: { 
    target_sets?: number; 
    target_reps?: number[]; 
    target_weight?: (number | null)[];
    target_rpe?: number; 
    rest_seconds?: number; 
    coach_notes?: string;
    actual_sets?: number;
    actual_reps?: number[];
    actual_weight?: (number | null)[];
    actual_rpe?: number;
    student_notes?: string;
  }
) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("session_exercises")
    .update(data as any)
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}
