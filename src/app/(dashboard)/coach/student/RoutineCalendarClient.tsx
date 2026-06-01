"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ExerciseFormModal } from "@/components/ExerciseFormModal";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Dumbbell,
  Plus,
  X,
  Copy,
  Trash2,
  CalendarClock,
  ChevronsUpDown,
  ChevronsDownUp,
} from "lucide-react";
import type { Tables } from "@/types/supabase";
import {
  addDayToWeek,
  addExerciseToSession,
  deleteDayFromPlan,
  duplicateSession,
  moveSession
} from "./actions";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "./ExerciseExcelGrid";
import { ImportTemplateModal } from "./ImportTemplateModal";
import { DatePickerField } from "@/components/DatePickerField";

// FIX TYPESCRIPT: Le decimos explícitamente que session puede traer un "date"
type Session = Tables<"sessions"> & { 
  date?: string | null; 
};

type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
  } | null;
};

type TrainingPlan = Pick<Tables<"training_plans">, "id" | "name" | "is_active" | "start_date"> & {
  end_date?: string | null;
};

type RoutineCalendarClientProps = {
  studentId?: string;
  role: "COACH" | "STUDENT" | "ADMIN";
  profile: { id: string; name: string | null; last_name: string | null } | null;
  plan: { id: number; name: string; start_date: string | null } | null;
  allPlans: TrainingPlan[];
  sessions: Session[];
  exercisesBySession: Record<number, SessionExercise[]>;
};

// Utilidades de zona horaria
const toLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftDate = (dateStr: string, days: number) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
};

const getMonday = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalISODate(d);
};

export function RoutineCalendarClient({
  studentId,
  role,
  profile,
  allPlans,
  sessions,
  exercisesBySession
}: RoutineCalendarClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { data: allExercises = [] } = useExercises();

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalISODate(new Date()));
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState<string>("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState<string>("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [newDayForm, setNewDayForm] = useState<{ date: string } | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    setAllExpanded(false);
  }, [selectedDate]);

  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
    rest: 60,
    notes: ""
  });

  // 1. Mapear planes con rangos seguros
  const plansWithRanges = useMemo(() => {
    return allPlans.map((p) => ({
      id: String(p.id),
      name: p.name,
      startDate: p.start_date || toLocalISODate(new Date()),
      endDate: p.end_date || shiftDate(p.start_date || toLocalISODate(new Date()), 27),
      is_active: p.is_active
    }));
  }, [allPlans]);

  // 2. Determinar la semana visual actual
  const currentMonday = getMonday(selectedDate);
  const weekSunday = shiftDate(currentMonday, 6);

  // 3. Encontrar el plan que abarca esta semana
  const currentViewedPlan = useMemo(() => {
    return plansWithRanges.find((p) => weekSunday >= p.startDate && currentMonday <= p.endDate) || null;
  }, [currentMonday, weekSunday, plansWithRanges]);

  // 4. Calcular el número de semana relativo al plan actual
  let viewedWeekNumber = 1;
  if (currentViewedPlan) {
    const planFirstMonday = getMonday(currentViewedPlan.startDate);
    const diffInMs = new Date(currentMonday + "T00:00:00").getTime() - new Date(planFirstMonday + "T00:00:00").getTime();
    viewedWeekNumber = Math.round(diffInMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  // 5. Generar los 7 días de la semana actual con sus sesiones
  const weeklyDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = shiftDate(currentMonday, i);
      const daySessions = sessions
        .filter((session) => {
          if (!session.date) return false;
          const sessionDate = session.date.split("T")[0];
          const belongsToPlan = currentViewedPlan ? String(session.plan_id) === currentViewedPlan.id : false;
          return sessionDate === date && belongsToPlan;
        })
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      return { date, sessions: daySessions };
    });
  }, [currentMonday, sessions, currentViewedPlan]);

  const activeSessionsForDate = weeklyDays.find((d) => d.date === selectedDate)?.sessions || [];
  const activeExercises = activeSessionsForDate
    .flatMap((session) => exercisesBySession[session.id] || [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // -- MANEJADORES DE ACCIONES -- //

  const managedPlan = useMemo(() => {
    if (!currentViewedPlan) return null;
    const found = allPlans.find(p => String(p.id) === currentViewedPlan.id);
    return found ? {
      id: found.id,
      name: found.name,
      start_date: found.start_date,
      end_date: found.end_date,
    } : null;
  }, [currentViewedPlan, allPlans]);

  const managedPlanHasSessions = useMemo(() => {
    if (!currentViewedPlan) return false;
    return sessions.some(s => s.plan_id === Number(currentViewedPlan.id));
  }, [currentViewedPlan, sessions]);

  const handleAddDay = () => {
    if (!currentViewedPlan || !newDayForm) return;
    const nextOrder = (activeSessionsForDate.length > 0 ? Math.max(...activeSessionsForDate.map((s) => s.order_index ?? 0)) : 0) + 1;

    startTransition(async () => {
      try {
        await addDayToWeek(Number(currentViewedPlan.id), viewedWeekNumber, nextOrder, "Day", newDayForm.date);
        await queryClient.refetchQueries({ queryKey: ["student", "routine"] });
        setIsAddingDay(false);
        setSelectedDate(newDayForm.date);
        setNewDayForm(null);
      } catch (error: any) {
        alert(error?.message || "Error al crear el día");
      }
    });
  };

  const handleOpenReschedule = () => {
    setRescheduleTargetDate(toLocalISODate(new Date()));
    setRescheduleError(null);
    setIsRescheduling(true);
  };

  const handleMoveSession = () => {
    const sessionId = activeSessionsForDate[0]?.id;
    if (!sessionId || !rescheduleTargetDate) return;

    startTransition(async () => {
      try {
        await moveSession(sessionId, rescheduleTargetDate);
        router.refresh();
        await queryClient.refetchQueries({ queryKey: ["student", "routine"] });
        setIsRescheduling(false);
        setSelectedDate(rescheduleTargetDate);
      } catch (error: any) {
        setRescheduleError(error.message || "Error al reagendar la sesión");
      }
    });
  };

  const handleDuplicateDay = () => {
    if (!activeSessionsForDate[0]?.id) return;
    setDuplicateTargetDate(toLocalISODate(new Date()));
    setDuplicateError(null);
    setIsDuplicating(true);
  };

  const handleConfirmDuplicate = () => {
    const sourceSessionId = activeSessionsForDate[0]?.id;
    if (!sourceSessionId || !duplicateTargetDate) return;

    startTransition(async () => {
      try {
        await duplicateSession(sourceSessionId, duplicateTargetDate);
        await queryClient.refetchQueries({ queryKey: ["student", "routine"] });
        setIsDuplicating(false);
        setSelectedDate(duplicateTargetDate);
      } catch (error: any) {
        setDuplicateError(error?.message || "Error al duplicar el día");
      }
    });
  };

  const handleAddExercise = async () => {
    const targetSessionId = activeSessionsForDate[0]?.id;
    if (!targetSessionId || !newExForm.exerciseId) return;

    startTransition(async () => {
      try {
        await addExerciseToSession(
          targetSessionId,
          Number(newExForm.exerciseId),
          newExForm.target_sets,
          newExForm.target_reps,
          newExForm.target_weight,
          newExForm.target_rpe,
          newExForm.rest,
          newExForm.notes
        );
        setIsAddingExercise(false);
        setNewExForm({ exerciseId: "", target_sets: 3, target_reps: [10, 10, 10], target_weight: [null, null, null], target_rpe: 8, rest: 60, notes: "" });
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      } catch (error) {
        console.error("Error adding exercise:", error);
      }
    });
  };

  const handleDeleteDay = () => {
    const targetSessionId = activeSessionsForDate[0]?.id;
    if (!targetSessionId) return;
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    const targetSessionId = activeSessionsForDate[0]?.id;
    if (!targetSessionId) return;

    startTransition(async () => {
      try {
        await deleteDayFromPlan(targetSessionId);
        setIsConfirmingDelete(false);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
        router.refresh();
      } catch (error) {
        console.error("Error deleting day:", error);
      }
    });
  };

  const formatSessionDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + "T00:00:00");
    const day = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(date);
    const num = date.getDate();
    return { day: day.replace(".", ""), num };
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      {(role === "COACH" || role === "ADMIN") && studentId && (
        <ImportTemplateModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          studentId={studentId}
          managedPlan={managedPlan}
          planHasSessions={managedPlanHasSessions}
        />
      )}

      {/* HEADER COMPACTO CONTINUO */}
      <div className="flex flex-col gap-3 px-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-zinc-900/40 p-3 border border-zinc-800/80 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {currentViewedPlan ? (
                <h2 className="text-sm font-black text-zinc-100 truncate">{currentViewedPlan.name}</h2>
              ) : (
                <h2 className="text-sm font-black text-zinc-500 truncate">Semana sin planificar</h2>
              )}
              {profile?.name && (
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 truncate mt-0.5">
                  {profile.name} {profile.last_name || ""}
                </p>
              )}
            </div>

            {/* Acciones del Coach/Admin sobre el plan */}
            {(role === "COACH" || role === "ADMIN") && studentId && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className={currentViewedPlan
                    ? "flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:bg-zinc-800 active:scale-95"
                    : "flex items-center gap-1 rounded-lg bg-yellow-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black transition hover:scale-105 active:scale-95"
                  }
                >
                  {!currentViewedPlan && <Plus className="h-3 w-3" />}
                  {currentViewedPlan ? "Gestionar" : "Nuevo Plan"}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800/50 pt-2">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {currentViewedPlan ? `Semana ${viewedWeekNumber}` : "Navegación Libre"}
            </span>
            <div className="flex items-center gap-1.5">
              {getMonday(toLocalISODate(new Date())) !== currentMonday && (
                <button
                  onClick={() => setSelectedDate(toLocalISODate(new Date()))}
                  className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-zinc-500 transition-all active:scale-95"
                >
                  Hoy
                </button>
              )}
              <div className="flex items-center gap-1 bg-zinc-950 rounded-lg border border-zinc-800 p-0.5">
                <button onClick={() => setSelectedDate(shiftDate(currentMonday, -7))} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setSelectedDate(shiftDate(currentMonday, 7))} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CALENDARIO PÍLDORA (AHORA SIEMPRE VISIBLE PARA FACILITAR NAVEGACIÓN) */}
      <div className="px-4">
        <div className="flex justify-between items-center gap-1 sm:gap-2">
          {weeklyDays.map((day, idx) => {
            const isSelected = selectedDate === day.date;
            const dateInfo = formatSessionDate(day.date);
            const hasSession = day.sessions.length > 0;
            const shortDays = ["L", "M", "X", "J", "V", "S", "D"];

            return (
              <button
                key={day.date}
                onClick={() => {
                  setSelectedDate(day.date);
                  setIsAddingDay(false);
                  setNewDayForm(null);
                }}
                className={`flex flex-col items-center justify-center w-11 h-14 sm:w-14 sm:h-16 rounded-xl transition-all duration-200 relative ${
                  isSelected
                    ? "bg-yellow-400 text-black shadow-lg scale-105"
                    : hasSession
                    ? "bg-zinc-900 border border-zinc-800 text-zinc-100 hover:border-yellow-400/50"
                    : "bg-transparent text-zinc-600 hover:bg-zinc-900/50"
                }`}
              >
                <span className={`text-[10px] font-black uppercase ${isSelected ? 'opacity-80' : 'opacity-60'}`}>
                  {shortDays[idx]}
                </span>
                <span className="text-sm font-black mt-0.5">
                  {dateInfo?.num || new Date(day.date + "T00:00:00").getDate()}
                </span>
                {hasSession && !isSelected && (
                  <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-yellow-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* INFO DEL DÍA Y BOTONES SUPERIORES */}
      <div className="flex flex-col gap-3 px-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {activeSessionsForDate.length > 0 ? "Entrenamiento" : role === "STUDENT" ? "Día de Descanso" : "Día Libre"}
            </h3>
            <p className="text-base font-bold text-zinc-100 tracking-tight capitalize">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-AR", { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* BOTÓN EXPANDIR/COLAPSAR TODOS */}
            {activeExercises.length > 0 && !isAddingDay && (
              <button
                onClick={() => setAllExpanded(prev => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
                title={allExpanded ? "Colapsar todos" : "Expandir todos"}
              >
                {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
              </button>
            )}

            {/* BOTÓN REAGENDAR: Visible para Alumno y Coach si hay sesión */}
            {activeSessionsForDate.length > 0 && !isAddingDay && (
              <button
                onClick={handleOpenReschedule}
                className="flex h-9 w-9 sm:w-auto items-center justify-center sm:gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 sm:px-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:bg-zinc-700 hover:text-white active:scale-95"
              >
                <CalendarClock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Reagendar</span>
              </button>
            )}

            {/* Acciones de COACH (Duplicar, Borrar, Añadir Ex) */}
            {role === "COACH" && activeSessionsForDate.length > 0 && !isAddingDay && (
              <>
                <button onClick={handleDuplicateDay} className="flex h-9 w-9 sm:w-auto items-center justify-center sm:gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 sm:px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition hover:text-yellow-400 active:scale-95">
                  <Copy className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Duplicar</span>
                </button>
                <button onClick={handleDeleteDay} className="flex h-9 w-9 sm:w-auto items-center justify-center sm:gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 sm:px-3 text-[10px] font-black uppercase tracking-widest text-red-400 transition hover:bg-red-500/20 active:scale-95">
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
                <button onClick={() => setIsAddingExercise(true)} className="flex h-9 w-9 sm:w-auto items-center justify-center sm:gap-1.5 rounded-lg bg-yellow-400 sm:px-3 text-[10px] font-black uppercase tracking-widest text-black transition active:scale-95">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Ejercicio</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* MODAL DE REAGENDAR DÍA (BOTTOM SHEET) */}
        {isRescheduling && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
            <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col max-h-[92dvh]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Reagendar Sesión</h4>
                <button onClick={() => setIsRescheduling(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-2">
                <DatePickerField
                  label="Nueva fecha"
                  value={rescheduleTargetDate}
                  onChange={(v) => { setRescheduleTargetDate(v); setRescheduleError(null); }}
                  min={currentViewedPlan?.startDate}
                  max={currentViewedPlan?.endDate}
                />
                {rescheduleError && (
                  <p className="text-xs font-bold text-red-400 text-center mt-3">{rescheduleError}</p>
                )}
              </div>
              <div className="px-6 pt-4 pb-8 sm:pb-6 shrink-0">
                <button
                  onClick={handleMoveSession}
                  disabled={isPending || !rescheduleTargetDate}
                  className="h-14 w-full rounded-2xl bg-yellow-400 text-sm font-black uppercase tracking-widest text-black shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
                >
                  {isPending ? "Reagendando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL AGREGAR DÍA NUEVO */}
        {currentViewedPlan && isAddingDay && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
            <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col max-h-[92dvh]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Iniciar Rutina</h4>
                <button onClick={() => { setIsAddingDay(false); setNewDayForm(null); }} className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-2">
                <DatePickerField
                  label="Confirmar Fecha"
                  value={newDayForm?.date ?? ""}
                  onChange={(v) => setNewDayForm({ date: v })}
                  min={currentViewedPlan?.startDate}
                  max={currentViewedPlan?.endDate}
                />
              </div>
              <div className="px-6 pt-4 pb-8 sm:pb-6 shrink-0">
                <button onClick={handleAddDay} className="h-14 w-full rounded-2xl bg-yellow-400 text-sm font-black uppercase tracking-widest text-black shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 active:scale-95">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DUPLICAR DÍA */}
        {isDuplicating && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
            <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col max-h-[92dvh]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Duplicar Día</h4>
                <button onClick={() => setIsDuplicating(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-2">
                <DatePickerField
                  label="Fecha destino"
                  value={duplicateTargetDate}
                  onChange={(v) => { setDuplicateTargetDate(v); setDuplicateError(null); }}
                  min={currentViewedPlan?.startDate}
                  max={currentViewedPlan?.endDate}
                />
                {duplicateError && (
                  <p className="text-xs font-bold text-red-400 text-center mt-3">{duplicateError}</p>
                )}
              </div>
              <div className="px-6 pt-4 pb-8 sm:pb-6 shrink-0">
                <button
                  onClick={handleConfirmDuplicate}
                  disabled={isPending || !duplicateTargetDate}
                  className="h-14 w-full rounded-2xl bg-yellow-400 text-sm font-black uppercase tracking-widest text-black shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
                >
                  {isPending ? "Duplicando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMAR ELIMINAR DÍA */}
        {isConfirmingDelete && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
            <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-400" />
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Eliminar Día</h4>
                </div>
                <button onClick={() => setIsConfirmingDelete(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 pb-2">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  ¿Estás seguro de eliminar este día y todos sus ejercicios? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isPending}
                  className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isPending}
                  className="flex-1 h-14 rounded-2xl bg-red-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-50"
                >
                  {isPending ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isAddingExercise && role === "COACH" && (
          <ExerciseFormModal isOpen={isAddingExercise} onClose={() => setIsAddingExercise(false)} formState={newExForm} setFormState={setNewExForm} onSave={handleAddExercise} isPending={isPending} allExercises={allExercises} />
        )}
      </div>

      {/* ÁREA DE EJERCICIOS Y ESTADOS VACÍOS */}
      {!isAddingDay && (
        <div className="flex flex-col gap-4 px-4">
          {activeExercises.length === 0 && activeSessionsForDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-4xl border-2 border-dashed border-zinc-800 bg-zinc-950/50">
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-zinc-900/50 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-black uppercase tracking-widest text-xs text-center mb-1">
                  {currentViewedPlan ? (role === "STUDENT" ? "Día de Descanso" : "Día sin planificar") : "Semana Libre"}
                </p>
                
                {role === "COACH" && currentViewedPlan && (
                  <button
                    onClick={() => {
                      setIsAddingDay(true);
                      setNewDayForm({ date: selectedDate });
                    }}
                    className="flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-400/20 mt-2"
                  >
                    <Plus className="h-4 w-4" /> Iniciar Rutina
                  </button>
                )}

                {role === "STUDENT" && currentViewedPlan && (
                  <p className="text-zinc-600 text-xs text-center max-w-50">
                    Hoy no hay entrenamiento programado. ¡Aprovecha para recuperarte!
                  </p>
                )}
              </div>
            </div>
          ) : activeExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-4xl border-2 border-dashed border-zinc-800 bg-zinc-950/50">
              <Dumbbell className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Sin ejercicios para este día</p>
            </div>
          ) : (
            <ExerciseExcelGrid exercises={activeExercises} role={role === "ADMIN" ? "COACH" : role} allExpanded={allExpanded} />
          )}

        </div>
      )}
    </div>
  );
}