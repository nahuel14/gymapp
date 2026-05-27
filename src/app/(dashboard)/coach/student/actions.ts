"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/supabase";

// --- Helpers de fechas y validación de colisiones ---

function normalizeToMonday(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

function calcEndDate(mondayStr: string, weeks: number): string {
  const start = new Date(mondayStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(weeks, 1) * 7 - 1);
  return end.toISOString().split("T")[0];
}

async function assertNoPlanCollision(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string,
  newStart: string,
  newEnd: string
): Promise<void> {
  const { data: overlapping, error } = await adminClient
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("student_id", studentId as any)
    .eq("is_template", false as any)
    .eq("is_active", true as any)
    .not("end_date", "is", null)
    .lte("start_date", newEnd)
    .gte("end_date", newStart);

  if (error) throw error;

  if (overlapping && overlapping.length > 0) {
    const conflict = overlapping[0] as any;
    throw new Error(
      `PLAN_COLLISION:El período ${newStart}–${newEnd} se superpone con el plan "${conflict.name}" (${conflict.start_date} — ${conflict.end_date}).`
    );
  }
}

// --- Fin helpers ---

export async function addWeekToPlan(planId: number, nextWeekNumber: number) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

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

  const { data: originalSession, error: fetchSessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchSessionError || !originalSession) throw new Error("No se encontró la sesión original");

  const { data: newSession, error: createSessionError } = await supabase
    .from("sessions")
    .insert({
      plan_id: originalSession.plan_id,
      week_number: originalSession.week_number,
      day_name: originalSession.day_name,
      order_index: (originalSession.order_index ?? 0) + 1,
      is_completed: false,
      date: targetDate
    } as any)
    .select()
    .single();

  if (createSessionError || !newSession) throw createSessionError;

  const { data: exercises, error: fetchExError } = await supabase
    .from("session_exercises")
    .select("*")
    .eq("session_id", sessionId);

  if (fetchExError) throw fetchExError;

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

// NUEVA FUNCIÓN: Mover sesión a otro día
export async function moveSession(sessionId: number, newDate: string) {
  const supabase = await createSupabaseServerClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("plan_id")
    .eq("id", sessionId)
    .single();

  if (!session || !session.plan_id) throw new Error("Sesión o plan no encontrado");

  // Validar que no haya ya una sesión en esa fecha para este plan
  const { data: existingSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("plan_id", session.plan_id)
    .eq("date", newDate)
    .maybeSingle();

  if (existingSession) throw new Error("Ya existe un entrenamiento en esta fecha. Selecciona un día libre.");

  const { error } = await supabase
    .from("sessions")
    .update({ date: newDate } as any)
    .eq("id", sessionId);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function duplicatePlan(planId: number, targetStudentId?: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: originalPlan, error: fetchPlanError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (fetchPlanError || !originalPlan) throw new Error("No se encontró el plan original");

  const { data: newPlan, error: createPlanError } = await adminClient
    .from("training_plans")
    .insert({
      name: targetStudentId ? originalPlan.name : `${originalPlan.name} (Copia)`,
      coach_id: originalPlan.coach_id,
      student_id: targetStudentId || null,
      is_active: !!targetStudentId,
      is_template: !targetStudentId,
      start_date: originalPlan.start_date,
      end_date: (originalPlan as any).end_date || null
    } as any)
    .select()
    .single();

  if (createPlanError || !newPlan) throw createPlanError;

  const { data: sessions, error: fetchSessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("plan_id", planId);

  if (fetchSessionsError) throw fetchSessionsError;

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

export async function deleteDayFromPlan(sessionId: number) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error: exercisesError } = await adminClient
    .from("session_exercises")
    .delete()
    .eq("session_id", sessionId);

  if (exercisesError) throw exercisesError;

  const { error: sessionError } = await adminClient
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  revalidatePath("/coach/templates/[id]", "page");
  revalidatePath("/coach/templates/[id]/edit", "page");
  return { success: true };
}

export async function createTrainingPlan(
  studentId: string,
  planName: string,
  startDate: string,
  durationWeeks: number = 4
) {
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) throw new Error("No autenticado");
  const supabaseAdmin = createSupabaseAdminClient();

  const normalizedStart = normalizeToMonday(startDate);
  const endDateStr = calcEndDate(normalizedStart, durationWeeks);

  await assertNoPlanCollision(supabaseAdmin, studentId, normalizedStart, endDateStr);

  await supabaseAdmin
    .from("training_plans")
    .update({ is_active: false } as any)
    .eq("student_id", studentId as any);

  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: planName,
      start_date: normalizedStart,
      end_date: endDateStr,
      is_active: true
    } as any)
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/coach");
  return {
    success: true,
    planId: plan.id,
    durationWeeks,
    endDate: endDateStr
  };
}

export async function createBlankPlan(
  studentId: string,
  planName: string,
  startDate: string,
  weeksCount: number = 4
) {
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) throw new Error("No autenticado");
  const supabaseAdmin = createSupabaseAdminClient();

  const normalizedStart = normalizeToMonday(startDate);
  const endDateStr = calcEndDate(normalizedStart, weeksCount);

  await assertNoPlanCollision(supabaseAdmin, studentId, normalizedStart, endDateStr);

  await supabaseAdmin
    .from("training_plans")
    .update({ is_active: false } as any)
    .eq("student_id", studentId as any);

  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: planName,
      start_date: normalizedStart,
      end_date: endDateStr,
      is_active: true
    } as any)
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/coach");
  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");

  return {
    success: true,
    planId: plan.id,
    weeksCount,
    endDate: endDateStr
  };
}

export async function createTemplatePlan(planName: string, coachId: string) {
  const adminClient = createSupabaseAdminClient();

  try {
    const payload = {
      name: planName,
      coach_id: coachId,
      student_id: null,
      is_active: false,
      start_date: null,
      is_template: true 
    };
    
    const { data: template, error } = await adminClient
      .from("training_plans")
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/coach/templates");
    return { success: true, templateId: template.id };
  } catch (error) {
    console.error("Error creating template:", error);
    throw error;
  }
}

export async function deleteTemplatePlan(templateId: number) {
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: sessions, error: sessionsError } = await adminClient
      .from("sessions")
      .select("id")
      .eq("plan_id", templateId);

    if (sessionsError) throw sessionsError;

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const { error: exercisesError } = await adminClient
        .from("session_exercises")
        .delete()
        .in("session_id", sessionIds);

      if (exercisesError) throw exercisesError;
    }

    const { error: deleteSessionsError } = await adminClient
      .from("sessions")
      .delete()
      .eq("plan_id", templateId);

    if (deleteSessionsError) throw deleteSessionsError;

    const { error } = await adminClient
      .from("training_plans")
      .delete()
      .eq("id", templateId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/coach/templates");
    return { success: true };
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
}

export async function instantiateTemplateToStudent(
  templatePlanId: number,
  studentId: string,
  startDate: string,
  preferredDaysOfWeek: number[]
) {
  if (preferredDaysOfWeek.length === 0) throw new Error("Debes seleccionar al menos un día de entrenamiento");

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // --- Fase 1: todas las lecturas antes de cualquier escritura ---

    const { data: templatePlan, error: fetchTemplateError } = await supabase
      .from("training_plans")
      .select("*")
      .eq("id", templatePlanId)
      .eq("is_template", true)
      .single();

    if (fetchTemplateError || !templatePlan) throw new Error("No se encontró la plantilla");

    const { data: templateSessions, error: fetchSessionsError } = await supabase
      .from("sessions")
      .select("*")
      .eq("plan_id", templatePlanId)
      .order("week_number", { ascending: true })
      .order("order_index", { ascending: true });

    if (fetchSessionsError) throw fetchSessionsError;

    const normalizedStart = normalizeToMonday(startDate);

    // Pre-computar las fechas de sesión para determinar end_date antes de escribir
    const sessionDates: string[] = [];
    let currentDate = new Date(normalizedStart + "T00:00:00");

    for (let i = 0; i < (templateSessions?.length || 0); i++) {
      while (!preferredDaysOfWeek.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      sessionDates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // end_date = domingo de la semana que contiene la última sesión
    let endDateStr = calcEndDate(normalizedStart, 1);
    if (sessionDates.length > 0) {
      const lastDate = new Date(sessionDates[sessionDates.length - 1] + "T00:00:00");
      const lastDay = lastDate.getDay();
      const diffToSunday = lastDay === 0 ? 0 : 7 - lastDay;
      lastDate.setDate(lastDate.getDate() + diffToSunday);
      endDateStr = lastDate.toISOString().split("T")[0];
    }

    await assertNoPlanCollision(adminClient, studentId, normalizedStart, endDateStr);

    // --- Fase 2: escrituras ---

    await adminClient
      .from("training_plans")
      .update({ is_active: false } as any)
      .eq("student_id", studentId);

    const { data: newPlan, error: createPlanError } = await adminClient
      .from("training_plans")
      .insert({
        name: templatePlan.name,
        coach_id: templatePlan.coach_id,
        student_id: studentId,
        is_active: true,
        is_template: false,
        start_date: normalizedStart,
        end_date: endDateStr
      } as any)
      .select()
      .single();

    if (createPlanError || !newPlan) throw createPlanError;

    const newSessionIds: number[] = [];

    for (let i = 0; i < (templateSessions?.length || 0); i++) {
      const templateSession = templateSessions![i];

      const { data: newSession, error: sessionError } = await adminClient
        .from("sessions")
        .insert({
          plan_id: newPlan.id,
          week_number: templateSession.week_number,
          day_name: templateSession.day_name,
          order_index: templateSession.order_index,
          is_completed: false,
          date: sessionDates[i]
        } as any)
        .select()
        .single();

      if (sessionError || !newSession) throw sessionError;
      newSessionIds.push(newSession.id);
    }

    for (let i = 0; i < templateSessions!.length; i++) {
      const templateSessionId = templateSessions![i].id;
      const newSessionId = newSessionIds[i];

      const { data: templateExercises } = await supabase
        .from("session_exercises")
        .select("*")
        .eq("session_id", templateSessionId);

      if (templateExercises && templateExercises.length > 0) {
        const duplicatedExercises = templateExercises.map((ex: any) => ({
          session_id: newSessionId,
          exercise_id: ex.exercise_id,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          target_rpe: ex.target_rpe,
          rest_seconds: ex.rest_seconds,
          coach_notes: ex.coach_notes,
          order_index: ex.order_index
        }));

        await adminClient.from("session_exercises").insert(duplicatedExercises as any);
      }
    }

    revalidatePath("/coach/student/[studentId]", "page");
    revalidatePath("/student", "page");

    return { success: true, planId: newPlan.id };

  } catch (error) {
    throw error;
  }
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

export async function updateTemplatePlan(templateId: number, name: string) {
  const adminClient = createSupabaseAdminClient();

  try {
    const { error } = await adminClient
      .from("training_plans")
      .update({ name: name })
      .eq("id", templateId)
      .eq("is_template", true);

    if (error) throw error;

    revalidatePath("/coach/templates");
    revalidatePath(`/coach/templates/${templateId}/edit`);
    return { success: true };

  } catch (error) {
    console.error("Error en updateTemplatePlan:", error);
    throw error;
  }
}

export async function importTemplateToStudent(
  studentId: string,
  templateId: number,
  startDate: string,
  selectedDays: number[],
  planName?: string
) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  if (!startDate) throw new Error("La fecha de inicio es obligatoria");
  if (!selectedDays.length) throw new Error("Debes seleccionar al menos un día");

  const normalizedDays = [...selectedDays].sort((a, b) => {
    const normalizedA = a === 0 ? 7 : a;
    const normalizedB = b === 0 ? 7 : b;
    return normalizedA - normalizedB;
  });

  const { data: templatePlan, error: templateError } = await adminClient
    .from("training_plans")
    .select("*")
    .eq("id", templateId)
    .eq("is_template", true)
    .single();

  if (templateError || !templatePlan) throw new Error("No se encontró la plantilla");

  const { data: templateSessions, error: templateSessionsError } = await adminClient
    .from("sessions")
    .select("*")
    .eq("plan_id", templateId)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  if (templateSessionsError) throw templateSessionsError;

  if (!templateSessions || templateSessions.length === 0) {
    throw new Error("La plantilla seleccionada no tiene sesiones. Agregá sesiones a la plantilla antes de importarla.");
  }

  const normalizedStart = normalizeToMonday(startDate);
  const monday = new Date(normalizedStart + "T00:00:00");

  // Pre-computar fechas de sesión por semana
  const sessionsByTemplateWeek = new Map<number, any[]>();
  for (const session of templateSessions) {
    const weekNumber = session.week_number || 1;
    if (!sessionsByTemplateWeek.has(weekNumber)) {
      sessionsByTemplateWeek.set(weekNumber, []);
    }
    sessionsByTemplateWeek.get(weekNumber)!.push(session);
  }

  // Calcular todas las fechas para determinar end_date antes de escribir
  const sessionDateMap = new Map<number, string>(); // templateSession.id → date
  const allDates: string[] = [];

  for (const [templateWeek, weekSessions] of sessionsByTemplateWeek.entries()) {
    const sortedSessions = [...weekSessions].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const weekMonday = new Date(monday);
    weekMonday.setDate(monday.getDate() + (templateWeek - 1) * 7);

    for (let index = 0; index < sortedSessions.length; index++) {
      const templateSession = sortedSessions[index];
      const selectedDay = normalizedDays[index % normalizedDays.length];
      const dayOffset = selectedDay === 0 ? 6 : selectedDay - 1;
      const sessionDate = new Date(weekMonday);
      sessionDate.setDate(weekMonday.getDate() + dayOffset);
      const formattedDate = sessionDate.toISOString().split("T")[0];
      sessionDateMap.set(templateSession.id, formattedDate);
      allDates.push(formattedDate);
    }
  }

  // end_date = domingo de la semana de la última sesión
  const lastDate = new Date(allDates.sort().at(-1)! + "T00:00:00");
  const lastDay = lastDate.getDay();
  lastDate.setDate(lastDate.getDate() + (lastDay === 0 ? 0 : 7 - lastDay));
  const endDateStr = lastDate.toISOString().split("T")[0];

  await assertNoPlanCollision(adminClient, studentId, normalizedStart, endDateStr);

  // Desactivar todos los planes activos del alumno antes de crear el nuevo
  await adminClient
    .from("training_plans")
    .update({ is_active: false } as any)
    .eq("student_id", studentId as any);

  const { data: newPlan, error: createPlanError } = await adminClient
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: (planName?.trim() || templatePlan.name),
      start_date: normalizedStart,
      end_date: endDateStr,
      is_active: true,
      is_template: false
    } as any)
    .select()
    .single();

  if (createPlanError || !newPlan) throw createPlanError ?? new Error("No se pudo crear el plan");

  const createdSessionIds = new Map<number, number>();

  for (const [templateWeek, weekSessions] of sessionsByTemplateWeek.entries()) {
    const sortedSessions = [...weekSessions].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    for (const templateSession of sortedSessions) {
      const formattedDate = sessionDateMap.get(templateSession.id)!;

      const { data: insertedSession, error: insertedSessionError } = await adminClient
        .from("sessions")
        .insert({
          plan_id: newPlan.id,
          week_number: templateWeek,
          day_name: templateSession.day_name,
          order_index: templateSession.order_index,
          is_completed: false,
          date: formattedDate
        } as any)
        .select()
        .single();

      if (insertedSessionError || !insertedSession) throw insertedSessionError ?? new Error("No se pudo crear la sesión");
      createdSessionIds.set(templateSession.id, insertedSession.id);
    }
  }

  for (const templateSession of templateSessions) {
    const newSessionId = createdSessionIds.get(templateSession.id);
    if (!newSessionId) continue;

    const { data: templateExercises, error: templateExercisesError } = await adminClient
      .from("session_exercises")
      .select("*")
      .eq("session_id", templateSession.id)
      .order("order_index", { ascending: true });

    if (templateExercisesError) throw templateExercisesError;

    if (templateExercises && templateExercises.length > 0) {
      const payload = templateExercises.map((exercise: any) => ({
        session_id: newSessionId,
        exercise_id: exercise.exercise_id,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_reps,
        target_weight: exercise.target_weight,
        target_rpe: exercise.target_rpe,
        rest_seconds: exercise.rest_seconds,
        coach_notes: exercise.coach_notes,
        order_index: exercise.order_index
      }));

      const { error: insertExercisesError } = await adminClient
        .from("session_exercises")
        .insert(payload as any);

      if (insertExercisesError) throw insertExercisesError;
    }
  }

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");

  return { success: true, planId: newPlan.id };
}

export async function extendPlan(planId: number, additionalWeeks: number) {
  if (additionalWeeks < 1) throw new Error("Debe agregar al menos 1 semana");

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: plan, error: fetchError } = await adminClient
    .from("training_plans")
    .select("id, name, start_date, end_date, student_id")
    .eq("id", planId)
    .single();

  if (fetchError || !plan) throw new Error("No se encontró el plan");

  const currentEnd = (plan as any).end_date as string | null;
  if (!currentEnd) throw new Error("El plan no tiene fecha de fin definida");

  // New end = current end + N weeks, snapped to Sunday
  const newEnd = new Date(currentEnd + "T00:00:00");
  newEnd.setDate(newEnd.getDate() + additionalWeeks * 7);
  const dow = newEnd.getDay();
  if (dow !== 0) newEnd.setDate(newEnd.getDate() + (7 - dow));
  const newEndStr = newEnd.toISOString().split("T")[0];

  // Check for OTHER plans of this student that start after the current end (would now collide)
  const { data: overlapping, error: colError } = await adminClient
    .from("training_plans")
    .select("id, name, start_date")
    .eq("student_id", (plan as any).student_id as any)
    .eq("is_template", false as any)
    .neq("id", planId)
    .not("end_date", "is", null)
    .gt("start_date", currentEnd);

  if (colError) throw colError;

  if (overlapping && overlapping.length > 0) {
    const conflict = overlapping[0] as any;
    throw new Error(
      `No se puede extender: el plan "${conflict.name}" comienza el ${conflict.start_date}.`
    );
  }

  const { error: updateError } = await adminClient
    .from("training_plans")
    .update({ end_date: newEndStr } as any)
    .eq("id", planId);

  if (updateError) throw updateError;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");

  return { success: true, newEndDate: newEndStr };
}

export async function createInlineExercise(data: { name: string; body_zone: string; category: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: newExercise, error } = await supabase
    .from("exercises")
    .insert([{
      name: data.name.trim(),
      body_zone: data.body_zone || null,
      category: data.category || null,
    }] as any)
    .select()
    .single();

  if (error) {
    console.error("Error creating inline exercise:", error);
    throw new Error("No se pudo crear el ejercicio");
  }

  revalidatePath("/coach/library");
  return newExercise;
}