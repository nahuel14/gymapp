"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Play,
  Pencil,
  Trash2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Link2,
  Link2Off,
  X,
} from "lucide-react";
import { BODY_ZONE_LABELS } from "@/lib/constants";
import {
  updateExerciseInSession,
  deleteExerciseFromSession,
  reorderSessionItem,
  setSuperset,
  removeFromSuperset,
} from "./actions";
import { buildPayloadByMode } from "@/lib/student/payload";
import { useQueryClient } from "@tanstack/react-query";

type SessionExercise = any;

interface Props {
  exercises: SessionExercise[];
  role: "COACH" | "STUDENT" | "ADMIN" | "SUPER_STUDENT";
  isTemplate?: boolean;
  allExpanded?: boolean;
  onMutated?: () => void;
}

export function ExerciseExcelGrid({ exercises, role, isTemplate = false, allExpanded = false, onMutated }: Props) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAs, setEditingAs] = useState<"coach" | "student" | "admin" | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const sortedExercises = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [exerciseToDelete, setExerciseToDelete] = useState<number | null>(null);

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

  const handleStartEdit = (ex: any, as?: "coach" | "student" | "admin") => {
    setExpandedIds(prev => new Set([...prev, ex.id]));
    setEditingId(ex.id);
    setEditingAs(as ?? (role === "STUDENT" ? "student" : "coach"));

    const hasStudentData = ex.actual_sets && ex.actual_sets > 0;
    const initialSets = hasStudentData ? ex.actual_sets : (ex.target_sets || 0);
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
      actual_sets: initialSets,
      actual_reps: initialReps,
      actual_weight: initialWeight,
      actual_rpe: ex.actual_rpe || 0,
      student_notes: ex.student_notes || "",
    });
  };

  const handleSave = async (id: number) => {
    startTransition(async () => {
      const dataToSave = buildPayloadByMode(editForm, editingAs ?? "coach");
      await updateExerciseInSession(id, dataToSave);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
      setEditingId(null);
      setEditingAs(null);
    });
  };

  // Reorders a standalone exercise block up/down
  const handleReorder = (ex: any, direction: 'up' | 'down') => {
    startTransition(async () => {
      await reorderSessionItem(ex.session_id, ex.id, null, direction);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
    });
  };

  // Reorders an entire superset block up/down
  const handleMoveSuperset = (group: number, direction: 'up' | 'down') => {
    const sessionId = sortedExercises.find(e => e.superset_group === group)?.session_id;
    if (!sessionId) return;
    startTransition(async () => {
      await reorderSessionItem(sessionId, null, group, direction);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
    });
  };

  const handleDelete = (id: number) => {
    setExerciseToDelete(id);
  };

  const handleConfirmDelete = () => {
    if (exerciseToDelete === null) return;
    const idToDelete = exerciseToDelete;
    setExerciseToDelete(null);
    startTransition(async () => {
      await deleteExerciseFromSession(idToDelete);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
    });
  };

  const handleChain = (targetEx: any) => {
    if (!linkingId) return;
    const sourceId = linkingId;
    setLinkingId(null);
    startTransition(async () => {
      await setSuperset(sourceId, targetEx.id, targetEx.session_id);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
    });
  };

  const handleUnchain = (exerciseId: number) => {
    startTransition(async () => {
      await removeFromSuperset(exerciseId);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      onMutated?.();
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
      return { ...prev, [field]: newArray };
    });
  };

  // Build render items: group exercises with same superset_group together
  type RenderItem =
    | { type: "standalone"; ex: any }
    | { type: "superset"; group: number; items: Array<{ ex: any }> };

  const renderItems: RenderItem[] = [];
  const seenGroups = new Set<number>();

  for (const ex of sortedExercises) {
    const group = ex.superset_group as number | null | undefined;
    if (group === null || group === undefined) {
      renderItems.push({ type: "standalone", ex });
    } else if (!seenGroups.has(group)) {
      seenGroups.add(group);
      renderItems.push({
        type: "superset",
        group,
        items: sortedExercises
          .filter(e => (e.superset_group as number | null) === group)
          .map(e => ({ ex: e })),
      });
    }
  }

  // renderItemIndex: position in renderItems (for ↑↓ disabled logic)
  const renderExCard = (ex: any, renderItemIndex: number) => {
    const exerciseData = ex.exercise || ex.exercises;
    const isEditing = editingId === ex.id;
    const isExpanded = expandedIds.has(ex.id) || isEditing;
    const data = isEditing ? editForm : ex;
    const coachSets = Number(data.target_sets || 0);
    const studentSets = Number(data.actual_sets || coachSets);
    const hasStudentData = ex.actual_sets && ex.actual_sets > 0;
    const isSaveDisabled = isPending || (editingAs === "student" && (!data.actual_rpe || data.actual_rpe <= 0));
    const inSuperset = ex.superset_group !== null && ex.superset_group !== undefined;
    const linkingSource = linkingId !== null ? sortedExercises.find(e => e.id === linkingId) : null;
    const isSameGroupAsLinking =
      linkingId !== null &&
      linkingSource?.superset_group !== null &&
      linkingSource?.superset_group !== undefined &&
      ex.superset_group === linkingSource.superset_group;

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
            {/* ↑↓ solo en standalone (no dentro de superset) */}
            {(role === "COACH" || role === "ADMIN" || role === "SUPER_STUDENT") && !isEditing && !isExpanded && !inSuperset && (
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleReorder(ex, 'up')}
                  disabled={renderItemIndex === 0 || isPending}
                  className="h-7 w-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleReorder(ex, 'down')}
                  disabled={renderItemIndex === renderItems.length - 1 || isPending}
                  className="h-7 w-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            )}
            {(role === "COACH" || role === "ADMIN" || role === "SUPER_STUDENT") && !isEditing && isExpanded && (
              <>
                {inSuperset ? (
                  <>
                    {linkingId === ex.id ? (
                      <button
                        onClick={() => setLinkingId(null)}
                        title="Cancelar encadenado"
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-yellow-400/20 text-yellow-400 animate-pulse active:scale-95 transition-all"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    ) : linkingId !== null && isSameGroupAsLinking ? (
                      <button
                        disabled
                        title="Ya están en la misma super serie"
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/30 text-zinc-700 cursor-not-allowed"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    ) : linkingId !== null ? (
                      <button
                        onClick={() => handleChain(ex)}
                        title="Encadenar con este ejercicio"
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/30 animate-pulse active:scale-95 transition-all"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setLinkingId(ex.id)}
                        title="Agregar ejercicio a esta super serie"
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/50 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 active:scale-95 transition-all"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleUnchain(ex.id)}
                      title="Quitar de super serie"
                      className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : linkingId === ex.id ? (
                  <button
                    onClick={() => setLinkingId(null)}
                    title="Cancelar encadenado"
                    className="h-7 w-7 flex items-center justify-center rounded-md bg-yellow-400/20 text-yellow-400 animate-pulse active:scale-95 transition-all"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                ) : linkingId !== null ? (
                  <button
                    onClick={() => handleChain(ex)}
                    title="Encadenar con este ejercicio"
                    className="h-7 w-7 flex items-center justify-center rounded-md bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/30 animate-pulse active:scale-95 transition-all"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setLinkingId(ex.id)}
                    title="Encadenar con otro ejercicio"
                    className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/50 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 active:scale-95 transition-all"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(ex, "coach")}
                  className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800/50 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 active:scale-95 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(ex.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                >
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

              {isEditing && (editingAs === "coach" || editingAs === "admin") ? (
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
                        <span className="text-[9px] font-black text-zinc-500 shrink-0">SET {i + 1}</span>
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
                  {(role === "STUDENT" || role === "SUPER_STUDENT") && !isEditing && hasStudentData && (
                    <button
                      onClick={() => handleStartEdit(ex, role === "SUPER_STUDENT" ? "admin" : "student")}
                      className="flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 active:scale-95 transition-all"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  )}
                </div>

                {isEditing && (editingAs === "student" || editingAs === "admin") ? (
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
                        <label className={`text-[8px] font-black uppercase tracking-widest text-center ${(!data.actual_rpe || data.actual_rpe <= 0) ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>
                          {(!data.actual_rpe || data.actual_rpe <= 0) ? "RPE Obligatorio *" : "RPE Sentido"}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className={`h-8 w-full min-w-0 rounded-md border bg-zinc-900 px-1 text-center text-xs font-black outline-none transition-colors ${
                            (!data.actual_rpe || data.actual_rpe <= 0)
                              ? "border-red-500/50 focus:border-red-500 text-red-400"
                              : "border-zinc-700 focus:border-emerald-400 text-emerald-400"
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
                              <span className="text-[9px] font-black text-zinc-500 shrink-0">SET {i + 1}</span>
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
                        {(role === "STUDENT" || role === "SUPER_STUDENT") ? (
                          <button
                            onClick={() => handleStartEdit(ex, role === "SUPER_STUDENT" ? "admin" : "student")}
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
                onClick={() => { setEditingId(null); setEditingAs(null); }}
                className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(ex.id)}
                disabled={isSaveDisabled}
                className={`flex-1 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  editingAs === "coach" || editingAs === "admin"
                    ? "bg-yellow-400 hover:bg-yellow-300 text-black"
                    : "bg-emerald-400 hover:bg-emerald-300 text-black"
                }`}
              >
                {isPending ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
            {editingAs === "student" && isSaveDisabled && !isPending && (
              <span className="text-[10px] text-red-400 text-center uppercase tracking-widest font-black animate-pulse">
                Debes indicar el RPE sentido para guardar
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (<>
    <div className="flex flex-col gap-3 w-full max-w-full">
      {linkingId !== null && (
        <div className="text-[10px] font-black uppercase tracking-widest text-yellow-400 text-center animate-pulse bg-yellow-400/5 border border-yellow-400/20 rounded-lg py-2 px-3">
          Expandí otro ejercicio y tocá su ícono de cadena para encadenar
        </div>
      )}
      {renderItems.map((item, itemIndex) => {
        if (item.type === "superset") {
          return (
            <div key={`ss-${item.group}`} className="flex flex-col gap-1.5 border-l-2 border-yellow-400/40 pl-2.5">
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-yellow-400/60 flex items-center gap-1">
                  <Link2 className="h-2.5 w-2.5" /> Super Serie
                </span>
                {(role === "COACH" || role === "ADMIN" || role === "SUPER_STUDENT") && (
                  <div className="flex gap-0.5 ml-auto">
                    <button
                      onClick={() => handleMoveSuperset(item.group, 'up')}
                      disabled={itemIndex === 0 || isPending}
                      className="h-6 w-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMoveSuperset(item.group, 'down')}
                      disabled={itemIndex === renderItems.length - 1 || isPending}
                      className="h-6 w-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-default"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {item.items.map(({ ex }) => renderExCard(ex, itemIndex))}
            </div>
          );
        }
        return renderExCard(item.ex, itemIndex);
      })}
    </div>

    {exerciseToDelete !== null && (
      <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
        <div className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-1/2 sm:max-w-md flex flex-col">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight text-zinc-100">Eliminar Ejercicio</h4>
            </div>
            <button
              onClick={() => setExerciseToDelete(null)}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-6 pb-2">
            <p className="text-sm text-zinc-400 leading-relaxed">
              ¿Estás seguro de eliminar este ejercicio? Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="px-6 pt-4 pb-8 sm:pb-6 flex gap-3">
            <button
              onClick={() => setExerciseToDelete(null)}
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
  </>
  );
}
