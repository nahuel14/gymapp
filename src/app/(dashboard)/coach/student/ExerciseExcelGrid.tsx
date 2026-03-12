"use client";

import { useState, useTransition } from "react";
import { 
  Play, 
  MessageSquare, 
  Trash2, 
  Save, 
  X, 
  Settings2,
  ExternalLink
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import { updateExerciseInSession, deleteExerciseFromSession } from "./actions";
import { useQueryClient } from "@tanstack/react-query";

type SessionExercise = any; // Will use any for now until types are refreshed

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
      // Si el valor es vacío y el campo es de peso, ponemos null
      if (value === "" && field.includes("weight")) {
        newArray[index] = null;
      } else {
        newArray[index] = Number(value);
      }
      return { ...prev, [field] : newArray };
    });
  };

  return (
    <>
    <div className="flex flex-col gap-4 lg:hidden">
      {sortedExercises.map((ex) => {
        const exerciseData = ex.exercise || ex.exercises;
        const isEditing = editingId === ex.id;
        const data = isEditing ? editForm : ex;
        const coachSets = Number(data.target_sets || 0);
        const studentSets = Number(data.actual_sets || coachSets);

        return (
          <div key={ex.id} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black uppercase tracking-tight text-zinc-100 truncate">
                  {exerciseData?.name || "--"}
                </h3>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase text-zinc-500">
                  <span>
                    {exerciseData?.body_zone
                      ? BODY_ZONE_LABELS[exerciseData.body_zone as keyof typeof BODY_ZONE_LABELS]?.substring(0, 12)
                      : "--"}
                  </span>
                  <span>•</span>
                  <span>
                    {exerciseData?.category
                      ? EXERCISE_CATEGORY_LABELS[exerciseData.category as keyof typeof EXERCISE_CATEGORY_LABELS]
                      : "--"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {exerciseData?.video_url && (
                  <a
                    href={exerciseData.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-zinc-800 p-2 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </a>
                )}
                {role === "COACH" && (
                  <>
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSave(ex.id)} disabled={isPending} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-400/10">
                          <Save className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-500/10">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(ex)} className="p-2 rounded-lg text-zinc-400 hover:bg-yellow-400/10 hover:text-yellow-400">
                          <Settings2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(ex.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 p-3 flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                Coach
              </span>
              {role === "COACH" && isEditing ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Sets
                      </label>
                      <input
                        type="number"
                        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-base font-black text-yellow-400 outline-none focus:border-yellow-400"
                        value={data.target_sets || 0}
                        onChange={e => setEditForm({ ...editForm, target_sets: Number(e.target.value) })}
                      />
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        RPE
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-base font-black text-yellow-400 outline-none focus:border-yellow-400"
                        value={data.target_rpe || 0}
                        onChange={e => setEditForm({ ...editForm, target_rpe: Number(e.target.value) })}
                      />
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Pausa
                      </label>
                      <input
                        type="number"
                        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-base font-black text-yellow-400 outline-none focus:border-yellow-400"
                        value={data.rest_seconds || 0}
                        onChange={e => setEditForm({ ...editForm, rest_seconds: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Series
                    </p>
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: coachSets }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                          <div className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">
                            Set {i + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Reps
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="h-10 w-16 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_reps?.[i] ?? 10}
                                onChange={e => updateArrayField("target_reps", i, e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Kilos
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                className="h-10 w-16 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 outline-none focus:border-yellow-400"
                                value={data.target_weight?.[i] ?? ""}
                                onChange={e => updateArrayField("target_weight", i, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Notas del coach
                    </label>
                    <textarea
                      className="min-h-[96px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none focus:border-yellow-400"
                      value={data.coach_notes || ""}
                      onChange={e => setEditForm({ ...editForm, coach_notes: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                    {coachSets} Sets
                    {" | "}
                    {Array.isArray(data.target_reps) && data.target_reps.length > 0
                      ? data.target_reps.join(" / ")
                      : "--"}{" "}
                    Reps
                    {" | "}RPE {data.target_rpe || "--"}
                    {" | "}{data.rest_seconds || 0}s pausa
                  </p>
                  {data.coach_notes && (
                    <p className="text-xs italic text-zinc-500">{data.coach_notes}</p>
                  )}
                </>
              )}
            </div>

            {!isTemplate && !isEditing && (
              <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 p-3 flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Student
                </span>
                <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                  Sets: {ex.actual_sets ?? "-"}
                </p>
                <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                  Reps: {Array.isArray(ex.actual_reps) ? ex.actual_reps.join(" / ") : "-"}
                </p>
                <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                  Kilos: {Array.isArray(ex.actual_weight) ? ex.actual_weight.map((w: number | null) => w ?? "-").join(" / ") : "-"}
                </p>
                <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                  RPE: {ex.actual_rpe ?? "-"}
                </p>
                <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                  Notas: {ex.student_notes || "-"}
                </p>
              </div>
            )}

            {!isTemplate && role === "STUDENT" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Alumno
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(ex)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-400"
                    >
                      <Settings2 className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          Sets realizados
                        </p>
                        <p className="text-base font-black text-emerald-400">
                          {data.actual_sets || "--"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          RPE
                        </p>
                        <p className={`text-base font-black ${getRpeColor(data.actual_rpe)}`}>
                          {data.actual_rpe || "--"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Series
                      </p>
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: studentSets }).map((_, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                              Set {i + 1}
                            </span>
                            <div className="flex items-center gap-3 text-sm font-semibold text-zinc-200">
                              <span>{data.actual_reps?.[i] ?? 10} reps</span>
                              <span>{data.actual_weight?.[i] ?? "--"} kg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Notas
                      </p>
                      <p className="text-sm text-zinc-300">
                        {data.student_notes || "--"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          Sets realizados
                        </label>
                        <input
                          type="number"
                          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-base font-black text-emerald-400 outline-none focus:border-emerald-400"
                          value={data.actual_sets || 0}
                          onChange={e => setEditForm({ ...editForm, actual_sets: Number(e.target.value) })}
                        />
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          RPE
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-base font-black text-emerald-400 outline-none focus:border-emerald-400"
                          value={data.actual_rpe || 0}
                          onChange={e => setEditForm({ ...editForm, actual_rpe: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Series
                      </p>
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: studentSets }).map((_, i) => (
                          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">
                              Set {i + 1}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Reps
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  className="h-10 w-16 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_reps?.[i] ?? 10}
                                  onChange={e => updateArrayField("actual_reps", i, e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Kilos
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  className="h-10 w-16 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-100 outline-none focus:border-emerald-400"
                                  value={data.actual_weight?.[i] ?? ""}
                                  onChange={e => updateArrayField("actual_weight", i, e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Notas
                      </label>
                      <textarea
                        className="min-h-[96px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-400"
                        value={data.student_notes || ""}
                        onChange={e => setEditForm({ ...editForm, student_notes: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleSave(ex.id)}
                        disabled={isPending}
                        className="w-full rounded-xl bg-emerald-400 py-4 text-sm font-black uppercase tracking-widest text-black"
                      >
                        Guardar Serie
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-4 text-sm font-black uppercase tracking-widest text-zinc-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>

    <div className="hidden w-full overflow-x-auto rounded-xl border border-zinc-800 bg-black shadow-2xl no-scrollbar lg:block">
      <table className="w-full border-collapse text-[11px] font-medium min-w-[1000px]">
        <thead>
          {/* Super Headers */}
          <tr className="border-b border-zinc-800">
            <th colSpan={4} className="bg-zinc-950 px-4 py-2 text-left text-zinc-500 uppercase tracking-widest font-black border-r border-zinc-800">Ejercicio</th>
            <th colSpan={6} className="bg-zinc-900 px-4 py-2 text-center text-yellow-400 uppercase tracking-widest font-black border-r border-zinc-800">Coach (Prescrito)</th>
            {!isTemplate && (
              <th colSpan={5} className="bg-zinc-800 px-4 py-2 text-center text-emerald-400 uppercase tracking-widest font-black">Student (Ejecutado)</th>
            )}
          </tr>
          {/* Sub Headers */}
          <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
            <th className="px-3 py-2 text-left border-r border-zinc-800 w-16">BZ</th>
            <th className="px-3 py-2 text-left border-r border-zinc-800 w-24">TIPO</th>
            <th className="px-3 py-2 text-left border-r border-zinc-800">NOMBRE</th>
            <th className="px-3 py-2 text-center border-r border-zinc-800 w-10">VID</th>
            
            <th className="px-2 py-2 text-center border-r border-zinc-800 w-8 bg-zinc-900/50">S</th>
            <th className="px-2 py-2 text-center border-r border-zinc-800 w-32 bg-zinc-900/50">REPS</th>
            <th className="px-2 py-2 text-center border-r border-zinc-800 w-32 bg-zinc-900/50">KILOS</th>
            <th className="px-2 py-2 text-center border-r border-zinc-800 w-12 bg-zinc-900/50">RPE</th>
            <th className="px-2 py-2 text-center border-r border-zinc-800 w-12 bg-zinc-900/50">PAUSA</th>
            <th className="px-2 py-2 text-left border-r border-zinc-800 bg-zinc-900/50">OBS</th>

            {!isTemplate && (
              <>
                <th className="px-2 py-2 text-center border-r border-zinc-800 w-8 bg-zinc-800/50">S</th>
                <th className="px-2 py-2 text-center border-r border-zinc-800 w-32 bg-zinc-800/50">REPS</th>
                <th className="px-2 py-2 text-center border-r border-zinc-800 w-32 bg-zinc-800/50">KILOS</th>
                <th className="px-2 py-2 text-center border-r border-zinc-800 w-12 bg-zinc-800/50 text-emerald-400">RPE</th>
                <th className="px-2 py-2 text-left bg-zinc-800/50">NOTAS</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {sortedExercises.map((ex) => {
            const exerciseData = ex.exercise || ex.exercises;
            const isEditing = editingId === ex.id;
            const data = isEditing ? editForm : ex;
            const coachSets = Number(data.target_sets || 0);
            const studentSets = Number(data.actual_sets || coachSets);

            return (
              <tr key={ex.id} className="hover:bg-zinc-900/30 transition-colors group">
                {/* Ejercicio Info */}
                <td className="px-3 py-3 border-r border-zinc-800 text-[10px] text-zinc-500 font-bold uppercase whitespace-nowrap">
                  {exerciseData?.body_zone ? BODY_ZONE_LABELS[exerciseData.body_zone as keyof typeof BODY_ZONE_LABELS]?.substring(0, 5) : "--"}
                </td>
                <td className="px-3 py-3 border-r border-zinc-800 text-[10px] text-zinc-500 font-bold uppercase whitespace-nowrap">
                  {exerciseData?.category ? EXERCISE_CATEGORY_LABELS[exerciseData.category as keyof typeof EXERCISE_CATEGORY_LABELS] : "--"}
                </td>
                <td className="px-3 py-3 border-r border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-100 font-black uppercase truncate max-w-[150px]">{exerciseData?.name}</span>
                    {role === "COACH" && (
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleSave(ex.id)} disabled={isPending} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded"><Save className="h-3 w-3" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-zinc-500 hover:bg-zinc-500/10 rounded"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => handleStartEdit(ex)} className="p-1 text-zinc-500 hover:bg-yellow-400/10 hover:text-yellow-400 rounded"><Settings2 className="h-3 w-3" /></button>
                            <button onClick={() => handleDelete(ex.id)} className="p-1 text-zinc-500 hover:bg-red-400/10 hover:text-red-400 rounded"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 border-r border-zinc-800 text-center">
                  {exerciseData?.video_url && (
                    <a href={exerciseData.video_url} target="_blank" rel="noopener noreferrer" className="inline-block p-1.5 rounded-full bg-zinc-900 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all">
                      <Play className="h-3 w-3 fill-current" />
                    </a>
                  )}
                </td>

                {/* Coach Columns */}
                <td className="px-2 py-3 border-r border-zinc-800 text-center bg-zinc-900/20 font-black text-yellow-400">
                  {isEditing && role === "COACH" ? (
                    <input type="number" className="w-full bg-transparent text-center outline-none" value={data.target_sets} onChange={e => setEditForm({...editForm, target_sets: Number(e.target.value)})} />
                  ) : data.target_sets}
                </td>
                <td className="px-2 py-3 border-r border-zinc-800 bg-zinc-900/20">
                  <div className="flex gap-1 justify-center">
                    {Array.from({ length: coachSets }).map((_, i) => (
                      <input 
                        key={i}
                        type="number"
                        min="1"
                        disabled={!isEditing || role !== "COACH"}
                        className="w-8 h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300 disabled:opacity-50"
                        value={data.target_reps?.[i] ?? 10}
                        onChange={e => updateArrayField("target_reps", i, e.target.value)}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-2 py-3 border-r border-zinc-800 bg-zinc-900/20">
                  <div className="flex gap-1 justify-center">
                    {Array.from({ length: coachSets }).map((_, i) => (
                      <input 
                        key={i}
                        type="number"
                        step="0.5"
                        disabled={!isEditing || role !== "COACH"}
                        className="w-8 h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300 disabled:opacity-50"
                        placeholder="Kg"
                        value={data.target_weight?.[i] ?? ""}
                        onChange={e => updateArrayField("target_weight", i, e.target.value)}
                      />
                    ))}
                  </div>
                </td>
                <td className={`px-2 py-3 border-r border-zinc-800 text-center bg-zinc-900/20 font-black ${getRpeColor(data.target_rpe)}`}>
                  {isEditing && role === "COACH" ? (
                    <input type="number" className="w-full bg-transparent text-center outline-none" value={data.target_rpe} onChange={e => setEditForm({...editForm, target_rpe: Number(e.target.value)})} />
                  ) : data.target_rpe || "--"}
                </td>
                <td className="px-2 py-3 border-r border-zinc-800 text-center bg-zinc-900/20 text-zinc-400 font-bold">
                  {isEditing && role === "COACH" ? (
                    <input type="number" className="w-full bg-transparent text-center outline-none" value={data.rest_seconds} onChange={e => setEditForm({...editForm, rest_seconds: Number(e.target.value)})} />
                  ) : `${data.rest_seconds || 0}s`}
                </td>
                <td className="px-3 py-3 border-r border-zinc-800 bg-zinc-900/20 text-zinc-500 italic max-w-[150px] truncate">
                  {isEditing && role === "COACH" ? (
                    <input className="w-full bg-transparent outline-none" value={data.coach_notes} onChange={e => setEditForm({...editForm, coach_notes: e.target.value})} />
                  ) : data.coach_notes || "--"}
                </td>

                {/* Student Columns */}
                {!isTemplate && (
                  <>
                    <td className="px-2 py-3 border-r border-zinc-800 text-center bg-zinc-800/20 font-black text-emerald-400">
                      {isEditing && role === "STUDENT" ? (
                        <input type="number" className="w-full bg-transparent text-center outline-none" value={data.actual_sets} onChange={e => setEditForm({...editForm, actual_sets: Number(e.target.value)})} />
                      ) : data.actual_sets || "--"}
                    </td>
                    <td className="px-2 py-3 border-r border-zinc-800 bg-zinc-800/20">
                      <div className="flex gap-1 justify-center">
                        {Array.from({ length: studentSets }).map((_, i) => (
                          <input 
                            key={i}
                            type="number"
                            min="1"
                            disabled={!isEditing || role !== "STUDENT"}
                            className="w-8 h-6 bg-zinc-900 border border-zinc-700 rounded text-center outline-none focus:border-emerald-400 transition-colors text-zinc-100 disabled:opacity-50"
                            value={data.actual_reps?.[i] ?? 10}
                            onChange={e => updateArrayField("actual_reps", i, e.target.value)}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 border-r border-zinc-800 bg-zinc-800/20">
                      <div className="flex gap-1 justify-center">
                        {Array.from({ length: studentSets }).map((_, i) => (
                          <input 
                            key={i}
                            type="number"
                            step="0.5"
                            disabled={!isEditing || role !== "STUDENT"}
                            className="w-8 h-6 bg-zinc-900 border border-zinc-700 rounded text-center outline-none focus:border-emerald-400 transition-colors text-zinc-100 disabled:opacity-50"
                            placeholder="Kg"
                            value={data.actual_weight?.[i] ?? ""}
                            onChange={e => updateArrayField("actual_weight", i, e.target.value)}
                          />
                        ))}
                      </div>
                    </td>
                    <td className={`px-2 py-3 border-r border-zinc-800 text-center bg-zinc-800/20 font-black ${getRpeColor(data.actual_rpe)}`}>
                      {isEditing && role === "STUDENT" ? (
                        <input type="number" className="w-full bg-transparent text-center outline-none" value={data.actual_rpe} onChange={e => setEditForm({...editForm, actual_rpe: Number(e.target.value)})} />
                      ) : data.actual_rpe || "--"}
                    </td>
                    <td className="px-3 py-3 bg-zinc-800/20 text-zinc-400 italic max-w-[150px] truncate">
                      <div className="flex items-center justify-between gap-2">
                        {isEditing && role === "STUDENT" ? (
                          <>
                            <input className="w-full bg-transparent outline-none" value={data.student_notes} onChange={e => setEditForm({...editForm, student_notes: e.target.value})} />
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleSave(ex.id)} disabled={isPending} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded">
                                <Save className="h-3 w-3" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-zinc-500 hover:bg-zinc-500/10 rounded">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        ) : data.student_notes || "--"}
                        {role === "STUDENT" && !isEditing && (
                          <button onClick={() => handleStartEdit(ex)} className="p-1 text-emerald-400/50 hover:text-emerald-400 transition-colors"><Settings2 className="h-3 w-3" /></button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
