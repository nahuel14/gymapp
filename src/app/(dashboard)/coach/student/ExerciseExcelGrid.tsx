"use client";

import { useState, useTransition } from "react";
import { 
  Play, 
  Settings2, 
  Trash2, 
  Save, 
  X
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import { updateExerciseInSession, deleteExerciseFromSession } from "./actions";
import { useQueryClient } from "@tanstack/react-query";

type SessionExercise = any;

interface Props {
  exercises: SessionExercise[];
  role: "COACH" | "STUDENT";
  isTemplate?: boolean;
}

export function ExerciseExcelGrid({ exercises, role, isTemplate = false }: Props) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const sortedExercises = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const getRpeColor = (rpe: number | null) => {
    if (!rpe) return "text-muted-foreground";
    if (rpe <= 6) return "text-emerald-400";
    if (rpe === 7) return "text-yellow-400";
    if (rpe === 8) return "text-orange-400";
    if (rpe === 9) return "text-red-400";
    if (rpe >= 10) return "text-red-600 font-bold";
    return "text-muted-foreground";
  };

  const handleStartEdit = (ex: any) => {
    setEditingId(ex.id);
    setEditForm({
      target_sets: ex.target_sets || 0,
      target_reps: ex.target_reps || Array(ex.target_sets || 0).fill(10),
      target_weight: ex.target_weight || Array(ex.target_sets || 0).fill(null),
      target_rpe: ex.target_rpe || 0,
      rest_seconds: ex.rest_seconds || 0,
      coach_notes: ex.coach_notes || "",
      actual_sets: ex.actual_sets || ex.target_sets || 0,
      actual_reps: ex.actual_reps || Array(ex.actual_sets || ex.target_sets || 0).fill(10),
      actual_weight: ex.actual_weight || Array(ex.actual_sets || ex.target_sets || 0).fill(null),
      actual_rpe: ex.actual_rpe || 0,
      student_notes: ex.student_notes || ""
    });
  };

  const handleSave = async (id: number) => {
    startTransition(async () => {
      await updateExerciseInSession(id, editForm);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setEditingId(null);
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar ejercicio?")) return;
    startTransition(async () => {
      await deleteExerciseFromSession(id);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
    });
  };

  const updateArrayField = (field: string, index: number, value: string) => {
    setEditForm((prev: any) => {
      const newArray = [...(prev[field] || [])];
      if (value === "" && field.includes("weight")) {
        newArray[index] = null;
      } else {
        newArray[index] = Number(value);
      }
      return { ...prev, [field] : newArray };
    });
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-full">
      {sortedExercises.map((ex) => {
        const exerciseData = ex.exercise || ex.exercises;
        const isEditing = editingId === ex.id;
        const data = isEditing ? editForm : ex;
        const coachSets = Number(data.target_sets || 0);
        const studentSets = Number(data.actual_sets || coachSets);

        return (
          <div key={ex.id} className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-4 flex flex-col gap-4 shadow-lg relative overflow-hidden">
            {/* Cabecera del Ejercicio */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                    {exerciseData?.body_zone ? BODY_ZONE_LABELS[exerciseData.body_zone as keyof typeof BODY_ZONE_LABELS] : "--"}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                    {exerciseData?.category ? EXERCISE_CATEGORY_LABELS[exerciseData.category as keyof typeof EXERCISE_CATEGORY_LABELS] : "--"}
                  </span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-zinc-100 mt-0.5 leading-tight">
                  {exerciseData?.name || "--"}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {exerciseData?.video_url && (
                  <a
                    href={exerciseData.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-800 text-yellow-400 hover:bg-yellow-400 hover:text-black hover:scale-105 active:scale-95 transition-all shadow-md"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </a>
                )}
                {role === "COACH" && !isEditing && (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleStartEdit(ex)} className="h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 active:scale-95 transition-all">
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(ex.id)} className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full">
              {/* Sección COACH (Prescripción) */}
              <div className="flex-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 flex flex-col gap-3 w-full">
                <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                    Coach
                  </span>
                </div>

                {role === "COACH" && isEditing ? (
                  <div className="flex flex-col gap-3 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets</label>
                        <input
                          type="number"
                          className="h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.target_sets || 0}
                          onChange={e => setEditForm({ ...editForm, target_sets: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">RPE</label>
                        <input
                          type="number"
                          step="0.5"
                          className="h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.target_rpe || 0}
                          onChange={e => setEditForm({ ...editForm, target_rpe: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Pausa</label>
                        <input
                          type="number"
                          className="h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.rest_seconds || 0}
                          onChange={e => setEditForm({ ...editForm, rest_seconds: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800 overflow-hidden w-full">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Series detalladas</span>
                      <div className="flex flex-col gap-2 w-full">
                        {Array.from({ length: coachSets }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2 w-full">
                            <span className="w-5 shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-500">S{i + 1}</span>
                            <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                              <input
                                type="number"
                                min="1"
                                placeholder="Reps"
                                className="h-9 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_reps?.[i] ?? ""}
                                onChange={e => updateArrayField("target_reps", i, e.target.value)}
                              />
                              <input
                                type="number"
                                step="0.5"
                                placeholder="Kg"
                                className="h-9 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_weight?.[i] ?? ""}
                                onChange={e => updateArrayField("target_weight", i, e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Notas del coach</label>
                      <textarea
                        className="min-h-[60px] w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs text-zinc-100 outline-none focus:border-yellow-400 resize-none"
                        value={data.coach_notes || ""}
                        onChange={e => setEditForm({ ...editForm, coach_notes: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Sets</p>
                        <p className="text-sm font-black text-zinc-100">{coachSets}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">RPE</p>
                        <p className="text-sm font-black text-zinc-100">{data.target_rpe || "--"}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Pausa</p>
                        <p className="text-sm font-black text-zinc-100">{data.rest_seconds ? `${data.rest_seconds}s` : "--"}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mt-1">
                      {Array.from({ length: coachSets }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between bg-zinc-900/40 px-3 py-2.5 rounded-lg border border-zinc-800/50">
                          <span className="text-[10px] font-black text-zinc-500 shrink-0">SET {i+1}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-zinc-200 min-w-[50px] text-right">{data.target_reps?.[i] ?? "-"} reps</span>
                            <span className="text-sm font-medium text-zinc-400 min-w-[40px] text-right">{data.target_weight?.[i] ? `${data.target_weight[i]}kg` : "--"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {data.coach_notes && (
                      <div className="bg-yellow-400/5 border border-yellow-400/10 rounded-lg p-2.5">
                        <p className="text-[11px] text-yellow-500/80 italic leading-relaxed">"{data.coach_notes}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección STUDENT (Ejecución) */}
              {!isTemplate && (
                <div className="flex-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 flex flex-col gap-3 w-full">
                  <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        Alumno
                      </span>
                    </div>
                    {role === "STUDENT" && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(ex)}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-400/20 active:scale-95 transition-all"
                      >
                        <Settings2 className="h-3 w-3" /> Anotar
                      </button>
                    )}
                  </div>

                  {role === "STUDENT" && isEditing ? (
                    <div className="flex flex-col gap-3 animate-in fade-in w-full">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets Hechos</label>
                          <input
                            type="number"
                            className="h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm font-black text-emerald-400 outline-none focus:border-emerald-400"
                            value={data.actual_sets || 0}
                            onChange={e => setEditForm({ ...editForm, actual_sets: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">RPE Sentido</label>
                          <input
                            type="number"
                            step="0.5"
                            className="h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-sm font-black text-emerald-400 outline-none focus:border-emerald-400"
                            value={data.actual_rpe || 0}
                            onChange={e => setEditForm({ ...editForm, actual_rpe: Number(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2.5 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800 overflow-hidden w-full">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tus pesos y reps</span>
                        <div className="flex flex-col gap-2 w-full">
                          {Array.from({ length: studentSets }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2 w-full">
                              <span className="w-5 shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-500">S{i + 1}</span>
                              <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Reps"
                                  className="h-9 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xs font-black text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_reps?.[i] ?? ""}
                                  onChange={e => updateArrayField("actual_reps", i, e.target.value)}
                                />
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder="Kg"
                                  className="h-9 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-xs font-black text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_weight?.[i] ?? ""}
                                  onChange={e => updateArrayField("actual_weight", i, e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Mis notas</label>
                        <textarea
                          className="min-h-[60px] w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs text-zinc-100 outline-none focus:border-emerald-400 resize-none"
                          placeholder="Ej: Me dolió un poco el hombro..."
                          value={data.student_notes || ""}
                          onChange={e => setEditForm({ ...editForm, student_notes: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {ex.actual_sets ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-800">
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Sets</p>
                              <p className="text-sm font-black text-emerald-400">{ex.actual_sets}</p>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-800">
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">RPE</p>
                              <p className={`text-sm font-black ${getRpeColor(ex.actual_rpe)}`}>{ex.actual_rpe || "--"}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 mt-1">
                            {Array.from({ length: studentSets }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between bg-zinc-900/40 px-3 py-2.5 rounded-lg border border-zinc-800/50">
                                <span className="text-[10px] font-black text-zinc-500 shrink-0">SET {i+1}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-bold text-zinc-200 min-w-[50px] text-right">{ex.actual_reps?.[i] ?? "-"} reps</span>
                                  <span className="text-sm font-medium text-emerald-400 min-w-[40px] text-right">{ex.actual_weight?.[i] ? `${ex.actual_weight[i]}kg` : "--"}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {ex.student_notes && (
                            <div className="bg-emerald-400/5 border border-emerald-400/10 rounded-lg p-2.5">
                              <p className="text-[11px] text-emerald-500/80 italic leading-relaxed">"{ex.student_notes}"</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                          <p className="text-[11px] font-medium text-zinc-500 mb-1">Aún no completaste este ejercicio.</p>
                          {role === "STUDENT" && (
                            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Presioná ANOTAR para registrar tu avance.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acciones de Guardado */}
            {isEditing && (
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 rounded-xl bg-zinc-900 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSave(ex.id)}
                  disabled={isPending}
                  className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-widest text-black transition-all active:scale-95 disabled:opacity-50 ${role === "COACH" ? "bg-yellow-400 hover:bg-yellow-300" : "bg-emerald-400 hover:bg-emerald-300"}`}
                >
                  {isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}