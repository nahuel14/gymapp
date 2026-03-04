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
import { ExerciseExcelGrid } from "./ExerciseExcelGrid";

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
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
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
      try {
        await addExerciseToSession(
          selectedDayId,
          Number(newExForm.exerciseId),
          newExForm.target_sets,
          newExForm.target_reps,
          newExForm.target_weight,
          newExForm.target_rpe,
          newExForm.rest,
          newExForm.notes
        );
        setIsAddingExercise(false);
        setNewExForm({
          exerciseId: "",
          target_sets: 3,
          target_reps: ["10-12", "10-12", "10-12"],
          target_weight: ["", "", ""],
          target_rpe: 8,
          rest: 60,
          notes: ""
        });
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      } catch (error) {
        console.error("Error adding exercise:", error);
      }
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
            
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selección de Ejercicio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Ejercicio</label>
                  <select 
                    className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400 transition-all appearance-none"
                    value={newExForm.exerciseId}
                    onChange={(e) => setNewExForm({...newExForm, exerciseId: e.target.value})}
                  >
                    <option value="">Seleccionar ejercicio...</option>
                    {allExercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>

                {/* Configuración Base */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets</label>
                    <input 
                      type="number" 
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-yellow-400 outline-none focus:border-yellow-400 transition-all" 
                      value={newExForm.target_sets} 
                      onChange={e => {
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">RPE</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400 transition-all" 
                      value={newExForm.target_rpe} 
                      onChange={e => setNewExForm({...newExForm, target_rpe: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Pausa</label>
                    <input 
                      type="number" 
                      className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400 transition-all" 
                      value={newExForm.rest} 
                      onChange={e => setNewExForm({...newExForm, rest: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              </div>

              {/* Inputs Dinámicos por Serie */}
              <div className="flex flex-col gap-4 rounded-3xl bg-zinc-950 p-6 border-2 border-zinc-900">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Repeticiones por serie</label>
                  <div className="flex flex-wrap gap-2">
                    {newExForm.target_reps.map((rep, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-zinc-600 text-center uppercase">S{idx+1}</span>
                        <input 
                          required
                          type="number"
                          min="1"
                          className="w-12 h-12 rounded-xl border-2 border-zinc-800 bg-zinc-900 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                          value={rep}
                          onChange={e => {
                            const newReps = [...newExForm.target_reps];
                            newReps[idx] = Number(e.target.value);
                            setNewExForm({...newExForm, target_reps: newReps});
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Kilos por serie</label>
                  <div className="flex flex-wrap gap-2">
                    {newExForm.target_weight.map((weight, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-zinc-600 text-center uppercase">S{idx+1}</span>
                        <input 
                          type="number"
                          step="0.5"
                          placeholder="Kg"
                          className="w-12 h-12 rounded-xl border-2 border-zinc-800 bg-zinc-900 text-center text-xs font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                          value={weight === null ? "" : weight}
                          onChange={e => {
                            const newWeights = [...newExForm.target_weight];
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            newWeights[idx] = val;
                            setNewExForm({...newExForm, target_weight: newWeights});
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Notas para el alumno</label>
                <textarea 
                  className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-medium text-zinc-100 outline-none focus:border-yellow-400 transition-all resize-none"
                  rows={2}
                  placeholder="Ej: Controlar el descenso, 2 segundos..."
                  value={newExForm.notes}
                  onChange={(e) => setNewExForm({...newExForm, notes: e.target.value})}
                />
              </div>

              <button 
                onClick={handleAddExercise}
                disabled={isPending || !newExForm.exerciseId}
                className="w-full rounded-[1.5rem] bg-yellow-400 py-5 text-sm font-black text-black shadow-xl shadow-yellow-400/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-30 disabled:grayscale uppercase tracking-widest"
              >
                {isPending ? "Procesando..." : "Guardar en Rutina"}
              </button>
            </div>
          </div>
        )}

        {/* Exercise List - NEW EXCEL GRID */}
        <div className="flex flex-col gap-4">
          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[2rem] border-2 border-dashed border-zinc-800 bg-zinc-950/50">
              <Dumbbell className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Sin ejercicios para este día</p>
            </div>
          ) : (
            <ExerciseExcelGrid exercises={exercises} role={role} />
          )}

          {role === "COACH" && !isAddingExercise && (
            <button
              onClick={() => setIsAddingExercise(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-800 p-4 text-xs font-black text-zinc-500 hover:border-yellow-400 hover:text-yellow-400 transition-all uppercase tracking-widest"
            >
              <Plus className="h-4 w-4" /> Agregar Ejercicio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
