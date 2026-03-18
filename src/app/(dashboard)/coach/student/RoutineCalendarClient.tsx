"use client";

import { useState, useRef, useEffect, useTransition, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarX,
  Dumbbell,
  Plus,
  X,
  Copy,
  Trash2
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import type { Tables } from "@/types/supabase";
import {
  addDayToWeek,
  addExerciseToSession,
  deleteExerciseFromSession,
  deleteDayFromPlan,
  updateExerciseInSession,
  duplicateSession
} from "./actions";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "./ExerciseExcelGrid";
import { ImportTemplateModal } from "./ImportTemplateModal";

type Session = Tables<"sessions">;
type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
  } | null;
};

type RoutineCalendarClientProps = {
  studentId?: string;
  role: "COACH" | "STUDENT" | "ADMIN";
  profile: { id: string; name: string | null; last_name: string | null } | null;
  plan: { id: number; name: string; start_date: string | null } | null;
  sessions: Session[];
  exercisesBySession: Record<number, SessionExercise[]>;
};

export function RoutineCalendarClient({
  studentId,
  role,
  profile,
  plan,
  sessions,
  exercisesBySession
}: RoutineCalendarClientProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { data: allExercises = [] } = useExercises();

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPlanActionModalOpen, setIsPlanActionModalOpen] = useState(false);
  const [newDayForm, setNewDayForm] = useState<{ date: string } | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [planAction, setPlanAction] = useState<"create" | "extend">("create");
  const [draftPlanName, setDraftPlanName] = useState("");
  const [selectedExistingPlanId, setSelectedExistingPlanId] = useState("");
  const [deletedPlanId, setDeletedPlanId] = useState<string | null>(null);

  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
    rest: 60,
    notes: ""
  });

  const [editExForm, setEditExForm] = useState({
    sets: 0,
    reps: "",
    rpe_target: 0,
    rest_seconds: 0,
    coach_notes: ""
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const formatDateDisplay = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat("es-AR", options).format(new Date(dateStr + "T00:00:00"));
  };

  const shiftDate = (dateStr: string, days: number) => {
    const nextDate = new Date(dateStr + "T00:00:00");
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate.toISOString().split("T")[0];
  };

  const getWeekRange = (weekNum: number, planStartDate: string | null) => {
    if (!planStartDate) return null;

    const start = new Date(planStartDate + "T00:00:00");
    const startDay = start.getDay();
    const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
    const firstMonday = new Date(start);
    firstMonday.setDate(start.getDate() + diffToMonday);

    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      monday: monday.toISOString().split("T")[0],
      sunday: sunday.toISOString().split("T")[0]
    };
  };

  const getWeekNumberFromDate = (dateStr: string, planStartDate: string | null) => {
    if (!planStartDate) return 1;

    const start = new Date(planStartDate + "T00:00:00");
    const startDay = start.getDay();
    const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
    const firstMonday = new Date(start);
    firstMonday.setDate(start.getDate() + diffToMonday);

    const target = new Date(dateStr + "T00:00:00");
    const diffInMs = target.getTime() - firstMonday.getTime();
    return Math.floor(diffInMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  };

  const effectivePlan = deletedPlanId === String(plan?.id) ? null : plan;
  const effectiveSessions = deletedPlanId ? [] : sessions;
  const weekRange = getWeekRange(selectedWeek, effectivePlan?.start_date || null);

  const currentWeekSessions = effectiveSessions
    .filter((session) => {
      if (!weekRange || !(session as any).date) return false;
      const sessionDate = (session as any).date.split("T")[0];
      return sessionDate >= weekRange.monday && sessionDate <= weekRange.sunday;
    })
    .sort((a, b) => {
      const dateA = ((a as any).date || "").split("T")[0];
      const dateB = ((b as any).date || "").split("T")[0];
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });

  const getDaysOfWeek = (weekNum: number, planStartDate: string | null) => {
    const range = getWeekRange(weekNum, planStartDate);
    if (!range) return [];

    const monday = new Date(range.monday + "T00:00:00");

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const daySessions = currentWeekSessions
        .filter((session) => {
          if (!(session as any).date) return false;
          return (session as any).date.split("T")[0] === dateStr;
        })
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      return { date: dateStr, sessions: daySessions };
    });
  };

  const weeklyDays = getDaysOfWeek(selectedWeek, effectivePlan?.start_date || null);
  const currentMonthName =
    weeklyDays.length > 0
      ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
          new Date(weeklyDays[0].date + "T00:00:00")
        )
      : "";
  const hasPlanInViewedWeek = currentWeekSessions.length > 0;
  const mockPlans = effectivePlan
    ? [
        {
          id: String(effectivePlan.id),
          name: effectivePlan.name,
          startDate: effectivePlan.start_date || new Date().toISOString().split("T")[0]
        },
        {
          id: `history-${effectivePlan.id}-1`,
          name: `${effectivePlan.name} · Bloque anterior`,
          startDate: effectivePlan.start_date
            ? new Date(new Date(effectivePlan.start_date + "T00:00:00").getTime() - 28 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : new Date().toISOString().split("T")[0]
        },
        {
          id: `history-${effectivePlan.id}-2`,
          name: `${effectivePlan.name} · Base`,
          startDate: effectivePlan.start_date
            ? new Date(new Date(effectivePlan.start_date + "T00:00:00").getTime() - 56 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : new Date().toISOString().split("T")[0]
        }
      ]
    : [];
  const availablePlans = useMemo(() => {
    return mockPlans
      .filter((mockPlan) => mockPlan.id !== deletedPlanId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [mockPlans, deletedPlanId]);
  const plansWithRanges = useMemo(() => {
    return availablePlans.map((mockPlan, index) => {
      const nextPlan = availablePlans[index + 1];
      const endDate = nextPlan
        ? shiftDate(nextPlan.startDate, -1)
        : shiftDate(mockPlan.startDate, 27);
      return {
        ...mockPlan,
        endDate
      };
    });
  }, [availablePlans]);
  const selectedPlanValue = availablePlans.find((mockPlan) => mockPlan.startDate === selectedDate)?.id || availablePlans[0]?.id || "";
  const selectedPlan = plansWithRanges.find((mockPlan) => mockPlan.id === selectedPlanValue) || null;
  const viewedWeekLabel = weekRange
    ? `${formatDateDisplay(weekRange.monday, { day: "2-digit", month: "short" })} - ${formatDateDisplay(weekRange.sunday, { day: "2-digit", month: "short" })}`
    : "Semana sin fechas";
  const viewedWeekNumber = weekRange && effectivePlan?.start_date
    ? getWeekNumberFromDate(weekRange.monday, effectivePlan.start_date)
    : null;
  const hasActivePlan = !!effectivePlan;
  const effectivePlanEndDate = effectivePlan?.start_date ? shiftDate(effectivePlan.start_date, 27) : null;
  const isViewedWeekWithinPlan = !!(
    effectivePlan?.start_date &&
    effectivePlanEndDate &&
    weekRange &&
    weekRange.monday <= effectivePlanEndDate &&
    weekRange.sunday >= effectivePlan.start_date
  );

  useEffect(() => {
    if (currentWeekSessions.length > 0) {
      const selectedDateStillVisible = !!selectedDate && weeklyDays.some((day) => day.date === selectedDate);
      if (!selectedDateStillVisible) {
        const firstSessionDate = ((currentWeekSessions[0] as any).date || "").split("T")[0];
        setSelectedDate(firstSessionDate || null);
        setIsAddingDay(false);
        setNewDayForm(null);
      }
    } else {
      const firstVisibleDate = weeklyDays[0]?.date ?? null;
      setSelectedDate(firstVisibleDate);
    }
  }, [selectedWeek, currentWeekSessions.length, selectedDate, weeklyDays]);

  useEffect(() => {
    if (!plan || !isViewedWeekWithinPlan) {
      setIsAddingDay(false);
      setNewDayForm(null);
    }
  }, [plan, isViewedWeekWithinPlan]);

  const activeSessionsForDate = selectedDate
    ? effectiveSessions
        .filter((session) => {
          if (!(session as any).date) return false;
          return (session as any).date.split("T")[0] === selectedDate;
        })
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    : [];

  const activeExercises = activeSessionsForDate
    .flatMap((session) => exercisesBySession[session.id] || [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const openPlanActionModal = () => {
    if (!selectedDate) {
      alert("Selecciona una fecha primero");
      return;
    }

    const hasOverlap = plansWithRanges.some((existingPlan) => {
      return selectedDate >= existingPlan.startDate && selectedDate <= existingPlan.endDate;
    });

    if (hasOverlap) {
      alert("Ya existe un plan en esta fecha");
      return;
    }

    setDraftPlanName(`Plan ${formatDateDisplay(selectedDate, { day: "2-digit", month: "2-digit" })}`);
    setSelectedExistingPlanId(plansWithRanges[0]?.id || "");
    setPlanAction("create");
    setIsPlanActionModalOpen(true);
  };

  const handleConfirmPlanAction = () => {
    if (planAction === "create" && !draftPlanName.trim()) {
      alert("Ingresa un nombre para el nuevo plan");
      return;
    }

    if (planAction === "extend" && !selectedExistingPlanId) {
      alert("Selecciona un plan para extender");
      return;
    }

    setIsPlanActionModalOpen(false);
    setIsImportModalOpen(true);
  };

  const handleDeleteSelectedPlan = () => {
    if (!selectedPlan) return;
    if (!window.confirm("¿Estás seguro de eliminar todo este plan y sus rutinas asociadas?")) return;

    setDeletedPlanId(selectedPlan.id);
    setSelectedDate(weekRange?.monday || null);
    setIsAddingDay(false);
    setIsAddingExercise(false);
    setNewDayForm(null);
  };

  const handleAddDay = () => {
    if (!plan || !newDayForm) return;
    const nextOrder =
      (currentWeekSessions.length > 0 ? Math.max(...currentWeekSessions.map((s) => s.order_index ?? 0)) : 0) + 1;

    startTransition(async () => {
      await addDayToWeek(plan.id, selectedWeek, nextOrder, "Day", newDayForm.date);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setIsAddingDay(false);
      setSelectedDate(newDayForm.date);
      setNewDayForm(null);
    });
  };

  const handleDuplicateDay = async () => {
    const sourceSessionId = activeSessionsForDate[0]?.id;
    if (!sourceSessionId) return;
    const targetDate = prompt(
      "Ingrese la fecha para el nuevo día (YYYY-MM-DD):",
      new Date().toISOString().split("T")[0]
    );
    if (!targetDate) return;

    startTransition(async () => {
      try {
        await duplicateSession(sourceSessionId, targetDate);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
        alert("Día duplicado con éxito");
      } catch (error) {
        console.error("Error duplicating day:", error);
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
        setNewExForm({
          exerciseId: "",
          target_sets: 3,
          target_reps: [10, 10, 10],
          target_weight: [null, null, null] as (number | null)[],
          target_rpe: 8,
          rest: 60,
          notes: ""
        });

        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      } catch (error) {
        console.error("Error adding exercise:", error);
      }
    });
  };

  const handleDeleteDay = async () => {
    const targetSessionId = activeSessionsForDate[0]?.id;
    if (!targetSessionId) return;
    if (!window.confirm("¿Estás seguro de eliminar este día y todos sus ejercicios?")) return;

    startTransition(async () => {
      try {
        await deleteDayFromPlan(targetSessionId);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
        setIsAddingExercise(false);
        setIsAddingDay(false);
        setNewDayForm(null);
        setSelectedDate(null);
      } catch (error) {
        console.error("Error deleting day:", error);
      }
    });
  };

  const handleDeleteExercise = (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este ejercicio?")) return;
    startTransition(async () => {
      await deleteExerciseFromSession(id);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
    });
  };

  const startEditing = (ex: SessionExercise) => {
    setEditingExerciseId(ex.id);
    setEditExForm({
      sets: (ex as any).sets || 0,
      reps: (ex as any).reps || "",
      rpe_target: (ex as any).rpe_target || 0,
      rest_seconds: ex.rest_seconds || 0,
      coach_notes: ex.coach_notes || ""
    });
  };

  const handleUpdateExercise = async (id: number) => {
    startTransition(async () => {
      await updateExerciseInSession(id, editExForm as any);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setEditingExerciseId(null);
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
        />
      )}

      {isPlanActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-zinc-100">Gestionar plan desde esta fecha</h3>
                <p className="text-sm text-zinc-400">
                  {selectedDate ? `Fecha seleccionada: ${formatDateDisplay(selectedDate, { day: "2-digit", month: "short", year: "numeric" })}` : "Sin fecha seleccionada"}
                </p>
              </div>
              <button
                onClick={() => setIsPlanActionModalOpen(false)}
                className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setPlanAction("create")}
                className={`rounded-2xl border p-4 text-left transition ${
                  planAction === "create"
                    ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <span className="block text-sm font-black">Crear Nuevo Plan</span>
                <span className="mt-1 block text-xs text-zinc-500">Define un nombre y arranca un bloque nuevo.</span>
              </button>
              <button
                type="button"
                onClick={() => setPlanAction("extend")}
                className={`rounded-2xl border p-4 text-left transition ${
                  planAction === "extend"
                    ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <span className="block text-sm font-black">Extender Plan Existente</span>
                <span className="mt-1 block text-xs text-zinc-500">Sumar semanas a un bloque ya creado.</span>
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {planAction === "create" ? (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Nombre del plan
                  </label>
                  <input
                    type="text"
                    value={draftPlanName}
                    onChange={(e) => setDraftPlanName(e.target.value)}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-yellow-400"
                    placeholder="Ej: Hipertrofia Marzo"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Plan a extender
                  </label>
                  <select
                    value={selectedExistingPlanId}
                    onChange={(e) => setSelectedExistingPlanId(e.target.value)}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-yellow-400"
                  >
                    <option value="">Seleccionar plan...</option>
                    {plansWithRanges.map((existingPlan) => (
                      <option key={existingPlan.id} value={existingPlan.id}>
                        {existingPlan.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPlanActionModalOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPlanAction}
                className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-black transition hover:scale-[1.02] active:scale-[0.98]"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">
            {effectivePlan?.name || "Sin plan activo"}
          </h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {profile?.name ? `Alumno: ${profile.name} ${profile.last_name || ""}` : ""}
          </p>
        </div>

        {(role === "COACH" || role === "ADMIN") && studentId && (
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-[10px] font-black text-black transition-all uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98]"
          >
            📥 Importar Plantilla
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <div className="mb-6 flex flex-col gap-4 rounded-xl bg-zinc-900/50 p-4 md:flex-row md:items-center md:justify-between">
          {hasPlanInViewedWeek ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Historial de rutinas
                </span>
                <span className="text-sm font-bold text-zinc-100">
                  {selectedPlan ? `${selectedPlan.name} - Semana ${viewedWeekNumber || selectedWeek}` : "Salta al inicio del bloque seleccionado"}
                </span>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <select
                  value={selectedPlanValue}
                  onChange={(e) => {
                    const nextPlan = availablePlans.find((mockPlan) => mockPlan.id === e.target.value);
                    if (!nextPlan) return;
                    setSelectedWeek(getWeekNumberFromDate(nextPlan.startDate, effectivePlan?.start_date || null));
                    setSelectedDate(nextPlan.startDate);
                    setIsAddingDay(false);
                    setNewDayForm(null);
                  }}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400"
                >
                  {availablePlans.map((mockPlan) => (
                    <option key={mockPlan.id} value={mockPlan.id}>
                      {mockPlan.name}
                    </option>
                  ))}
                </select>

                {(role === "COACH" || role === "ADMIN") && selectedPlan && (
                  <button
                    onClick={handleDeleteSelectedPlan}
                    className="rounded-xl p-3 text-red-500 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-zinc-100">Sin plan asignado</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  No hay sesiones en la semana visualizada
                </span>
              </div>

              {(role === "COACH" || role === "ADMIN") && studentId && (
                <button
                  onClick={openPlanActionModal}
                  className="flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" /> Crear Plan
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-zinc-100 uppercase tracking-tighter flex items-center gap-2">
            <Calendar className="h-5 w-5 text-yellow-400" />
            {currentMonthName || "Calendario"}
          </h3>

          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setSelectedWeek((prev) => prev - 1)}
              className="p-2 text-zinc-400 hover:text-white transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 text-[10px] font-black uppercase tracking-widest text-zinc-100">
              {viewedWeekLabel}
            </span>

            <button
              onClick={() => setSelectedWeek((prev) => prev + 1)}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasActivePlan ? (
          <div className="grid grid-cols-7 gap-2">
            {weeklyDays.map((day, idx) => {
              const isSelected = selectedDate === day.date;
              const dateInfo = formatSessionDate(day.date);
              const hasSession = day.sessions.length > 0;

              return (
                <button
                  key={day.date}
                  onClick={() => {
                    if (hasSession) {
                      setSelectedDate(day.date);
                      setIsAddingDay(false);
                      setNewDayForm(null);
                    } else if (role === "COACH") {
                      setSelectedDate(day.date);
                      setIsAddingDay(true);
                      setNewDayForm({ date: day.date });
                    } else {
                      setSelectedDate(day.date);
                      setIsAddingDay(false);
                      setNewDayForm(null);
                    }
                  }}
                  className={`flex flex-col items-center gap-1 rounded-2xl py-3 border-2 transition-all duration-200 ${
                    isSelected
                      ? "bg-yellow-400 border-yellow-400 text-black shadow-lg scale-105 z-10"
                      : hasSession
                      ? "bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-yellow-400/50"
                      : "bg-black/40 border-zinc-900 border-dashed text-zinc-600 hover:border-zinc-700"
                  }`}
                >
                  <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">
                    {dateInfo?.day || ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx]}
                  </span>
                  <span className="text-sm font-black tracking-tight">
                    {dateInfo?.num || new Date(day.date + "T00:00:00").getDate()}
                  </span>
                  {hasSession && !isSelected && <div className="h-1 w-1 rounded-full bg-yellow-400 mt-0.5 animate-pulse" />}
                  {day.sessions.length > 1 && (
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                      {day.sessions.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900/80">
              <CalendarX className="h-8 w-8 text-zinc-500" />
            </div>
            <p className="max-w-xl text-sm font-medium leading-relaxed text-zinc-400">
              No hay un plan activo para esta semana. Crea o extiende un plan desde la cabecera para comenzar a agregar rutinas.
            </p>
          </div>
        )}
      </div>

      {hasActivePlan && (
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {selectedDate
                ? activeSessionsForDate.length > 0
                  ? "Entrenamiento"
                  : role === "STUDENT"
                  ? "Día de descanso"
                  : "Sin sesión"
                : role === "STUDENT"
                ? "Día de descanso"
                : "Sin sesión"}
            </h3>
            <p className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("es-AR", { dateStyle: "long" })
                : role === "STUDENT"
                ? "Descanso y recuperación"
                : "Selecciona un día"}
            </p>
          </div>

          {role === "COACH" && activeSessionsForDate.length > 0 && !isAddingDay && (
            <div className="flex gap-2">
              <button
                onClick={handleDuplicateDay}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-[10px] font-black text-zinc-400 transition hover:text-yellow-400 active:scale-95 uppercase"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>

              <button
                onClick={() => setIsAddingExercise(true)}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-[10px] font-black text-black transition active:scale-95 uppercase"
              >
                <Plus className="h-3.5 w-3.5" /> Ejercicio
              </button>

              <button
                onClick={handleDeleteDay}
                className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-[10px] font-black text-red-400 transition hover:bg-red-500/20 hover:border-red-400 active:scale-95 uppercase"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar Día
              </button>
            </div>
          )}
        </div>

        {plan && isViewedWeekWithinPlan && isAddingDay && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Elegir fecha para el nuevo día
              </h4>
              <button
                onClick={() => {
                  setIsAddingDay(false);
                  setNewDayForm(null);
                }}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="date"
                className="flex-1 rounded-xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                value={newDayForm?.date ?? ""}
                onChange={(e) => setNewDayForm({ date: e.target.value })}
              />
              <button
                onClick={handleAddDay}
                className="rounded-xl bg-yellow-400 px-6 font-black text-xs text-black shadow-lg shadow-yellow-400/10 active:scale-95 transition"
              >
                AGREGAR
              </button>
            </div>
          </div>
        )}

        {isAddingExercise && role === "COACH" && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Nuevo Ejercicio
              </h4>
              <button onClick={() => setIsAddingExercise(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                    Ejercicio
                  </label>
                  <select
                    className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400 transition-all appearance-none"
                    value={newExForm.exerciseId}
                    onChange={(e) => setNewExForm({ ...newExForm, exerciseId: e.target.value })}
                  >
                    <option value="">Seleccionar ejercicio...</option>
                    {allExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                      Sets
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-yellow-400 outline-none focus:border-yellow-400 transition-all"
                      value={newExForm.target_sets}
                      onChange={(e) => {
                        const sets = Math.max(1, Math.min(10, Number(e.target.value)));
                        setNewExForm({
                          ...newExForm,
                          target_sets: sets,
                          target_reps: Array(sets).fill(newExForm.target_reps[0] || 10),
                          target_weight: Array(sets).fill(null)
                        });
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                      RPE
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                      value={newExForm.target_rpe}
                      onChange={(e) => setNewExForm({ ...newExForm, target_rpe: Number(e.target.value) })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                      Pausa
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                      value={newExForm.rest}
                      onChange={(e) => setNewExForm({ ...newExForm, rest: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-3xl bg-zinc-950 p-6 border-2 border-zinc-900">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                    Repeticiones por serie
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {newExForm.target_reps.map((rep, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-zinc-600 text-center uppercase">
                          S{idx + 1}
                        </span>
                        <input
                          required
                          type="number"
                          min="1"
                          className="w-12 h-12 rounded-xl border-2 border-zinc-800 bg-zinc-900 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                          value={rep}
                          onChange={(e) => {
                            const newReps = [...newExForm.target_reps];
                            newReps[idx] = Number(e.target.value);
                            setNewExForm({ ...newExForm, target_reps: newReps });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                    Kilos por serie
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {newExForm.target_weight.map((weight, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-zinc-600 text-center uppercase">
                          S{idx + 1}
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Kg"
                          className="w-12 h-12 rounded-xl border-2 border-zinc-800 bg-zinc-900 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                          value={weight === null ? "" : weight}
                          onChange={(e) => {
                            const newWeights = [...newExForm.target_weight];
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            newWeights[idx] = val;
                            setNewExForm({ ...newExForm, target_weight: newWeights });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                  Notas para el alumno
                </label>
                <textarea
                  className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-medium text-zinc-100 outline-none focus:border-yellow-400 transition-all resize-none"
                  rows={2}
                  placeholder="Ej: Controlar el descenso, 2 segundos..."
                  value={newExForm.notes}
                  onChange={(e) => setNewExForm({ ...newExForm, notes: e.target.value })}
                />
              </div>

              <button
                onClick={handleAddExercise}
                disabled={isPending || !newExForm.exerciseId}
                className="w-full rounded-[1.5rem] bg-yellow-400 py-5 text-sm font-black text-black shadow-xl shadow-yellow-400/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-30 disabled:grayscale uppercase tracking-widest"
              >
                {isPending ? "Procesando..." : "Guardar en Rutina"}
              </button>
            </div>
          </div>
        )}

        {!isAddingDay && (
          <div className="flex flex-col gap-4">
            {activeExercises.length === 0 && activeSessionsForDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[2rem] border-2 border-dashed border-zinc-800 bg-zinc-950/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-zinc-900/50 flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-xs text-center">
                    {role === "STUDENT" ? "Día de Descanso" : "Sin ejercicios para este día"}
                  </p>
                  {role === "STUDENT" && (
                    <p className="text-zinc-600 text-xs text-center max-w-[200px]">
                      Hoy no hay entrenamiento programado. ¡Aprovecha para recuperarte!
                    </p>
                  )}
                </div>
              </div>
            ) : activeExercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[2rem] border-2 border-dashed border-zinc-800 bg-zinc-950/50">
                <Dumbbell className="h-12 w-12 text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">
                  Sin ejercicios para este día
                </p>
              </div>
            ) : (
              <ExerciseExcelGrid exercises={activeExercises} role={role === "ADMIN" ? "COACH" : role} />
            )}

            {role === "COACH" && !isAddingExercise && activeSessionsForDate.length > 0 && (
              <button
                onClick={() => setIsAddingExercise(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-800 p-4 text-xs font-black text-zinc-500 hover:border-yellow-400 hover:text-yellow-400 transition-all uppercase tracking-widest"
              >
                <Plus className="h-4 w-4" /> Agregar Ejercicio
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
