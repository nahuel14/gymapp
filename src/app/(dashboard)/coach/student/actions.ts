"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { getMonday, calcEndDateLocal } from "@/lib/plans/dates";
import { parseDayNumber } from "@/lib/templates/structure";
// --- Helpers de fechas y validación de colisiones ---

const normalizeToMonday = getMonday;
const calcEndDate = calcEndDateLocal;

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

async function assertNoPlanCollisionExcluding(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  studentId: string,
  newStart: string,
  newEnd: string,
  excludePlanId: number
): Promise<void> {
  const { data: overlapping, error } = await adminClient
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("student_id", studentId as any)
    .eq("is_template", false as any)
    .neq("id", excludePlanId)
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

export async function addDayToWeek(planId: number, weekNumber: number, nextOrderIndex: number, dayName: string = "Monday", date?: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await adminClient
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminClient = createSupabaseAdminClient();

  const { data: originalSession, error: fetchSessionError } = await adminClient
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchSessionError || !originalSession) throw new Error("No se encontró la sesión original");

  const { data: existingOnDate } = await adminClient
    .from("sessions")
    .select("id")
    .eq("plan_id", (originalSession as any).plan_id)
    .eq("date", targetDate)
    .limit(1);

  if (existingOnDate && existingOnDate.length > 0) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }

  const { data: newSession, error: createSessionError } = await adminClient
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

  const { data: exercises, error: fetchExError } = await adminClient
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
      order_index: ex.order_index,
      superset_group: ex.superset_group ?? null,
    }));

    const { error: insertExError } = await adminClient
      .from("session_exercises")
      .insert(duplicatedExercises as any);

    if (insertExError) throw insertExError;
  }

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true, newSessionId: newSession.id };
}

export async function moveSession(sessionId: number, newDate: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminClient = createSupabaseAdminClient();

  const { data: session } = await adminClient
    .from("sessions")
    .select("plan_id")
    .eq("id", sessionId)
    .single();

  if (!session || !session.plan_id) throw new Error("Sesión o plan no encontrado");

  const { data: plan } = await adminClient
    .from("training_plans")
    .select("start_date, end_date")
    .eq("id", (session as any).plan_id)
    .single();

  if (!plan) throw new Error("Plan no encontrado");

  const startDate: string | null = (plan as any).start_date;
  const endDate: string | null = (plan as any).end_date;
  if (startDate && newDate < startDate) throw new Error("La fecha está fuera del rango del plan.");
  if (endDate && newDate > endDate) throw new Error("La fecha está fuera del rango del plan.");

  const { data: existingSession } = await adminClient
    .from("sessions")
    .select("id")
    .eq("plan_id", (session as any).plan_id)
    .eq("date", newDate)
    .maybeSingle();

  if (existingSession) throw new Error("Ya existe un entrenamiento en esa fecha.");

  const { error } = await adminClient
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

  const { data: sessions, error: fetchSessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("plan_id", planId);

  if (fetchSessionsError) throw fetchSessionsError;

  // Al crear una plantilla, validar que todas las semanas tengan el mismo nº de días
  if (!targetStudentId) {
    const weekCounts = new Map<number, number>();
    for (const s of (sessions ?? []) as any[]) {
      weekCounts.set(s.week_number, (weekCounts.get(s.week_number) ?? 0) + 1);
    }
    const counts = [...weekCounts.values()];
    if (counts.length > 1 && !counts.every(c => c === counts[0])) {
      const detail = [...weekCounts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([wk, n]) => `Semana ${wk}: ${n} ${n === 1 ? 'día' : 'días'}`)
        .join(', ');
      throw new Error(
        `TEMPLATE_NON_UNIFORM:Para exportar como plantilla todas las semanas deben tener la misma cantidad de días. ${detail}.`
      );
    }
  }

  const { data: newPlan, error: createPlanError } = await adminClient
    .from("training_plans")
    .insert({
      name: targetStudentId ? originalPlan.name : `${originalPlan.name} (Copia)`,
      coach_id: originalPlan.coach_id,
      student_id: targetStudentId || null,
      is_template: !targetStudentId,
      start_date: originalPlan.start_date,
      end_date: (originalPlan as any).end_date || null
    } as any)
    .select()
    .single();

  if (createPlanError || !newPlan) throw createPlanError;

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
        order_index: ex.order_index,
        superset_group: ex.superset_group ?? null,
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

export async function deletePlan(planId: number) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: planSessions } = await adminClient
    .from("sessions")
    .select("id")
    .eq("plan_id", planId);

  if (planSessions && planSessions.length > 0) {
    const sessionIds = planSessions.map((s: any) => s.id);
    await adminClient.from("session_exercises").delete().in("session_id", sessionIds);
    await adminClient.from("sessions").delete().in("id", sessionIds);
  }

  const { error } = await adminClient.from("training_plans").delete().eq("id", planId);
  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
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

  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: planName,
      start_date: normalizedStart,
      end_date: endDateStr,
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

  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: planName,
      start_date: normalizedStart,
      end_date: endDateStr,
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
      start_date: null,
      is_template: true,
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
    const currentDate = new Date(normalizedStart + "T00:00:00");

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

    const { data: newPlan, error: createPlanError } = await adminClient
      .from("training_plans")
      .insert({
        name: templatePlan.name,
        coach_id: templatePlan.coach_id,
        student_id: studentId,
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
          order_index: ex.order_index,
          superset_group: ex.superset_group ?? null,
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
    actual_rpe?: number | null;
    student_notes?: string;
  }
) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("session_exercises")
    .update(data as any)
    .eq("id", id);

  if (error) throw error;

  // Marcar sesión como completada cuando el alumno guarda datos reales
  if (data.actual_sets && data.actual_sets > 0) {
    const { data: exercise } = await supabase
      .from("session_exercises")
      .select("session_id")
      .eq("id", id)
      .single();

    if (exercise?.session_id) {
      await supabase
        .from("sessions")
        .update({ is_completed: true } as any)
        .eq("id", (exercise as any).session_id);
    }
  }

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

  const { data: newPlan, error: createPlanError } = await adminClient
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id,
      name: (planName?.trim() || templatePlan.name),
      start_date: normalizedStart,
      end_date: endDateStr,
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
        order_index: exercise.order_index,
        superset_group: exercise.superset_group ?? null,
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

export async function updatePlanMeta(
  planId: number,
  data: {
    name?: string;
    start_date?: string;
    end_date?: string;
  }
) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: plan, error: fetchError } = await adminClient
    .from("training_plans")
    .select("id, student_id, start_date, end_date")
    .eq("id", planId)
    .single();

  if (fetchError || !plan) throw new Error("Plan no encontrado");

  const updates: any = {};
  if (data.name !== undefined) updates.name = data.name.trim();

  const currentStart = (plan as any).start_date as string;
  const currentEnd = (plan as any).end_date as string | null;
  const newStart = data.start_date ? normalizeToMonday(data.start_date) : currentStart;
  const newEnd = data.end_date ?? currentEnd ?? "";

  // 1. Collision check first — before any mutation
  if ((data.start_date !== undefined || data.end_date !== undefined) && newStart && newEnd) {
    await assertNoPlanCollisionExcluding(adminClient, (plan as any).student_id, newStart, newEnd, planId);
  }

  // 2. Start-date change: shift all sessions by the same offset
  if (data.start_date !== undefined && newStart !== currentStart) {
    const offsetDays = Math.round(
      (new Date(newStart + "T00:00:00").getTime() - new Date(currentStart + "T00:00:00").getTime())
      / (1000 * 60 * 60 * 24)
    );

    const { data: existingSessions } = await adminClient
      .from("sessions")
      .select("id, date")
      .eq("plan_id", planId)
      .not("date", "is", null);

    // Verify no shifted session lands outside the new end_date
    if (newEnd) {
      const outsideAfterShift = (existingSessions ?? []).some(s => {
        const d = new Date((s as any).date + "T00:00:00");
        d.setDate(d.getDate() + offsetDays);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const dy = String(d.getDate()).padStart(2, "0");
        return `${y}-${mo}-${dy}` > newEnd;
      });
      if (outsideAfterShift) {
        throw new Error("No se puede desplazar: alguna sesión quedaría fuera del nuevo rango. Reducí las semanas después de cambiar el inicio.");
      }
    }

    for (const session of existingSessions ?? []) {
      const d = new Date((session as any).date + "T00:00:00");
      d.setDate(d.getDate() + offsetDays);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const dy = String(d.getDate()).padStart(2, "0");
      await adminClient
        .from("sessions")
        .update({ date: `${y}-${mo}-${dy}` } as any)
        .eq("id", session.id);
    }
  }
  if (data.start_date !== undefined) updates.start_date = newStart;

  // 3. End-date reduction: only when start is NOT changing
  // (when start changes, sessions are pre-validated and shifted above)
  if (data.end_date !== undefined) {
    if (data.start_date === undefined && currentEnd && newEnd < currentEnd) {
      const { data: sessionsOutside } = await adminClient
        .from("sessions")
        .select("id")
        .eq("plan_id", planId)
        .gt("date", newEnd)
        .limit(1);
      if (sessionsOutside && sessionsOutside.length > 0) {
        throw new Error("No se puede reducir el plan: hay sesiones fuera del nuevo rango. Eliminá esas sesiones primero.");
      }
    }
    updates.end_date = newEnd;
  }

  // 4. Persist plan changes
  const { error } = await adminClient
    .from("training_plans")
    .update(updates)
    .eq("id", planId);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function setSuperset(sourceId: number, targetId: number, sessionId: number) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: exercises } = await adminClient
    .from("session_exercises")
    .select("id, superset_group")
    .eq("session_id", sessionId as any)
    .in("id", [sourceId, targetId]);

  const ex1 = (exercises ?? []).find((e: any) => e.id === sourceId) as any;
  const ex2 = (exercises ?? []).find((e: any) => e.id === targetId) as any;

  if (!ex1 || !ex2) throw new Error("Ejercicios no encontrados");

  let groupNumber: number;
  if (ex1.superset_group !== null && ex1.superset_group !== undefined) {
    groupNumber = ex1.superset_group;
  } else if (ex2.superset_group !== null && ex2.superset_group !== undefined) {
    groupNumber = ex2.superset_group;
  } else {
    const { data: allEx } = await adminClient
      .from("session_exercises")
      .select("superset_group")
      .eq("session_id", sessionId as any);
    const maxGroup = Math.max(0, ...((allEx ?? []).map((e: any) => e.superset_group ?? 0)));
    groupNumber = maxGroup + 1;
  }

  const groupsToMerge = [ex1.superset_group, ex2.superset_group].filter(
    (g): g is number => g !== null && g !== undefined && g !== groupNumber
  );

  await Promise.all([
    adminClient.from("session_exercises").update({ superset_group: groupNumber } as any).eq("id", sourceId),
    adminClient.from("session_exercises").update({ superset_group: groupNumber } as any).eq("id", targetId),
  ]);

  for (const oldGroup of groupsToMerge) {
    await (adminClient as any)
      .from("session_exercises")
      .update({ superset_group: groupNumber })
      .eq("session_id", sessionId)
      .eq("superset_group", oldGroup);
  }

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function removeFromSuperset(exerciseId: number) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await adminClient
    .from("session_exercises")
    .update({ superset_group: null } as any)
    .eq("id", exerciseId);

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function reorderSessionItem(
  sessionId: number,
  exerciseId: number | null,
  supersetGroup: number | null,
  direction: 'up' | 'down'
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminClient = createSupabaseAdminClient();

  const { data: exercises, error } = await adminClient
    .from("session_exercises")
    .select("id, order_index, superset_group")
    .eq("session_id", sessionId as any)
    .order("order_index", { ascending: true });

  if (error) throw error;
  if (!exercises || exercises.length === 0) return { success: true };

  // Build render blocks identical to frontend grouping logic
  type Block =
    | { type: 'standalone'; ex: any }
    | { type: 'superset'; group: number; exs: any[] };

  const blocks: Block[] = [];
  const seenGroups = new Set<number>();

  for (const ex of exercises as any[]) {
    const group = ex.superset_group as number | null;
    if (group === null || group === undefined) {
      blocks.push({ type: 'standalone', ex });
    } else if (!seenGroups.has(group)) {
      seenGroups.add(group);
      blocks.push({
        type: 'superset',
        group,
        exs: (exercises as any[]).filter(e => (e as any).superset_group === group),
      });
    }
  }

  // Find the block to move
  const blockIdx = exerciseId !== null
    ? blocks.findIndex(b => b.type === 'standalone' && (b as any).ex.id === exerciseId)
    : blocks.findIndex(b => b.type === 'superset' && (b as any).group === supersetGroup);

  if (blockIdx === -1) return { success: true };

  const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) return { success: true };

  // Swap blocks
  [blocks[blockIdx], blocks[targetIdx]] = [blocks[targetIdx], blocks[blockIdx]];

  // Flatten and reassign sequential order_indices
  let idx = 1;
  for (const block of blocks) {
    if (block.type === 'standalone') {
      await adminClient
        .from("session_exercises")
        .update({ order_index: idx++ } as any)
        .eq("id", (block as any).ex.id);
    } else {
      for (const ex of (block as any).exs) {
        await adminClient
          .from("session_exercises")
          .update({ order_index: idx++ } as any)
          .eq("id", ex.id);
      }
    }
  }

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function createInlineExercise(data: { name: string; body_zone: string; exercise_type?: "REPS" | "TIME" }) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: newExercise, error } = await supabase
    .from("exercises")
    .insert([{
      name: data.name.trim(),
      body_zone: data.body_zone || null,
      exercise_type: data.exercise_type ?? "REPS",
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

// ─── Template structure actions (uniform weeks × days) ───────────────────────

export async function addDayToAllWeeks(planId: number) {
  const adminClient = createSupabaseAdminClient();

  const { data: sessions, error } = await adminClient
    .from("sessions")
    .select("id, week_number, day_name, order_index")
    .eq("plan_id", planId as any)
    .order("order_index", { ascending: true });

  if (error) throw error;

  const allSessions = (sessions ?? []) as any[];

  // If no sessions yet, create the first week with day 1
  if (allSessions.length === 0) {
    await adminClient.from("sessions").insert({
      plan_id: planId,
      week_number: 1,
      day_name: "Día 1",
      order_index: 1,
      is_completed: false,
      date: null,
    } as any);
    revalidatePath("/coach/templates");
    return { success: true };
  }

  const weekNumbers = [...new Set(allSessions.map((s) => s.week_number as number))].sort((a, b) => a - b);
  // Use the higher of parsed day number OR day count per week, so non-standard names like "DAY" don't reset to 1
  const parsedMax = Math.max(0, ...allSessions.map((s) => parseDayNumber(s.day_name)));
  const daysInFirstWeek = allSessions.filter((s) => s.week_number === weekNumbers[0]).length;
  const newDayName = `Día ${Math.max(parsedMax, daysInFirstWeek) + 1}`;
  const maxOrderIndex = Math.max(0, ...allSessions.map((s) => s.order_index ?? 0));

  const toInsert = weekNumbers.map((wk, i) => ({
    plan_id: planId,
    week_number: wk,
    day_name: newDayName,
    order_index: maxOrderIndex + i + 1,
    is_completed: false,
    date: null,
  }));

  const { error: insertError } = await adminClient.from("sessions").insert(toInsert as any);
  if (insertError) throw insertError;

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}

export async function removeSelectedDayFromTemplate(planId: number, sessionIds: number[]) {
  "use server";
  if (sessionIds.length === 0) return { success: false, reason: "no_ids" as const };

  const adminClient = createSupabaseAdminClient();

  const { data: allSessions, error } = await adminClient
    .from("sessions")
    .select("id, week_number")
    .eq("plan_id", planId as any);

  if (error) throw error;

  const sessions = (allSessions ?? []) as any[];
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number as number))];
  const sessionsPerWeek = weekNumbers.map(
    (wk) => sessions.filter((s) => s.week_number === wk).length
  );
  const minDaysAfter = Math.min(...sessionsPerWeek.map((count) => count - 1));

  if (minDaysAfter < 1) {
    return { success: false, reason: "min_days" as const };
  }

  const { error: delExError } = await adminClient
    .from("session_exercises")
    .delete()
    .in("session_id", sessionIds as any);
  if (delExError) throw delExError;

  const { error: delSesError } = await adminClient
    .from("sessions")
    .delete()
    .in("id", sessionIds as any);
  if (delSesError) throw delSesError;

  // Renombrar los días restantes para que sean consecutivos (Día 1, Día 2, ...)
  const { data: remaining } = await adminClient
    .from("sessions")
    .select("id, week_number, day_name, order_index")
    .eq("plan_id", planId as any);

  const remainingSessions = (remaining ?? []) as any[];
  const remainingWeeks = [...new Set(remainingSessions.map((s) => s.week_number as number))];

  for (const wk of remainingWeeks) {
    const wkSessions = remainingSessions
      .filter((s) => s.week_number === wk)
      .sort((a, b) => {
        const nA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
        const nB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
        return nA - nB || a.id - b.id;
      });

    for (let i = 0; i < wkSessions.length; i++) {
      const expectedName = `Día ${i + 1}`;
      if (wkSessions[i].day_name !== expectedName) {
        await adminClient
          .from("sessions")
          .update({ day_name: expectedName } as any)
          .eq("id", wkSessions[i].id as any);
      }
    }
  }

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}

export async function swapWeeksInTemplate(planId: number, weekA: number, weekB: number) {
  "use server";
  const adminClient = createSupabaseAdminClient();
  const TEMP = 999999;

  const step = async (from: number, to: number) =>
    adminClient.from("sessions").update({ week_number: to } as any).eq("plan_id", planId as any).eq("week_number", from as any);

  const { error: e1 } = await step(weekA, TEMP);
  if (e1) throw e1;
  const { error: e2 } = await step(weekB, weekA);
  if (e2) throw e2;
  const { error: e3 } = await step(TEMP, weekB);
  if (e3) throw e3;

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}

export async function swapDaysInTemplate(planId: number, dayIndexA: number, dayIndexB: number) {
  "use server";
  const adminClient = createSupabaseAdminClient();

  const { data: allSessions, error } = await adminClient
    .from("sessions")
    .select("id, week_number, day_name, order_index")
    .eq("plan_id", planId as any);

  if (error) throw error;

  const sessions = (allSessions ?? []) as any[];
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number as number))].sort((a, b) => a - b);

  const updates: Array<{ id: number; day_name: string; order_index: number }> = [];

  for (const wk of weekNumbers) {
    const wkSessions = sessions
      .filter((s) => s.week_number === wk)
      .sort((a, b) => {
        const nA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
        const nB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
        return nA - nB || a.id - b.id;
      });

    const sA = wkSessions[dayIndexA];
    const sB = wkSessions[dayIndexB];
    if (!sA || !sB) continue;

    updates.push({ id: sA.id, day_name: sB.day_name, order_index: sB.order_index });
    updates.push({ id: sB.id, day_name: sA.day_name, order_index: sA.order_index });
  }

  for (const u of updates) {
    const { error: ue } = await adminClient
      .from("sessions")
      .update({ day_name: u.day_name, order_index: u.order_index } as any)
      .eq("id", u.id as any);
    if (ue) throw ue;
  }

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}

export async function removeWeekFromTemplate(planId: number, weekNumber: number) {
  const adminClient = createSupabaseAdminClient();

  const { data: sessions, error } = await adminClient
    .from("sessions")
    .select("id, week_number")
    .eq("plan_id", planId as any);

  if (error) throw error;

  const allSessions = (sessions ?? []) as any[];
  const weekNumbers = [...new Set(allSessions.map((s) => s.week_number as number))];

  if (weekNumbers.length <= 1) {
    return { success: false, reason: "min_weeks" as const };
  }

  const toDelete = allSessions.filter((s) => s.week_number === weekNumber);
  const idsToDelete = toDelete.map((s) => s.id as number);

  if (idsToDelete.length > 0) {
    const { error: delExError } = await adminClient
      .from("session_exercises")
      .delete()
      .in("session_id", idsToDelete as any);
    if (delExError) throw delExError;

    const { error: delSesError } = await adminClient
      .from("sessions")
      .delete()
      .in("id", idsToDelete as any);
    if (delSesError) throw delSesError;
  }

  // Renumerar semanas restantes para que sean consecutivas (1, 2, 3, ...)
  const remainingWeeks = weekNumbers
    .filter((wk) => wk !== weekNumber)
    .sort((a, b) => a - b);

  for (let i = 0; i < remainingWeeks.length; i++) {
    const expectedNum = i + 1;
    if (remainingWeeks[i] !== expectedNum) {
      await adminClient
        .from("sessions")
        .update({ week_number: expectedNum } as any)
        .eq("plan_id", planId as any)
        .eq("week_number", remainingWeeks[i] as any);
    }
  }

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}

export async function addWeekToTemplate(planId: number) {
  const adminClient = createSupabaseAdminClient();

  const { data: sessions, error } = await adminClient
    .from("sessions")
    .select("id, week_number, day_name, order_index")
    .eq("plan_id", planId as any)
    .order("order_index", { ascending: true });

  if (error) throw error;

  const allSessions = (sessions ?? []) as any[];

  // If no sessions at all, create week 1 + day 1
  if (allSessions.length === 0) {
    await adminClient.from("sessions").insert({
      plan_id: planId,
      week_number: 1,
      day_name: "Día 1",
      order_index: 1,
      is_completed: false,
      date: null,
    } as any);
    revalidatePath("/coach/templates");
    return { success: true };
  }

  const weekNumbers = [...new Set(allSessions.map((s) => s.week_number as number))].sort((a, b) => a - b);
  const maxWeek = Math.max(...weekNumbers);
  const maxOrderIndex = Math.max(0, ...allSessions.map((s) => s.order_index ?? 0));

  // Use day names from the first week as the template for the new week
  const firstWeekSessions = allSessions
    .filter((s) => s.week_number === weekNumbers[0])
    .sort((a, b) => parseDayNumber(a.day_name) - parseDayNumber(b.day_name));

  const dayNames = firstWeekSessions.length > 0
    ? firstWeekSessions.map((s) => s.day_name as string)
    : ["Día 1"];

  const toInsert = dayNames.map((dayName, i) => ({
    plan_id: planId,
    week_number: maxWeek + 1,
    day_name: dayName,
    order_index: maxOrderIndex + i + 1,
    is_completed: false,
    date: null,
  }));

  const { error: insertError } = await adminClient.from("sessions").insert(toInsert as any);
  if (insertError) throw insertError;

  revalidatePath("/coach/templates");
  revalidatePath(`/coach/templates/${planId}/edit`);
  return { success: true };
}