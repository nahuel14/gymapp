"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit, Trash2, X, Plus, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { DumbbellIcon } from "@/components/DumbbellIcon";
import { useTemplate } from "@/hooks/useTemplates";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { ExerciseFormModal } from "@/components/ExerciseFormModal";
import { deleteTemplatePlan, addExerciseToSession } from "@/app/(dashboard)/coach/student/actions";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_FORM = {
  exerciseId: "",
  target_sets: 3,
  target_reps: [10, 10, 10],
  target_weight: [null, null, null] as (number | null)[],
  target_rpe: 8,
  rest: 60,
  coach_notes: "",
};

export default function TemplateViewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const templateId = Number(params.id);
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: allExercises = [] } = useExercises();
  const [isPending, startTransition] = useTransition();

  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  // sessionId de la sesión donde se va a agregar ejercicio
  const [addingToSession, setAddingToSession] = useState<number | null>(null);
  const [exForm, setExForm] = useState(DEFAULT_FORM);

  const invalidateTemplate = () => {
    queryClient.invalidateQueries({ queryKey: ["template", templateId] });
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const handleConfirmDeleteTemplate = () => {
    startTransition(async () => {
      try {
        await deleteTemplatePlan(templateId);
        router.push("/coach/templates");
      } catch (error) {
        console.error("Error deleting template:", error);
      }
    });
  };

  const handleAddExercise = () => {
    if (addingToSession === null || !exForm.exerciseId) return;
    startTransition(async () => {
      await addExerciseToSession(
        addingToSession,
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
      setAddingToSession(null);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Cargando plantilla...</div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error al cargar la plantilla</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-3 py-4 md:px-6 md:py-6">
      {/* Header compacto */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push("/coach/templates")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="flex gap-1.5">
            <button
              onClick={() => setAllExpanded(v => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-400 transition hover:text-zinc-100 hover:border-zinc-600"
              title={allExpanded ? "Colapsar todo" : "Expandir todo"}
            >
              {allExpanded
                ? <ChevronsDownUp className="h-3.5 w-3.5" />
                : <ChevronsUpDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => router.push(`/coach/templates/${templateId}/edit`)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-black text-zinc-300 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              <Edit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </button>
            <button
              onClick={() => setConfirmDeleteTemplate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-black text-red-400 transition hover:bg-red-500/20 hover:border-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          </div>
        </div>

        <h1 className="text-lg font-black text-zinc-100 uppercase tracking-tight leading-tight">{template.name}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Plantilla • {template.sessions?.length || 0} sesiones • {template.total_exercises || 0} ejercicios
        </p>
      </div>

      <div className="space-y-4">
        {template.sessions && template.sessions.length > 0 ? (
          <>
            {Object.entries(
              template.sessions.reduce((acc: Record<number, any[]>, session: any) => {
                const week = session.week_number;
                if (!acc[week]) acc[week] = [];
                acc[week].push(session);
                return acc;
              }, {})
            )
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([weekNumber, sessions]) => (
                <div key={weekNumber} className="space-y-2">
                  <div className="flex items-center px-1 py-1 border-b border-zinc-800">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      Semana {weekNumber}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {(sessions as any[])
                      .sort((a, b) => {
                        const nA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
                        const nB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
                        return nA - nB || a.id - b.id;
                      })
                      .map((session: any) => (
                      <div key={session.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                          <div>
                            <h2 className="text-sm font-black text-zinc-100 uppercase tracking-tight">
                              {session.day_name}
                            </h2>
                            <p className="text-[10px] text-zinc-500">
                              {session.session_exercises?.length || 0} ejercicios
                            </p>
                          </div>

                          <button
                            onClick={() => { setExForm(DEFAULT_FORM); setAddingToSession(session.id); }}
                            className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-black text-black transition hover:scale-105 active:scale-95 shrink-0"
                          >
                            <Plus className="h-3 w-3" />
                            <span className="hidden sm:inline">Agregar ejercicio</span>
                            <span className="sm:hidden">Agregar</span>
                          </button>
                        </div>

                        {session.session_exercises && session.session_exercises.length > 0 ? (
                          <ExerciseExcelGrid
                            exercises={session.session_exercises}
                            role="COACH"
                            isTemplate={true}
                            allExpanded={allExpanded}
                            onMutated={invalidateTemplate}
                          />
                        ) : (
                          <div className="text-center py-6 rounded-xl border border-dashed border-zinc-800">
                            <DumbbellIcon className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                            <p className="text-zinc-600 font-black uppercase tracking-widest text-[10px]">
                              Sin ejercicios
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-zinc-800">
            <h3 className="text-sm font-black text-zinc-600 mb-1">Sin sesiones</h3>
            <p className="text-zinc-600 text-xs">Esta plantilla no tiene sesiones configuradas</p>
          </div>
        )}
      </div>

      {/* MODAL AGREGAR EJERCICIO */}
      <ExerciseFormModal
        isOpen={addingToSession !== null}
        onClose={() => setAddingToSession(null)}
        formState={exForm}
        setFormState={setExForm}
        onSave={handleAddExercise}
        isPending={isPending}
        allExercises={allExercises}
      />

      {/* MODAL ELIMINAR PLANTILLA */}
      {confirmDeleteTemplate && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Eliminar Plantilla</h4>
              </div>
              <button
                onClick={() => setConfirmDeleteTemplate(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <p className="text-sm text-zinc-400 leading-relaxed">
                ¿Estás seguro de eliminar esta plantilla? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
              <button
                onClick={() => setConfirmDeleteTemplate(false)}
                disabled={isPending}
                className="flex-1 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-sm font-black uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteTemplate}
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
