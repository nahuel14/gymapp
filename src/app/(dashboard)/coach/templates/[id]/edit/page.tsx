"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Calendar, Dumbbell, Trash2 } from "lucide-react";
import { useTemplate } from "@/hooks/useTemplates";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { deleteDayFromPlan, updateTemplatePlan } from "@/app/(dashboard)/coach/student/actions";
import { useQueryClient } from "@tanstack/react-query";
import { ExerciseFormModal } from "@/components/ExerciseFormModal";

export default function TemplateEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const templateId = Number(params.id);
  const { data: template, isLoading, error } = useTemplate(templateId);
  const { data: allExercises = [] } = useExercises();

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [planSessions, setPlanSessions] = useState<any[]>([]);

  useEffect(() => {
    if (template?.name) {
      setTemplateName(template.name);
    }
  }, [template?.name]);

  useEffect(() => {
    setPlanSessions(template?.sessions || []);
  }, [template?.sessions]);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert("Por favor ingresa un nombre para la plantilla");
      return;
    }

    setIsPending(true);
    try {
      await updateTemplatePlan(templateId, templateName);
      alert("Plantilla guardada exitosamente");
      router.refresh();
      router.push("/coach/templates");
    } catch (error) {
      console.error("Error guardando plantilla:", error);
      alert("Error al guardar la plantilla");
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteWeek = (weekNumber: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta semana y todos sus ejercicios?")) {
      return;
    }

    const sessionsToDelete = planSessions.filter((session: any) => session.week_number === weekNumber);
    const sessionIdsToDelete = new Set(sessionsToDelete.map((session: any) => session.id));

    setPlanSessions((prev) => prev.filter((session: any) => session.week_number !== weekNumber));

    if (selectedSessionId && sessionIdsToDelete.has(selectedSessionId)) {
      setSelectedSessionId(null);
      setIsAddingExercise(false);
    }
  };

  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
    rest: 60,
    coach_notes: ""
  });

  const selectedSession = planSessions.find((s: any) => s.id === selectedSessionId);

  const handleDeleteDay = async () => {
    if (!selectedSessionId) return;
    if (!confirm("¿Estás seguro de eliminar este día y todos sus ejercicios?")) {
      return;
    }

    try {
      await deleteDayFromPlan(selectedSessionId);
      await queryClient.invalidateQueries({ queryKey: ["template", templateId] });
      setSelectedSessionId(null);
      setIsAddingExercise(false);
      router.refresh();
    } catch (error) {
      console.error("Error deleting day:", error);
      alert("Error al eliminar el día");
    }
  };

  const addSession = async (weekNumber: number) => {
    if (!templateId || !template) return;

    const sessionsInWeek = planSessions.filter((s: any) => s.week_number === weekNumber);
    const dayNumber = sessionsInWeek.length + 1;
    const nextOrder = planSessions.length + 1;

    try {
      const response = await fetch("/api/template-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          dayName: `Día ${dayNumber}`,
          orderIndex: nextOrder,
          weekNumber: weekNumber
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error adding session:", error);
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Error in addSession:", error);
    }
  };

  const addExerciseToTemplate = async () => {
    if (!selectedSessionId || !newExForm.exerciseId || !templateId) return;

    try {
      const response = await fetch("/api/template-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          sessionId: selectedSessionId,
          exerciseId: Number(newExForm.exerciseId),
          targetSets: newExForm.target_sets,
          targetReps: newExForm.target_reps,
          targetWeight: newExForm.target_weight,
          targetRpe: newExForm.target_rpe,
          rest: newExForm.rest,
          notes: newExForm.coach_notes || ""
        })
      });

      if (response.ok) {
        setNewExForm({
          exerciseId: "",
          target_sets: 3,
          target_reps: [10, 10, 10],
          target_weight: [null, null, null],
          target_rpe: 8,
          rest: 60,
          coach_notes: ""
        });
        setIsAddingExercise(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("Error adding exercise:", error);
    }
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
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-2xl font-black text-zinc-100 uppercase tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-yellow-400/50 rounded px-2 -ml-2 w-full"
              placeholder="Nombre de la plantilla"
            />
            <p className="text-sm text-zinc-500 ml-2">Plantilla • {planSessions.length} sesiones</p>
          </div>

          <button
            onClick={handleSaveTemplate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Guardando..." : "Guardar Plantilla"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Estructura del Plan</h3>
            </div>

            <div className="space-y-6">
              {planSessions.length > 0 ? (
                <>
                  {Object.entries(
                    planSessions.reduce((acc: Record<number, any[]>, session: any) => {
                      const week = session.week_number;
                      if (!acc[week]) acc[week] = [];
                      acc[week].push(session);
                      return acc;
                    }, {})
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([weekNumber, sessions], index) => (
                      <div key={weekNumber} className="space-y-2">
                        <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800">
                          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                            Semana {index + 1}
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => addSession(Number(weekNumber))}
                              className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-[10px] font-black text-zinc-400 hover:border-yellow-400 hover:text-yellow-400 transition-all"
                            >
                              <Plus className="h-3 w-3" />
                              Día
                            </button>
                            <button
                              onClick={() => handleDeleteWeek(Number(weekNumber))}
                              className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-500 transition-all hover:border-red-500/40 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(sessions as any[]).map((session: any) => (
                            <button
                              key={session.id}
                              onClick={() => setSelectedSessionId(session.id)}
                              className={`w-full text-left rounded-lg p-3 transition-all ${
                                selectedSessionId === session.id
                                  ? "bg-yellow-400/20 border border-yellow-400 text-yellow-400"
                                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-black uppercase">{session.day_name}</span>
                                <span className="text-xs text-zinc-500">
                                  {session.session_exercises?.length || 0} ejercicios
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              ) : (
                <div className="text-center py-8 rounded-xl border-2 border-dashed border-zinc-800">
                  <Calendar className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-xs font-medium">
                    Agrega una semana para empezar a construir tu plantilla
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  const maxWeek =
                    planSessions.length > 0
                      ? Math.max(...planSessions.map((s: any) => s.week_number))
                      : 0;
                  addSession(maxWeek + 1);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-800 px-4 py-3 text-xs font-black text-zinc-500 hover:border-yellow-400 hover:text-yellow-400 transition-all"
              >
                <Plus className="h-4 w-4" />
                Agregar Semana
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedSession ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
                    {selectedSession.day_name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {selectedSession.session_exercises?.length || 0} ejercicios
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddingExercise(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Ejercicio
                  </button>

                  <button
                    onClick={handleDeleteDay}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-black text-red-400 transition hover:bg-red-500/20 hover:border-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar Día
                  </button>
                </div>
              </div>

              <ExerciseFormModal
                isOpen={isAddingExercise}
                onClose={() => setIsAddingExercise(false)}
                formState={newExForm}
                setFormState={setNewExForm}
                onSave={addExerciseToTemplate}
                isPending={isPending}
                allExercises={allExercises}
              />

              {selectedSession.session_exercises && selectedSession.session_exercises.length > 0 ? (
                <ExerciseExcelGrid
                  exercises={selectedSession.session_exercises}
                  role="COACH"
                  isTemplate={true}
                />
              ) : (
                <div className="text-center py-12 rounded-xl border-2 border-dashed border-zinc-800">
                  <Dumbbell className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">
                    Sin ejercicios para este día
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24 rounded-xl border-2 border-dashed border-zinc-800">
              <Calendar className="h-16 w-16 text-zinc-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-600 mb-2">Selecciona un día</h3>
              <p className="text-zinc-500 text-sm">
                Elige un día de la lista para empezar a agregar ejercicios
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
