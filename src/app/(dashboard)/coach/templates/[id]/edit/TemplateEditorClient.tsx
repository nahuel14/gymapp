"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, Dumbbell, AlertTriangle, X, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTemplate } from "@/hooks/useTemplates";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { ExerciseFormModal } from "@/components/ExerciseFormModal";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateTemplatePlan,
  addDayToAllWeeks,
  addWeekToTemplate,
  removeWeekFromTemplate,
  removeSelectedDayFromTemplate,
  swapWeeksInTemplate,
  swapDaysInTemplate,
  addExerciseToSession,
} from "@/app/(dashboard)/coach/student/actions";

type Props = { templateId: number };

const DEFAULT_FORM = {
  exerciseId: "",
  target_sets: 3,
  target_reps: [10, 10, 10],
  target_weight: [null, null, null] as (number | null)[],
  target_rpe: 8,
  rest: 60,
  coach_notes: "",
};

export function TemplateEditorClient({ templateId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: allExercises = [] } = useExercises();

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [isExModalOpen, setIsExModalOpen] = useState(false);
  const [exForm, setExForm] = useState(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();
  const [confirmRemoveDay, setConfirmRemoveDay] = useState(false);
  const [confirmRemoveWeek, setConfirmRemoveWeek] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [reorderingWeeks, setReorderingWeeks] = useState(false);
  const [reorderingDays, setReorderingDays] = useState(false);

  const displayName = templateName ?? template?.name ?? "";

  const sessions: any[] = useMemo(() => template?.sessions ?? [], [template?.sessions]);

  const weekNumbers = useMemo(
    () => [...new Set(sessions.map((s: any) => s.week_number as number))].sort((a, b) => a - b),
    [sessions]
  );

  // Sessions for the selected week, sorted by day_name number then by id for stability
  const weekSessions = useMemo(() => {
    return sessions
      .filter((s: any) => s.week_number === selectedWeek)
      .sort((a: any, b: any) => {
        const numA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
        return numA - numB || a.id - b.id;
      });
  }, [sessions, selectedWeek]);

  // Tab labels: append index when day_name is duplicated within the week
  const dayTabLabels = useMemo(() => {
    const nameCount: Record<string, number> = {};
    for (const s of weekSessions) nameCount[s.day_name] = (nameCount[s.day_name] || 0) + 1;
    const nameIdx: Record<string, number> = {};
    return weekSessions.map((s: any) => {
      if (nameCount[s.day_name] > 1) {
        nameIdx[s.day_name] = (nameIdx[s.day_name] || 0) + 1;
        return `${s.day_name} ${nameIdx[s.day_name]}`;
      }
      return s.day_name as string;
    });
  }, [weekSessions]);

  const isUniform = useMemo(() => {
    if (weekNumbers.length <= 1) return true;
    const weekMap = new Map<number, Set<string>>();
    for (const s of sessions) {
      if (!weekMap.has(s.week_number)) weekMap.set(s.week_number, new Set());
      weekMap.get(s.week_number)!.add(s.day_name);
    }
    const sets = [...weekMap.values()];
    const ref = sets[0];
    return sets.every((set) => {
      if (set.size !== ref.size) return false;
      for (const d of ref) if (!set.has(d)) return false;
      return true;
    });
  }, [sessions, weekNumbers]);

  // Select session by index (not by name) to support duplicate day names
  const activeSession = weekSessions[selectedDay - 1] ?? null;
  const selectedDayName = activeSession?.day_name ?? `Día ${selectedDay}`;

  const invalidateTemplate = () => {
    queryClient.invalidateQueries({ queryKey: ["template", templateId] });
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    startTransition(async () => {
      await updateTemplatePlan(templateId, displayName);
      invalidateTemplate();
      showStatus("Guardado");
    });
  };

  const handleAddDay = () => {
    startTransition(async () => {
      await addDayToAllWeeks(templateId);
      invalidateTemplate();
      setSelectedDay(weekSessions.length + 1);
    });
  };

  const handleConfirmRemoveDay = () => {
    if (weekSessions.length <= 1) return;
    const dayIndex = selectedDay - 1;

    // Collect the session ID at position `dayIndex` for every week
    const idsToDelete: number[] = [];
    for (const wk of weekNumbers) {
      const wkSessions = sessions
        .filter((s: any) => s.week_number === wk)
        .sort((a: any, b: any) => {
          const numA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
          return numA - numB || a.id - b.id;
        });
      if (wkSessions[dayIndex]) idsToDelete.push(wkSessions[dayIndex].id);
    }

    startTransition(async () => {
      const result = await removeSelectedDayFromTemplate(templateId, idsToDelete);
      if (result.success === false) return;
      invalidateTemplate();
      setSelectedDay((prev) => Math.min(prev, weekSessions.length - 1));
      setConfirmRemoveDay(false);
    });
  };

  const handleAddWeek = () => {
    startTransition(async () => {
      await addWeekToTemplate(templateId);
      invalidateTemplate();
      setSelectedWeek(weekNumbers.length + 1);
      setSelectedDay(1);
    });
  };

  const handleSwapWeek = (direction: 'left' | 'right') => {
    const idx = weekNumbers.indexOf(selectedWeek);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= weekNumbers.length) return;
    const weekB = weekNumbers[swapIdx];
    startTransition(async () => {
      await swapWeeksInTemplate(templateId, selectedWeek, weekB);
      invalidateTemplate();
      setSelectedWeek(weekB);
    });
  };

  const handleSwapDay = (direction: 'left' | 'right') => {
    const dayIdx = selectedDay - 1;
    const swapIdx = direction === 'left' ? dayIdx - 1 : dayIdx + 1;
    if (swapIdx < 0 || swapIdx >= weekSessions.length) return;
    startTransition(async () => {
      await swapDaysInTemplate(templateId, dayIdx, swapIdx);
      invalidateTemplate();
      setSelectedDay(swapIdx + 1);
    });
  };

  const handleConfirmRemoveWeek = () => {
    if (weekNumbers.length <= 1) return;
    startTransition(async () => {
      const result = await removeWeekFromTemplate(templateId, selectedWeek);
      if (result.success === false) return;
      invalidateTemplate();
      const remaining = weekNumbers.filter((wk) => wk !== selectedWeek);
      setSelectedWeek(remaining[remaining.length - 1] ?? remaining[0]);
      setSelectedDay(1);
      setConfirmRemoveWeek(false);
    });
  };

  const handleAddExercise = () => {
    if (!activeSession) return;
    startTransition(async () => {
      if (!exForm.exerciseId) return;
      await addExerciseToSession(
        activeSession.id,
        Number(exForm.exerciseId),
        exForm.target_sets,
        exForm.target_reps,
        exForm.target_weight,
        exForm.target_rpe,
        exForm.rest,
        exForm.coach_notes
      );
      invalidateTemplate();
      setExForm(DEFAULT_FORM);
      setIsExModalOpen(false);
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Cargando plantilla...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-red-400">Error al cargar la plantilla</p>
      </div>
    );
  }

  const noSessions = sessions.length === 0;
  const noDaySelected = !activeSession;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-4 md:px-6 md:py-6">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3">
        {/* Fila: Volver + indicador de guardado */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/coach/templates/${templateId}`)}
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          {statusMsg && (
            <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
              <Save className="h-3 w-3" /> {statusMsg}
            </span>
          )}
        </div>

        {/* Título editable — se guarda automáticamente al perder el foco */}
        <div>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setTemplateName(e.target.value)}
            onBlur={handleSaveName}
            placeholder="Nombre de la plantilla"
            className="w-full bg-transparent text-lg font-black uppercase tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700 focus:ring-0 md:text-2xl"
          />
          <p className="mt-0.5 text-xs text-zinc-500">
            Plantilla • {weekNumbers.length} {weekNumbers.length === 1 ? "semana" : "semanas"} •{" "}
            {weekSessions.length} {weekSessions.length === 1 ? "día" : "días"} por semana
          </p>
        </div>
      </div>

      {/* Non-uniform warning */}
      {!isUniform && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <p className="text-xs text-yellow-300">
            Esta plantilla tiene semanas con diferente número de días. Al agregar o eliminar días se
            normalizará la estructura.
          </p>
        </div>
      )}

      {/* ── Sección Semanas ── */}
      <div className="mb-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Semanas</p>

        {/* Tabs de semanas */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {weekNumbers.map((wk, i) => {
            const isActive = selectedWeek === wk;
            return (
              <div key={wk} className="flex shrink-0 items-center gap-0.5">
                {reorderingWeeks && isActive && i > 0 && (
                  <button
                    onClick={() => handleSwapWeek('left')}
                    disabled={isPending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-yellow-400 hover:bg-zinc-700 transition disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedWeek(wk); setSelectedDay(1); setAllExpanded(false); }}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                    isActive
                      ? "bg-yellow-400 text-black"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  Sem {i + 1}
                </button>
                {reorderingWeeks && isActive && i < weekNumbers.length - 1 && (
                  <button
                    onClick={() => handleSwapWeek('right')}
                    disabled={isPending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-yellow-400 hover:bg-zinc-700 transition disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Acciones de semana */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {!reorderingDays && (
            !reorderingWeeks ? (
              <>
                <button
                  onClick={handleAddWeek}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                  Agregar
                </button>
                {weekNumbers.length > 1 && (
                  <>
                    <button
                      onClick={() => setConfirmRemoveWeek(true)}
                      disabled={isPending}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                    <button
                      onClick={() => setReorderingWeeks(true)}
                      disabled={isPending}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      <ChevronRight className="h-3 w-3 -ml-1.5" />
                      Reordenar
                    </button>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={() => setReorderingWeeks(false)}
                className="flex items-center gap-1 rounded-lg bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1.5 text-[11px] font-black text-yellow-400 transition hover:bg-yellow-400/20"
              >
                Listo
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Sección Días ── */}
      {!noSessions && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Días</p>

          {/* Tabs de días */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {dayTabLabels.map((label, i) => {
              const isActive = selectedDay === i + 1;
              return (
                <div key={weekSessions[i]?.id ?? i} className="flex shrink-0 items-center gap-0.5">
                  {reorderingDays && isActive && i > 0 && (
                    <button
                      onClick={() => handleSwapDay('left')}
                      disabled={isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedDay(i + 1); setAllExpanded(false); }}
                    className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900"
                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                  {reorderingDays && isActive && i < dayTabLabels.length - 1 && (
                    <button
                      onClick={() => handleSwapDay('right')}
                      disabled={isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Acciones de día */}
          <div className="mt-1.5 flex items-center gap-1.5">
            {!reorderingWeeks && (
              !reorderingDays ? (
                <>
                  <button
                    onClick={handleAddDay}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </button>
                  {weekSessions.length > 1 && (
                    <>
                      <button
                        onClick={() => setConfirmRemoveDay(true)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar
                      </button>
                      <button
                        onClick={() => setReorderingDays(true)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-black text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-300 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3 w-3" />
                        <ChevronRight className="h-3 w-3 -ml-1.5" />
                        Reordenar
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setReorderingDays(false)}
                  className="flex items-center gap-1 rounded-lg bg-zinc-100/10 border border-zinc-100/20 px-2.5 py-1.5 text-[11px] font-black text-zinc-200 transition hover:bg-zinc-100/20"
                >
                  Listo
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Área de ejercicios ── */}
      {noSessions ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 py-24 text-center">
          <Dumbbell className="mb-4 h-12 w-12 text-zinc-800" />
          <p className="text-sm font-black uppercase tracking-widest text-zinc-600">Sin semanas</p>
          <p className="mt-1 text-xs text-zinc-700">Agrega una semana para empezar</p>
        </div>
      ) : noDaySelected ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 py-24 text-center">
          <Dumbbell className="mb-4 h-12 w-12 text-zinc-800" />
          <p className="text-sm font-black uppercase tracking-widest text-zinc-600">Sin sesión</p>
          <p className="mt-1 text-xs text-zinc-700">
            Esta semana no tiene un día &quot;{selectedDayName}&quot;.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-zinc-100">
                Semana {weekNumbers.indexOf(selectedWeek) + 1} — {selectedDayName}
              </p>
              <p className="text-xs text-zinc-500">
                {activeSession.session_exercises?.length ?? 0} ejercicios
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllExpanded(v => !v)}
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 transition hover:text-zinc-100 hover:border-zinc-600"
                title={allExpanded ? "Colapsar todo" : "Expandir todo"}
              >
                {allExpanded
                  ? <ChevronsDownUp className="h-3.5 w-3.5" />
                  : <ChevronsUpDown className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsExModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black transition hover:scale-105 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Agregar ejercicio</span>
                <span className="sm:hidden">Agregar</span>
              </button>
            </div>
          </div>

          <ExerciseFormModal
            isOpen={isExModalOpen}
            onClose={() => setIsExModalOpen(false)}
            formState={exForm}
            setFormState={setExForm}
            onSave={handleAddExercise}
            isPending={isPending}
            allExercises={allExercises}
          />

          {activeSession.session_exercises?.length > 0 ? (
            <ExerciseExcelGrid
              exercises={activeSession.session_exercises}
              role="COACH"
              isTemplate={true}
              allExpanded={allExpanded}
              onMutated={invalidateTemplate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 py-16 text-center">
              <Dumbbell className="mb-3 h-10 w-10 text-zinc-800" />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Sin ejercicios</p>
              <p className="mt-1 text-xs text-zinc-700">Usá el botón &quot;Agregar&quot; para empezar</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL ELIMINAR SEMANA */}
      {confirmRemoveWeek && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">
                  Eliminar Semana {weekNumbers.indexOf(selectedWeek) + 1}
                </h4>
              </div>
              <button
                onClick={() => setConfirmRemoveWeek(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <p className="text-sm text-zinc-400 leading-relaxed">
                ¿Eliminar esta semana y todos sus ejercicios? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setConfirmRemoveWeek(false)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRemoveWeek}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl bg-red-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-50"
              >
                {isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR DÍA */}
      {confirmRemoveDay && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Eliminar Día</h4>
              </div>
              <button
                onClick={() => setConfirmRemoveDay(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <p className="text-sm text-zinc-400 leading-relaxed">
                ¿Eliminar &quot;{dayTabLabels[selectedDay - 1] ?? selectedDayName}&quot; de todas las semanas? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setConfirmRemoveDay(false)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRemoveDay}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl bg-red-500 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-50"
              >
                {isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
