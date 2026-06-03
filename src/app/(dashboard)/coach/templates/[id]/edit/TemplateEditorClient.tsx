"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, Dumbbell, AlertTriangle } from "lucide-react";
import { useTemplate } from "@/hooks/useTemplates";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { ExerciseFormModal } from "@/components/ExerciseFormModal";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateTemplatePlan,
  addDayToAllWeeks,
  removeDayFromAllWeeks,
  addWeekToTemplate,
  removeWeekFromTemplate,
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
  const [isConfirmRemoveDay, setIsConfirmRemoveDay] = useState(false);
  const [isConfirmRemoveWeek, setIsConfirmRemoveWeek] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Sync name from data on first load
  const displayName = templateName ?? template?.name ?? "";

  const sessions: any[] = useMemo(() => template?.sessions ?? [], [template?.sessions]);

  // Derived: sorted unique week numbers
  const weekNumbers = useMemo(
    () => [...new Set(sessions.map((s: any) => s.week_number as number))].sort((a, b) => a - b),
    [sessions]
  );

  // Derived: sorted unique day names for the selected week
  const dayNames = useMemo(() => {
    const inWeek = sessions.filter((s: any) => s.week_number === selectedWeek);
    const names = [...new Set(inWeek.map((s: any) => s.day_name as string))];
    names.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
    return names;
  }, [sessions, selectedWeek]);

  // Detect non-uniform legacy templates
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

  // Active session for selected week × day
  const selectedDayName = dayNames[selectedDay - 1] ?? `Día ${selectedDay}`;
  const activeSession = sessions.find(
    (s: any) => s.week_number === selectedWeek && s.day_name === selectedDayName
  );

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
      showStatus("Plantilla guardada");
    });
  };

  const handleAddDay = () => {
    startTransition(async () => {
      await addDayToAllWeeks(templateId);
      invalidateTemplate();
      // Select the new day
      setSelectedDay(dayNames.length + 1);
    });
  };

  const handleRemoveDay = () => {
    if (dayNames.length <= 1) return;
    startTransition(async () => {
      const result = await removeDayFromAllWeeks(templateId);
      if (result.success === false) return;
      invalidateTemplate();
      setSelectedDay((prev) => Math.min(prev, dayNames.length - 1));
      setIsConfirmRemoveDay(false);
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

  const handleRemoveWeek = () => {
    if (weekNumbers.length <= 1) return;
    startTransition(async () => {
      const result = await removeWeekFromTemplate(templateId, selectedWeek);
      if (result.success === false) return;
      invalidateTemplate();
      // Move to previous week or first available
      const remaining = weekNumbers.filter((wk) => wk !== selectedWeek);
      setSelectedWeek(remaining[remaining.length - 1] ?? remaining[0]);
      setSelectedDay(1);
      setIsConfirmRemoveWeek(false);
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
    <div className="min-h-screen bg-zinc-950 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <button
          onClick={() => router.push("/coach/templates")}
          className="flex w-fit items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="w-full bg-transparent text-2xl font-black uppercase tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700 focus:ring-0"
            />
            <p className="text-xs text-zinc-500">
              Plantilla • {weekNumbers.length} {weekNumbers.length === 1 ? "semana" : "semanas"} •{" "}
              {dayNames.length} {dayNames.length === 1 ? "día" : "días"} por semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusMsg && (
              <span className="text-xs font-bold text-yellow-400">{statusMsg}</span>
            )}
            <button
              onClick={handleSaveName}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black transition hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isPending ? "Guardando..." : "Guardar Plantilla"}
            </button>
          </div>
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

      {/* Week tabs */}
      <div className="mb-1 flex items-center gap-1 overflow-x-auto pb-1">
        {weekNumbers.map((wk, i) => (
          <button
            key={wk}
            onClick={() => { setSelectedWeek(wk); setSelectedDay(1); }}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
              selectedWeek === wk
                ? "bg-yellow-400 text-black"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            Semana {i + 1}
          </button>
        ))}
        <button
          onClick={handleAddWeek}
          disabled={isPending}
          className="shrink-0 flex items-center gap-1 rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          Semana
        </button>
        {weekNumbers.length > 1 && !isConfirmRemoveWeek && (
          <button
            onClick={() => setIsConfirmRemoveWeek(true)}
            disabled={isPending}
            className="shrink-0 flex items-center gap-1 rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Eliminar Semana
          </button>
        )}
        {isConfirmRemoveWeek && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-red-400">
              ¿Eliminar Semana {weekNumbers.indexOf(selectedWeek) + 1} y todos sus ejercicios?
            </span>
            <button
              onClick={handleRemoveWeek}
              disabled={isPending}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              Sí
            </button>
            <button
              onClick={() => setIsConfirmRemoveWeek(false)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-black text-zinc-400 transition hover:bg-zinc-800"
            >
              No
            </button>
          </div>
        )}
      </div>

      {/* Day tabs */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-1">
        {noSessions ? (
          <p className="text-xs text-zinc-600">Agregá una semana para empezar</p>
        ) : (
          <>
            {dayNames.map((name, i) => (
              <button
                key={name}
                onClick={() => setSelectedDay(i + 1)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                  selectedDay === i + 1
                    ? "bg-zinc-100 text-zinc-900"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {name}
              </button>
            ))}
            <button
              onClick={handleAddDay}
              disabled={isPending}
              className="shrink-0 flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              Día
            </button>
            {dayNames.length > 1 && !isConfirmRemoveDay && (
              <button
                onClick={() => setIsConfirmRemoveDay(true)}
                disabled={isPending}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
                Eliminar Día
              </button>
            )}
            {isConfirmRemoveDay && (
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-xs text-red-400">¿Eliminar &quot;{dayNames[dayNames.length - 1]}&quot; de todas las semanas?</span>
                <button
                  onClick={handleRemoveDay}
                  disabled={isPending}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  Sí
                </button>
                <button
                  onClick={() => setIsConfirmRemoveDay(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-black text-zinc-400 transition hover:bg-zinc-800"
                >
                  No
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Exercise area */}
      {noSessions ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 py-24 text-center">
          <Dumbbell className="mb-4 h-12 w-12 text-zinc-800" />
          <p className="text-sm font-black uppercase tracking-widest text-zinc-600">
            Sin semanas
          </p>
          <p className="mt-1 text-xs text-zinc-700">
            Agrega una semana para empezar a construir tu plantilla
          </p>
        </div>
      ) : noDaySelected ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 py-24 text-center">
          <Dumbbell className="mb-4 h-12 w-12 text-zinc-800" />
          <p className="text-sm font-black uppercase tracking-widest text-zinc-600">
            Sin sesión
          </p>
          <p className="mt-1 text-xs text-zinc-700">
            Esta semana no tiene un día &quot;{selectedDayName}&quot;. La estructura es no uniforme.
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
            <button
              onClick={() => setIsExModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black transition hover:scale-105 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar ejercicio
            </button>
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
              onMutated={invalidateTemplate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 py-16 text-center">
              <Dumbbell className="mb-3 h-10 w-10 text-zinc-800" />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-600">
                Sin ejercicios
              </p>
              <p className="mt-1 text-xs text-zinc-700">
                Usá el botón &quot;Agregar ejercicio&quot; para empezar
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
