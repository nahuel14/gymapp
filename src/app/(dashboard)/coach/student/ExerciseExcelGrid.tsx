"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Play,
  Settings2,
  Trash2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import { updateExerciseInSession, deleteExerciseFromSession, swapExerciseOrder } from "./actions";
import { useQueryClient } from "@tanstack/react-query";

type SessionExercise = any;

interface Props {
  exercises: SessionExercise[];
  role: "COACH" | "STUDENT";
  isTemplate?: boolean;
  allExpanded?: boolean;
}

export function ExerciseExcelGrid({ exercises, role, isTemplate = false, allExpanded = false }: Props) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const sortedExercises = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setExpandedIds(allExpanded ? new Set(exercises.map(e => e.id)) : new Set());
  }, [allExpanded, exercises]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    setExpandedIds(prev => new Set([...prev, ex.id]));
    setEditingId(ex.id);
    
    const hasStudentData = ex.actual_sets && ex.actual_sets > 0;
    const initialSets = hasStudentData ? ex.actual_sets : (ex.target_sets || 0);

    // Mapeo seguro: copiamos valor por valor lo que puso el profe (o dejamos por defecto)
    const safeTargetReps = Array.from({ length: initialSets }).map((_, i) => ex.target_reps?.[i] ?? 10);
    const safeTargetWeight = Array.from({ length: initialSets }).map((_, i) => ex.target_weight?.[i] ?? null);

    const initialReps = hasStudentData && ex.actual_reps ? ex.actual_reps : safeTargetReps;
    const initialWeight = hasStudentData && ex.actual_weight ? ex.actual_weight : safeTargetWeight;

    setEditForm({
      target_sets: ex.target_sets || 0,
      target_reps: ex.target_reps || Array(ex.target_sets || 0).fill(10),
      target_weight: ex.target_weight || Array(ex.target_sets || 0).fill(null),
      target_rpe: ex.target_rpe || 0,
      rest_seconds: ex.rest_seconds || 0,
      coach_notes: ex.coach_notes || "",
      // Inyectamos los datos clonados
      actual_sets: initialSets,
      actual_reps: initialReps,
      actual_weight: initialWeight,
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

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const curr = sortedExercises[index];
    const prev = sortedExercises[index - 1];
    startTransition(async () => {
      await swapExerciseOrder(curr.id, prev.order_index ?? index - 1, prev.id, curr.order_index ?? index);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === sortedExercises.length - 1) return;
    const curr = sortedExercises[index];
    const next = sortedExercises[index + 1];
    startTransition(async () => {
      await swapExerciseOrder(curr.id, next.order_index ?? index + 1, next.id, curr.order_index ?? index);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
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
    <div className="flex flex-col gap-3 w-full max-w-full">
      {sortedExercises.map((ex, index) => {
        const exerciseData = ex.exercise || ex.exercises;
        const isEditing = editingId === ex.id;
        const isExpanded = expandedIds.has(ex.id) || isEditing;
        const data = isEditing ? editForm : ex;
        const coachSets = Number(data.target_sets || 0);
        const studentSets = Number(data.actual_sets || coachSets);

        const hasStudentData = ex.actual_sets && ex.actual_sets > 0;
        
        // MEJORA 2: Validación de RPE Obligatorio
        // El botón se deshabilita si está cargando (isPending) O si el rol es Alumno Y el RPE es nulo o 0.
        const isSaveDisabled = isPending || (role === "STUDENT" && (!data.actual_rpe || data.actual_rpe <= 0));

        return (
          <div key={ex.id} className="bg-zinc-900/40 rounded-xl border border-zinc-800/80 p-3 flex flex-col gap-2.5 shadow-md relative overflow-hidden">
            {/* Cabecera del Ejercicio */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                {isExpanded && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                      {exerciseData?.body_zone ? BODY_ZONE_LABELS[exerciseData.body_zone as keyof typeof BODY_ZONE_LABELS] : "--"}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                      {exerciseData?.category ? EXERCISE_CATEGORY_LABELS[exerciseData.category as keyof typeof EXERCISE_CATEGORY_LABELS] : "--"}
                    </span>
                  </div>
                )}
                <h3 className="text-sm font-black uppercase tracking-tight text-zinc-100 leading-snug">
                  {exerciseData?.name || "--"}
                </h3>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {exerciseData?.video_url && (
                  <a
                    href={exerciseData.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-zinc-800 text-yellow-400 hover:bg-yellow-400 hover:text-black hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    <Play className="h-3 w-3 fill-current" />
                  </a>
                )}
                {role === "COACH" && !isEditing && !isExpanded && (
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || isPending}
                      className="h-7 w-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === sortedExercises.length - 1 || isPending}
                      className="h-7 w-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {role === "COACH" && !isEditing && isExpanded && (
                  <>
                    <button onClick={() => handleStartEdit(ex)} className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/50 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 active:scale-95 transition-all">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(ex.id)} className="h-7 w-7 flex items-center justify-center rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {!isEditing && (
                  <button
                    onClick={() => toggleExpand(ex.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/30 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
            <div className="flex flex-col md:flex-row gap-2 w-full">
              {/* Sección COACH */}
              <div className="flex-1 rounded-lg bg-zinc-950/80 border border-zinc-800/80 p-2 flex flex-col gap-2 w-full">
                <div className="flex items-center gap-1.5 border-b border-zinc-800/50 pb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400">
                    Coach
                  </span>
                </div>

                {role === "COACH" && isEditing ? (
                  <div className="flex flex-col gap-2 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets</label>
                        <input
                          type="number"
                          className="h-8 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-1 text-center text-xs font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.target_sets || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setEditForm({ ...editForm, target_sets: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 text-center">RPE</label>
                        <input
                          type="number"
                          step="0.5"
                          className="h-8 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-1 text-center text-xs font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.target_rpe || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setEditForm({ ...editForm, target_rpe: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 text-center">Pausa</label>
                        <input
                          type="number"
                          className="h-8 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-1 text-center text-xs font-black text-yellow-400 outline-none focus:border-yellow-400"
                          value={data.rest_seconds || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setEditForm({ ...editForm, rest_seconds: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-800 w-full">
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Series</span>
                      <div className="flex flex-col gap-1.5 w-full">
                        {Array.from({ length: coachSets }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2 w-full">
                            <span className="w-4 shrink-0 text-[9px] font-black uppercase tracking-widest text-zinc-500">S{i + 1}</span>
                            <div className="flex-1 grid grid-cols-2 gap-1.5 min-w-0">
                              <input
                                type="number"
                                min="1"
                                placeholder="Reps"
                                className="h-7 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_reps?.[i] ?? ""}
                                onFocus={(e) => e.target.select()}
                                onChange={e => updateArrayField("target_reps", i, e.target.value)}
                              />
                              <input
                                type="number"
                                step="0.5"
                                placeholder="Kg"
                                className="h-7 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_weight?.[i] ?? ""}
                                onFocus={(e) => e.target.select()}
                                onChange={e => updateArrayField("target_weight", i, e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Notas</label>
                      <textarea
                        className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-[11px] text-zinc-100 outline-none focus:border-yellow-400 resize-none"
                        value={data.coach_notes || ""}
                        onChange={e => setEditForm({ ...editForm, coach_notes: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-zinc-900/50 rounded-md p-1.5 text-center border border-zinc-800">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Sets</p>
                        <p className="text-xs font-black text-zinc-100">{coachSets}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-md p-1.5 text-center border border-zinc-800">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">RPE</p>
                        <p className="text-xs font-black text-zinc-100">{data.target_rpe || "--"}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-md p-1.5 text-center border border-zinc-800">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Pausa</p>
                        <p className="text-xs font-black text-zinc-100">{data.rest_seconds ? `${data.rest_seconds}s` : "--"}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {Array.from({ length: coachSets }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between bg-zinc-900/40 px-2 py-1.5 rounded border border-zinc-800/50">
                          <span className="text-[9px] font-black text-zinc-500 shrink-0">SET {i+1}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-200 min-w-9 text-right">{data.target_reps?.[i] ?? "-"} reps</span>
                            <span className="text-[11px] font-medium text-zinc-400 min-w-8 text-right">{data.target_weight?.[i] ? `${data.target_weight[i]}kg` : "--"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {data.coach_notes && (
                      <div className="bg-yellow-400/5 border border-yellow-400/10 rounded-md p-2">
                        <p className="text-[10px] text-yellow-500/80 italic leading-snug">&quot;{data.coach_notes}&quot;</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección STUDENT */}
              {!isTemplate && (
                <div className="flex-1 rounded-lg bg-zinc-950/80 border border-zinc-800/80 p-2 flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between border-b border-zinc-800/50 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                        Alumno
                      </span>
                    </div>
                    {role === "STUDENT" && !isEditing && hasStudentData && (
                      <button
                        onClick={() => handleStartEdit(ex)}
                        className="flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 active:scale-95 transition-all"
                      >
                        <Settings2 className="h-3 w-3" /> Editar
                      </button>
                    )}
                  </div>

                  {role === "STUDENT" && isEditing ? (
                    <div className="flex flex-col gap-2 animate-in fade-in w-full">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets Hechos</label>
                          <input
                            type="number"
                            className="h-8 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-1 text-center text-xs font-black text-emerald-400 outline-none focus:border-emerald-400"
                            value={data.actual_sets || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={e => setEditForm({ ...editForm, actual_sets: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={`text-[8px] font-black uppercase tracking-widest text-center ${(!data.actual_rpe || data.actual_rpe <= 0) ? 'text-red-400 animate-pulse' : 'text-zinc-500'}`}>
                            {(!data.actual_rpe || data.actual_rpe <= 0) ? 'RPE Obligatorio *' : 'RPE Sentido'}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            className={`h-8 w-full min-w-0 rounded-md border bg-zinc-900 px-1 text-center text-xs font-black outline-none transition-colors ${
                              (!data.actual_rpe || data.actual_rpe <= 0) 
                              ? 'border-red-500/50 focus:border-red-500 text-red-400' 
                              : 'border-zinc-700 focus:border-emerald-400 text-emerald-400'
                            }`}
                            value={data.actual_rpe || ""}
                            placeholder="Del 1 al 10"
                            onFocus={(e) => e.target.select()}
                            onChange={e => setEditForm({ ...editForm, actual_rpe: Number(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-800 w-full">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Tus pesos y reps</span>
                        <div className="flex flex-col gap-1.5 w-full">
                          {Array.from({ length: studentSets }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2 w-full">
                              <span className="w-4 shrink-0 text-[9px] font-black uppercase tracking-widest text-zinc-500">S{i + 1}</span>
                              <div className="flex-1 grid grid-cols-2 gap-1.5 min-w-0">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Reps"
                                  className="h-7 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-center text-xs font-black text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_reps?.[i] ?? ""}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => updateArrayField("actual_reps", i, e.target.value)}
                                />
                                <input
                                  type="number"
                                  step="0.5"
                                  placeholder="Kg"
                                  className="h-7 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-center text-xs font-black text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_weight?.[i] ?? ""}
                                  onFocus={(e) => e.target.select()}
                                  onChange={e => updateArrayField("actual_weight", i, e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Mis notas</label>
                        <textarea
                          className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-[11px] text-zinc-100 outline-none focus:border-emerald-400 resize-none"
                          placeholder="Ej: Me dolió un poco el hombro..."
                          value={data.student_notes || ""}
                          onChange={e => setEditForm({ ...editForm, student_notes: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {hasStudentData ? (
                        <>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-zinc-900/50 rounded-md p-1.5 text-center border border-zinc-800">
                              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Sets</p>
                              <p className="text-xs font-black text-emerald-400">{ex.actual_sets}</p>
                            </div>
                            <div className="bg-zinc-900/50 rounded-md p-1.5 text-center border border-zinc-800">
                              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">RPE</p>
                              <p className={`text-xs font-black ${getRpeColor(ex.actual_rpe)}`}>{ex.actual_rpe || "--"}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            {Array.from({ length: studentSets }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between bg-zinc-900/40 px-2 py-1.5 rounded border border-zinc-800/50">
                                <span className="text-[9px] font-black text-zinc-500 shrink-0">SET {i+1}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-zinc-200 min-w-9 text-right">{ex.actual_reps?.[i] ?? "-"} reps</span>
                                  <span className="text-[11px] font-medium text-emerald-400 min-w-8 text-right">{ex.actual_weight?.[i] ? `${ex.actual_weight[i]}kg` : "--"}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {ex.student_notes && (
                            <div className="bg-emerald-400/5 border border-emerald-400/10 rounded-md p-2">
                              <p className="text-[10px] text-emerald-500/80 italic leading-snug">&quot;{ex.student_notes}&quot;</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-2">
                          {role === "STUDENT" ? (
                            <button
                              onClick={() => handleStartEdit(ex)}
                              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-400 border border-emerald-400/50 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-950 shadow-lg shadow-emerald-400/20 hover:bg-emerald-300 active:scale-95 transition-all"
                            >
                              <PlusCircle className="h-4 w-4" />
                              Registrar Resultados
                            </button>
                          ) : (
                            <p className="text-[10px] font-medium text-zinc-500">Aún no completado.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Acciones de Guardado */}
            {isEditing && (
              <div className="mt-1 flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSave(ex.id)}
                    disabled={isSaveDisabled}
                    className={`flex-1 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      role === "COACH" 
                        ? "bg-yellow-400 hover:bg-yellow-300 text-black" 
                        : "bg-emerald-400 hover:bg-emerald-300 text-black"
                    }`}
                  >
                    {isPending ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
                {role === "STUDENT" && isSaveDisabled && !isPending && (
                   <span className="text-[10px] text-red-400 text-center uppercase tracking-widest font-black animate-pulse">
                     Debes indicar el RPE sentido para guardar
                   </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}