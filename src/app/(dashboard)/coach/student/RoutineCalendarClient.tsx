 "use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Dumbbell, 
  Clock, 
  Target, 
  Plus, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save,
  X,
  PlusCircle,
  MessageSquare
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import type { Tables } from "@/types/supabase";
import { 
  addWeekToPlan, 
  addDayToWeek, 
  addExerciseToSession, 
  deleteExerciseFromSession, 
  updateExerciseInSession 
} from "./actions";
import { useExercises } from "@/hooks/useExercises";

type Session = Tables<"sessions">;
type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
  } | null;
};

type RoutineCalendarClientProps = {
  role: "COACH" | "STUDENT";
  profile: { id: string; name: string | null; last_name: string | null } | null;
  plan: { id: number; name: string; start_date: string | null } | null;
  sessions: Session[];
  exercisesBySession: Record<number, SessionExercise[]>;
};

export function RoutineCalendarClient({
  role,
  profile,
  plan,
  sessions,
  exercisesBySession,
}: RoutineCalendarClientProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { data: allExercises = [] } = useExercises();

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  
  // State for new exercise form
  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    sets: 3,
    reps: "10-12",
    rpe: 8,
    rest: 60,
    notes: ""
  });

  // State for editing exercise
  const [editExForm, setEditExForm] = useState({
    sets: 0,
    reps: "",
    rpe_target: 0,
    rest_seconds: 0,
    coach_notes: ""
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const maxWeeks = sessions.length > 0 ? Math.max(...sessions.map((s) => s.week_number)) : 0;
  const currentWeekSessions = sessions.filter((s) => s.week_number === selectedWeek);
  
  useEffect(() => {
    if (currentWeekSessions.length > 0 && (!selectedDayId || !currentWeekSessions.find(s => s.id === selectedDayId))) {
      setSelectedDayId(currentWeekSessions[0].id);
    }
  }, [selectedWeek, currentWeekSessions, selectedDayId]);

  const selectedSession = sessions.find((s) => s.id === selectedDayId);
  const exercises = selectedDayId ? exercisesBySession[selectedDayId] || [] : [];

  const handleAddWeek = () => {
    if (!plan) return;
    startTransition(async () => {
      await addWeekToPlan(plan.id, maxWeeks + 1);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setSelectedWeek(maxWeeks + 1);
    });
  };

  const handleAddDay = () => {
    if (!plan) return;
    const nextOrder = (currentWeekSessions.length > 0 ? Math.max(...currentWeekSessions.map(s => s.order_index ?? 0)) : 0) + 1;
    startTransition(async () => {
      await addDayToWeek(plan.id, selectedWeek, nextOrder);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
    });
  };

  const handleAddExercise = async () => {
    if (!selectedDayId || !newExForm.exerciseId) return;
    startTransition(async () => {
      await addExerciseToSession(
        selectedDayId,
        Number(newExForm.exerciseId),
        newExForm.sets,
        newExForm.reps,
        newExForm.rpe,
        newExForm.rest,
        newExForm.notes
      );
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setIsAddingExercise(false);
      setNewExForm({ exerciseId: "", sets: 3, reps: "10-12", rpe: 8, rest: 60, notes: "" });
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
      sets: ex.sets || 0,
      reps: ex.reps || "",
      rpe_target: ex.rpe_target || 0,
      rest_seconds: ex.rest_seconds || 0,
      coach_notes: ex.coach_notes || ""
    });
  };

  const handleUpdateExercise = async (id: number) => {
    startTransition(async () => {
      await updateExerciseInSession(id, editExForm);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setEditingExerciseId(null);
    });
  };

  const dayAbbreviation = (dayName: string | null, order: number | null) => {
    if (!dayName) return `Día ${order}`;
    const days: Record<string, string> = {
      Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié", Thursday: "Jue", 
      Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
    };
    return days[dayName] || dayName.substring(0, 3);
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header Info */}
      <div className="flex flex-col gap-1 px-4">
        <h2 className="text-lg font-bold text-foreground">
          {plan?.name || "Sin plan activo"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {profile?.name ? `Alumno: ${profile.name} ${profile.last_name || ""}` : ""}
        </p>
      </div>

      {/* Week Selector */}
      <div className="flex items-center justify-between px-4 bg-muted/30 py-2 rounded-xl mx-4">
        <button
          onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
          disabled={selectedWeek === 1}
          className="rounded-full p-2 transition hover:bg-muted disabled:opacity-20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-black uppercase tracking-tight">Semana {selectedWeek}</span>
          {role === "COACH" && (
            <button 
              onClick={handleAddWeek}
              className="text-[9px] font-bold text-primary flex items-center gap-0.5"
            >
              <PlusCircle className="h-3 w-3" /> Añadir Semana
            </button>
          )}
        </div>
        <button
          onClick={() => setSelectedWeek(prev => Math.min(maxWeeks, prev + 1))}
          disabled={selectedWeek === maxWeeks && role !== "COACH"}
          className="rounded-full p-2 transition hover:bg-muted disabled:opacity-20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day Strip Selector */}
      <div className="flex gap-3 overflow-x-auto px-4 py-2 no-scrollbar">
        {currentWeekSessions.map((session) => {
          const isSelected = selectedDayId === session.id;
          return (
            <button
              key={session.id}
              onClick={() => setSelectedDayId(session.id)}
              className={`flex min-w-[70px] flex-col items-center gap-1 rounded-2xl py-4 transition-all duration-200 border-2 ${
                isSelected 
                  ? "bg-primary border-primary text-primary-foreground shadow-md scale-105" 
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">
                {dayAbbreviation(session.day_name, session.order_index)}
              </span>
              <span className={`text-xl font-black ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                {session.order_index ?? 0}
              </span>
            </button>
          );
        })}
        {role === "COACH" && plan && (
          <button 
            onClick={handleAddDay}
            className="flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-muted-foreground/30 py-4 text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-6 w-6" />
            <span className="text-[10px] font-black uppercase">Día</span>
          </button>
        )}
      </div>

      {/* Routine Table / List View */}
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sesión del día</h3>
            <p className="text-lg font-bold text-foreground">
              {selectedSession ? `Día ${selectedSession.order_index}` : "Selecciona un día"}
            </p>
          </div>
          {role === "COACH" && selectedDayId && (
            <button 
              onClick={() => setIsAddingExercise(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition active:scale-95"
            >
              <Plus className="h-4 w-4" /> Ejercicio
            </button>
          )}
        </div>

        {/* Add Exercise Modal / Inline Form */}
        {isAddingExercise && role === "COACH" && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <PlusCircle className="h-4 w-4" /> Nuevo Ejercicio
              </h4>
              <button onClick={() => setIsAddingExercise(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground">Ejercicio</label>
                <select 
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  value={newExForm.exerciseId}
                  onChange={(e) => setNewExForm({...newExForm, exerciseId: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  {allExercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground text-center">Sets</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-background p-2 text-sm text-center" value={newExForm.sets} onChange={e => setNewExForm({...newExForm, sets: Number(e.target.value)})} />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground text-center">Reps</label>
                  <input type="text" className="w-full rounded-lg border border-border bg-background p-2 text-sm text-center" value={newExForm.reps} onChange={e => setNewExForm({...newExForm, reps: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground text-center">RPE</label>
                  <input type="number" className="w-full rounded-lg border border-border bg-background p-2 text-sm text-center" value={newExForm.rpe} onChange={e => setNewExForm({...newExForm, rpe: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground">Pausa (seg)</label>
                <input type="number" className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={newExForm.rest} onChange={e => setNewExForm({...newExForm, rest: Number(e.target.value)})} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground">Notas Coach</label>
                <input type="text" className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={newExForm.notes} onChange={e => setNewExForm({...newExForm, notes: e.target.value})} />
              </div>
            </div>
            <button 
              onClick={handleAddExercise}
              disabled={isPending || !newExForm.exerciseId}
              className="w-full rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "GUARDAR EN RUTINA"}
            </button>
          </div>
        )}

        {/* Exercises List - Column View */}
        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed border-border">
            <Dumbbell className="mb-4 h-12 w-12 opacity-10" />
            <p className="text-sm font-medium">No hay ejercicios para esta sesión.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {exercises.map((ex, idx) => {
              const isEditing = editingExerciseId === ex.id;
              
              return (
                <div key={ex.id} className="relative flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm border border-border group">
                  {/* Number Badge */}
                  <div className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[10px] font-black text-background shadow-md">
                    {idx + 1}
                  </div>

                  {/* Header Row */}
                  <div className="flex items-start justify-between border-b border-border pb-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                        {ex.exercise?.body_zone ? BODY_ZONE_LABELS[ex.exercise.body_zone as keyof typeof BODY_ZONE_LABELS] : "General"}
                      </span>
                      <h4 className="text-base font-black text-foreground">
                        {ex.exercise?.name || "Ejercicio"}
                      </h4>
                    </div>
                    {role === "COACH" && !isEditing && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => startEditing(ex)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {isEditing && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleUpdateExercise(ex.id)}
                          className="rounded-full p-2 text-primary transition hover:bg-primary/10"
                        >
                          <Save className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => setEditingExerciseId(null)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Columns Content */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {/* Series Column */}
                    <div className="flex flex-col gap-1 items-center sm:items-start">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Series</span>
                      {isEditing ? (
                        <input type="number" className="w-full rounded-md border border-border bg-muted/50 p-1 text-xs font-bold text-center sm:text-left" value={editExForm.sets} onChange={e => setEditExForm({...editExForm, sets: Number(e.target.value)})} />
                      ) : (
                        <span className="text-sm font-black text-foreground">{ex.sets}</span>
                      )}
                    </div>
                    
                    {/* Reps Column */}
                    <div className="flex flex-col gap-1 items-center sm:items-start">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Reps</span>
                      {isEditing ? (
                        <input type="text" className="w-full rounded-md border border-border bg-muted/50 p-1 text-xs font-bold text-center sm:text-left" value={editExForm.reps} onChange={e => setEditExForm({...editExForm, reps: e.target.value})} />
                      ) : (
                        <span className="text-sm font-black text-foreground">{ex.reps}</span>
                      )}
                    </div>

                    {/* Weight Column (Planned/Real) */}
                    <div className="flex flex-col gap-1 items-center sm:items-start">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Peso</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-foreground">--</span>
                        {role === "STUDENT" && (
                          <input type="number" placeholder="Kg" className="w-14 rounded-md border border-border bg-muted/50 p-1 text-[10px] text-center" />
                        )}
                      </div>
                    </div>

                    {/* RPE Column */}
                    <div className="flex flex-col gap-1 items-center sm:items-start">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">RPE</span>
                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <input type="number" className="w-full rounded-md border border-border bg-muted/50 p-1 text-xs font-bold text-center sm:text-left" value={editExForm.rpe_target} onChange={e => setEditExForm({...editExForm, rpe_target: Number(e.target.value)})} />
                        ) : (
                          <span className="text-sm font-black text-primary">{ex.rpe_target || "-"}</span>
                        )}
                      </div>
                    </div>

                    {/* Pausa Column */}
                    <div className="flex flex-col gap-1 items-center sm:items-start col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Pausa</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {isEditing ? (
                          <input type="number" className="w-full rounded-md border border-border bg-muted/50 p-1 text-xs font-bold" value={editExForm.rest_seconds} onChange={e => setEditExForm({...editExForm, rest_seconds: Number(e.target.value)})} />
                        ) : (
                          <span className="text-xs font-bold text-foreground">{ex.rest_seconds || "0"}s</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes Row */}
                  {(ex.coach_notes || isEditing) && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-muted/40 p-3 border border-border/50">
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground">
                        <MessageSquare className="h-3 w-3" /> Observaciones del Coach
                      </span>
                      {isEditing ? (
                        <textarea 
                          className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-primary" 
                          rows={2}
                          value={editExForm.coach_notes}
                          onChange={e => setEditExForm({...editExForm, coach_notes: e.target.value})}
                        />
                      ) : (
                        <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                          {ex.coach_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Student Log Button */}
                  {role === "STUDENT" && (
                    <button className="mt-2 w-full rounded-xl bg-foreground py-2.5 text-[11px] font-black text-background transition active:scale-[0.98]">
                      REGISTRAR SERIE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
