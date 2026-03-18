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
  const planStart = new Date(startDate + "T00:00:00");
  const planEnd = new Date(planStart);
  planEnd.setDate(planStart.getDate() + Math.max(durationWeeks, 1) * 7 - 1);

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
  return {
    success: true,
    planId: plan.id,
    durationWeeks,
    endDate: planEnd.toISOString().split("T")[0]
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
    
    console.log("Creando plantilla con payload:", payload);

    const { data: template, error } = await adminClient
      .from("training_plans")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      console.error("Error creando plantilla:", error);
      throw error;
    }

    console.log("Plantilla creada exitosamente:", template);

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
    console.log("Eliminando plantilla:", templateId);

    // First, get all session IDs for this template
    const { data: sessions, error: sessionsError } = await adminClient
      .from("sessions")
      .select("id")
      .eq("plan_id", templateId);

    if (sessionsError) {
      console.error("Error obteniendo sesiones de la plantilla:", sessionsError);
      throw sessionsError;
    }

    // Delete all session_exercises for these sessions
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const { error: exercisesError } = await adminClient
        .from("session_exercises")
        .delete()
        .in("session_id", sessionIds);

      if (exercisesError) {
        console.error("Error eliminando ejercicios de la plantilla:", exercisesError);
        throw exercisesError;
      }
    }

    // Then, delete all sessions for this template
    const { error: deleteSessionsError } = await adminClient
      .from("sessions")
      .delete()
      .eq("plan_id", templateId);

    if (deleteSessionsError) {
      console.error("Error eliminando sesiones de la plantilla:", deleteSessionsError);
      throw deleteSessionsError;
    }

    // Finally, delete the template
    const { data: template, error } = await adminClient
      .from("training_plans")
      .delete()
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      console.error("Error eliminando plantilla:", error);
      throw error;
    }

    console.log("Plantilla eliminada exitosamente:", template);

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
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  try {
    // 1. Verificar permisos
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // 2. Obtener plantilla original
    const { data: templatePlan, error: fetchTemplateError } = await supabase
      .from("training_plans")
      .select("*")
      .eq("id", templatePlanId)
      .eq("is_template", true)
      .single();

    if (fetchTemplateError || !templatePlan) throw new Error("No se encontró la plantilla");

    // 3. Desactivar planes anteriores del estudiante
    await adminClient
      .from("training_plans")
      .update({ is_active: false } as any)
      .eq("student_id", studentId);

    // 4. Crear nuevo plan desde plantilla (Deep Copy)
    const { data: newPlan, error: createPlanError } = await adminClient
      .from("training_plans")
      .insert({
        name: templatePlan.name,
        coach_id: templatePlan.coach_id,
        student_id: studentId,
        is_active: true,
        is_template: false,
        start_date: startDate
      } as any)
      .select()
      .single();

    if (createPlanError || !newPlan) throw createPlanError;

    // 5. Obtener sesiones del template ordenadas
    const { data: templateSessions, error: fetchSessionsError } = await supabase
      .from("sessions")
      .select("*")
      .eq("plan_id", templatePlanId)
      .order("week_number", { ascending: true })
      .order("order_index", { ascending: true });

    if (fetchSessionsError) throw fetchSessionsError;

    // 6. Algoritmo de asignación de fechas
    const sessionDates: string[] = [];
    let currentDate = new Date(startDate + 'T00:00:00');
    
    for (let i = 0; i < (templateSessions?.length || 0); i++) {
      // Encontrar el siguiente día que coincida con preferredDaysOfWeek
      while (!preferredDaysOfWeek.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Formatear fecha como YYYY-MM-DD
      sessionDates.push(currentDate.toISOString().split('T')[0]);
      
      // Avanzar al siguiente día para la próxima sesión
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 7. Crear sesiones con fechas asignadas
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

    // 8. Copiar ejercicios de todas las sesiones
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
    console.error("Error en instantiateTemplateToStudent:", error);
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
    // Actualizar el nombre de la plantilla
    const { error } = await adminClient
      .from("training_plans")
      .update({ name: name })
      .eq("id", templateId)
      .eq("is_template", true);

    if (error) {
      console.error("Error actualizando plantilla:", error);
      throw error;
    }

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
  selectedDays: number[]
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

  const { data: templatePlan, error: templateError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", templateId)
    .eq("is_template", true)
    .single();

  if (templateError || !templatePlan) throw new Error("No se encontró la plantilla");

  let { data: activePlan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("student_id", studentId as any)
    .eq("is_template", false as any)
    .eq("is_active", true as any)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activePlan) {
    const { data: createdPlan, error: createPlanError } = await adminClient
      .from("training_plans")
      .insert({
        student_id: studentId,
        coach_id: templatePlan.coach_id ?? user.id,
        name: templatePlan.name,
        start_date: startDate,
        is_active: true,
        is_template: false
      } as any)
      .select()
      .single();

    if (createPlanError || !createdPlan) throw createPlanError;
    activePlan = createdPlan;
  }

  const { data: existingSessions, error: existingSessionsError } = await supabase
    .from("sessions")
    .select("week_number")
    .eq("plan_id", activePlan.id);

  if (existingSessionsError) throw existingSessionsError;

  const baseWeek = (existingSessions || []).reduce((max, session: any) => {
    return Math.max(max, session.week_number || 0);
  }, 0);

  const { data: templateSessions, error: templateSessionsError } = await supabase
    .from("sessions")
    .select("*")
    .eq("plan_id", templateId)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  if (templateSessionsError) throw templateSessionsError;

  if (!templateSessions || templateSessions.length === 0) {
    revalidatePath("/coach/student/[studentId]", "page");
    revalidatePath("/student", "page");
    return { success: true, planId: activePlan.id };
  }

  const start = new Date(startDate + "T00:00:00");
  const monday = new Date(start);
  const startDay = monday.getDay();
  const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
  monday.setDate(monday.getDate() + diffToMonday);

  const sessionsByTemplateWeek = new Map<number, any[]>();
  for (const session of templateSessions) {
    const weekNumber = session.week_number || 1;
    if (!sessionsByTemplateWeek.has(weekNumber)) {
      sessionsByTemplateWeek.set(weekNumber, []);
    }
    sessionsByTemplateWeek.get(weekNumber)!.push(session);
  }

  const createdSessionIds = new Map<number, number>();

  for (const [templateWeek, weekSessions] of sessionsByTemplateWeek.entries()) {
    const sortedSessions = [...weekSessions].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const weekMonday = new Date(monday);
    weekMonday.setDate(monday.getDate() + (templateWeek - 1) * 7);
    const targetWeekNumber = baseWeek + templateWeek;

    for (let index = 0; index < sortedSessions.length; index++) {
      const templateSession = sortedSessions[index];
      const selectedDay = normalizedDays[index % normalizedDays.length];
      const dayOffset = selectedDay === 0 ? 6 : selectedDay - 1;
      const sessionDate = new Date(weekMonday);
      sessionDate.setDate(weekMonday.getDate() + dayOffset);
      const formattedDate = sessionDate.toISOString().split("T")[0];

      const { data: insertedSession, error: insertedSessionError } = await adminClient
        .from("sessions")
        .insert({
          plan_id: activePlan.id,
          week_number: targetWeekNumber,
          day_name: templateSession.day_name,
          order_index: templateSession.order_index,
          is_completed: false,
          date: formattedDate
        } as any)
        .select()
        .single();

      if (insertedSessionError || !insertedSession) throw insertedSessionError;
      createdSessionIds.set(templateSession.id, insertedSession.id);
    }
  }

  for (const templateSession of templateSessions) {
    const newSessionId = createdSessionIds.get(templateSession.id);
    if (!newSessionId) continue;

    const { data: templateExercises, error: templateExercisesError } = await supabase
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

  return { success: true, planId: activePlan.id };
}
