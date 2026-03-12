"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Calendar, Dumbbell, X, Trash2 } from "lucide-react";
import { useTemplate } from "@/hooks/useTemplates";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "@/app/(dashboard)/coach/student/ExerciseExcelGrid";
import { deleteDayFromPlan, updateTemplatePlan } from "@/app/(dashboard)/coach/student/actions";
import { useQueryClient } from "@tanstack/react-query";

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

  useEffect(() => {
    if (template?.name) {
      setTemplateName(template.name);
    }
  }, [template?.name]);

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

  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
    rest: 60,
    coach_notes: ""
  });

  const selectedSession = template?.sessions?.find((s: any) => s.id === selectedSessionId);

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

    const sessionsInWeek = template.sessions.filter((s: any) => s.week_number === weekNumber);
    const dayNumber = sessionsInWeek.length + 1;
    const nextOrder = template.sessions.length + 1;

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

  const removeSession = (orderIndex: number) => {
    window.location.reload();
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

  const updateArrayField = (field: string, index: number, value: string) => {
    setNewExForm((prev: any) => {
      const newArray = [...(prev[field] || [])];
      if (value === "" && field.includes("weight")) {
        newArray[index] = null;
      } else {
        newArray[index] = Number(value);
      }
      return { ...prev, [field]: newArray };
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
            <p className="text-sm text-zinc-500 ml-2">Plantilla • {template.sessions?.length || 0} sesiones</p>
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
                        <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800">
                          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                            Semana {weekNumber}
                          </h4>
                          <button
                            onClick={() => addSession(Number(weekNumber))}
                            className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-[10px] font-black text-zinc-400 hover:border-yellow-400 hover:text-yellow-400 transition-all"
                          >
                            <Plus className="h-3 w-3" />
                            Día
                          </button>
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
                    template.sessions && template.sessions.length > 0
                      ? Math.max(...template.sessions.map((s: any) => s.week_number))
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

              {isAddingExercise && (
                <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-6 space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-100">Nuevo Ejercicio</h4>
                    <button onClick={() => setIsAddingExercise(false)} className="text-zinc-500 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Ejercicio
                      </label>
                      <select
                        className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400"
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

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">
                        Sets
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-yellow-400 outline-none focus:border-yellow-400"
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
                        className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400"
                        value={newExForm.target_rpe}
                        onChange={(e) => setNewExForm({ ...newExForm, target_rpe: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Pausa (segundos)
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400"
                        value={newExForm.rest}
                        onChange={(e) => setNewExForm({ ...newExForm, rest: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {newExForm.target_sets > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Configuración por Set
                      </div>

                      <div className="w-full overflow-x-auto rounded-xl border border-zinc-800 bg-black shadow-2xl">
                        <table className="w-full border-collapse text-[11px] font-medium">
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
                              <th className="px-2 py-2 text-center border-r border-zinc-800 w-8">SET</th>
                              <th className="px-2 py-2 text-center border-r border-zinc-800 w-32">REPS</th>
                              <th className="px-2 py-2 text-center border-r border-zinc-800 w-32">KILOS</th>
                              <th className="px-3 py-2 text-left">OBS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {Array.from({ length: newExForm.target_sets }).map((_, i) => (
                              <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                                <td className="px-2 py-2 border-r border-zinc-800 text-center font-black text-yellow-400">
                                  {i + 1}
                                </td>
                                <td className="px-2 py-2 border-r border-zinc-800">
                                  <input
                                    type="number"
                                    min="1"
                                    className="w-full h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300"
                                    value={newExForm.target_reps?.[i] ?? 10}
                                    onChange={(e) => updateArrayField("target_reps", i, e.target.value)}
                                  />
                                </td>
                                <td className="px-2 py-2 border-r border-zinc-800">
                                  <input
                                    type="number"
                                    step="0.5"
                                    className="w-full h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300"
                                    placeholder="Kg"
                                    value={newExForm.target_weight?.[i] ?? ""}
                                    onChange={(e) => updateArrayField("target_weight", i, e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    className="w-full bg-transparent outline-none text-zinc-300 text-xs"
                                    placeholder="Notas..."
                                    value={newExForm.coach_notes || ""}
                                    onChange={(e) => setNewExForm({ ...newExForm, coach_notes: e.target.value })}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={addExerciseToTemplate}
                    disabled={!newExForm.exerciseId || newExForm.target_sets === 0}
                    className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar Ejercicio
                  </button>
                </div>
              )}

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
