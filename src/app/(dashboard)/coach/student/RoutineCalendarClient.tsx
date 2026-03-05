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
  MessageSquare,
  Copy,
  LayoutTemplate
} from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import type { Tables } from "@/types/supabase";
import { 
  addWeekToPlan, 
  addDayToWeek, 
  addExerciseToSession, 
  deleteExerciseFromSession, 
  updateExerciseInSession,
  duplicateSession,
  duplicatePlan
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
  // Inicializar selectedDayId con la primera sesión disponible de la semana actual
  const [selectedDayId, setSelectedDayId] = useState<number | null>(() => {
    const firstWeekSessions = sessions.filter((s) => s.week_number === 1);
    return firstWeekSessions.length > 0 ? firstWeekSessions[0].id : null;
  });
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [newDayForm, setNewDayForm] = useState({ date: new Date().toISOString().split('T')[0] });
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

  // Lógica para el Calendario Semanal Real
  const getDaysOfWeek = (weekNum: number, planStartDate: string | null) => {
    if (!planStartDate) return [];
    
    const start = new Date(planStartDate + 'T00:00:00');
    // Ajustar al lunes de esa semana del plan
    const dayOffset = (weekNum - 1) * 7;
    const monday = new Date(start);
    monday.setDate(start.getDate() + dayOffset);
    
    // Si el start_date no es lunes, opcionalmente podrías ajustar al lunes anterior
    // Pero por ahora asumimos que el plan arranca el día definido.
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      // Corregir comparación de fechas para evitar timezone issues
      const session = currentWeekSessions.find(s => {
        // 1. Defensa: Si la sesión por algún motivo no tiene fecha, la ignoramos
        if (!(s as any).date) return false;
        
        // 2. Extracción segura: Supabase suele devolver 'YYYY-MM-DD'. 
        // Hacemos un split por 'T' por si viene con timezone, y nos quedamos con la fecha.
        const sessionDate = (s as any).date.split('T')[0]; 
        
        // 3. Comparamos peras con peras (String contra String)
        return sessionDate === dateStr;
      });
      return { date: dateStr, session };
    });
  };

  const weeklyDays = getDaysOfWeek(selectedWeek, plan?.start_date || null);
  const currentMonthName = weeklyDays.length > 0 
    ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(weeklyDays[0].date + 'T00:00:00'))
    : "";

  // Efecto para sincronizar selectedDayId cuando cambia la semana
  useEffect(() => {
    if (currentWeekSessions.length > 0) {
      // Si no hay sesión seleccionada o no está en la semana actual, seleccionar la primera disponible
      if (!selectedDayId || !currentWeekSessions.some(s => s.id === selectedDayId)) {
        setSelectedDayId(currentWeekSessions[0].id);
      }
    } else {
      // Si no hay sesiones en la semana, limpiar selección
      setSelectedDayId(null);
    }
  }, [selectedWeek, currentWeekSessions.length]); // Solo depender de cambios relevantes

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
      await addDayToWeek(plan.id, selectedWeek, nextOrder, "Day", newDayForm.date);
      await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
      setIsAddingDay(false);
    });
  };

  const handleDuplicateDay = async () => {
    if (!selectedDayId) return;
    const targetDate = prompt("Ingrese la fecha para el nuevo día (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!targetDate) return;

    startTransition(async () => {
      try {
        await duplicateSession(selectedDayId, targetDate);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine"] });
        alert("Día duplicado con éxito");
      } catch (error) {
        console.error("Error duplicating day:", error);
      }
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!plan) return;
    if (!confirm("¿Guardar este plan como una nueva plantilla?")) return;

    startTransition(async () => {
      try {
        await duplicatePlan(plan.id);
        alert("Plan guardado como plantilla con éxito");
      } catch (error) {
        console.error("Error saving as template:", error);
      }
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
          target_reps: [10, 10, 10],
          target_weight: [null, null, null] as (number | null)[],
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

  const formatSessionDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const day = new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(date);
    const num = date.getDate();
    return { day: day.replace('.', ''), num };
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header Info */}
      <div className="flex items-center justify-between px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">
            {plan?.name || "Sin plan activo"}
          </h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {profile?.name ? `Alumno: ${profile.name} ${profile.last_name || ""}` : ""}
          </p>
        </div>
        {role === "COACH" && plan && (
          <button 
            onClick={handleSaveAsTemplate}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-[10px] font-black text-zinc-400 hover:text-yellow-400 transition-all uppercase tracking-widest"
          >
            <LayoutTemplate className="h-3.5 w-3.5" /> Guardar Plantilla
          </button>
        )}
      </div>

      {/* Calendar Navigation Header */}
      <div className="flex flex-col gap-4 px-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-zinc-100 uppercase tracking-tighter flex items-center gap-2">
            <Calendar className="h-5 w-5 text-yellow-400" />
            {currentMonthName || "Calendario"}
          </h3>
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
              disabled={selectedWeek === 1}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-[10px] font-black uppercase tracking-widest text-zinc-100">
              Semana {selectedWeek}
            </span>
            <button
              onClick={() => setSelectedWeek(prev => Math.min(maxWeeks, prev + 1))}
              disabled={selectedWeek === maxWeeks && role !== "COACH"}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {role === "COACH" && (
              <button 
                onClick={handleAddWeek}
                className="ml-1 p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                title="Añadir Semana"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Weekly Grid */}
        <div className="grid grid-cols-7 gap-2">
          {weeklyDays.map((day, idx) => {
            const isSelected = selectedDayId === day.session?.id;
            const dateInfo = formatSessionDate(day.date);
            const hasSession = !!day.session;

            return (
              <button
                key={day.date}
                onClick={() => {
                  if (hasSession) {
                    setSelectedDayId(day.session!.id);
                  } else if (role === "COACH") {
                    setNewDayForm({ date: day.date });
                    setIsAddingDay(true);
                  } else {
                    // Para STUDENT: mostrar día de descanso
                    setSelectedDayId(null);
                  }
                }}
                className={`flex flex-col items-center gap-1 rounded-2xl py-3 border-2 transition-all duration-200 ${
                  isSelected 
                    ? "bg-yellow-400 border-yellow-400 text-black shadow-lg scale-105 z-10" 
                    : hasSession
                      ? "bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-yellow-400/50"
                      : "bg-black/40 border-zinc-900 border-dashed text-zinc-600 hover:border-zinc-700"
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">
                  {dateInfo?.day || ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx]}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {dateInfo?.num || new Date(day.date + 'T00:00:00').getDate()}
                </span>
                {hasSession && !isSelected && (
                  <div className="h-1 w-1 rounded-full bg-yellow-400 mt-0.5 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Routine Table / List View */}
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {selectedSession ? "Sesión del día" : role === "STUDENT" ? "Día de descanso" : "Sin sesión"}
            </h3>
            <p className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
              {selectedSession ? ((selectedSession as any).date ? new Date((selectedSession as any).date + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'long' }) : `Día ${selectedSession.order_index}`) : 
               role === "STUDENT" ? "Descanso y recuperación" : "Selecciona un día"}
            </p>
          </div>
          {role === "COACH" && selectedDayId && (
            <div className="flex gap-2">
              <button 
                onClick={handleDuplicateDay}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-[10px] font-black text-zinc-400 transition hover:text-yellow-400 active:scale-95 uppercase"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </button>
              <button 
                onClick={() => setIsAddingExercise(true)}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-[10px] font-black text-black transition active:scale-95 uppercase"
              >
                <Plus className="h-3.5 w-3.5" /> Ejercicio
              </button>
            </div>
          )}
        </div>

        {/* Add Day Inline Form */}
        {isAddingDay && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Elegir fecha para el nuevo día</h4>
              <button onClick={() => setIsAddingDay(false)} className="text-zinc-500 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3">
              <input 
                type="date" 
                className="flex-1 rounded-xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-black text-zinc-100 outline-none focus:border-yellow-400 transition-all"
                value={newDayForm.date}
                onChange={e => setNewDayForm({ date: e.target.value })}
              />
              <button 
                onClick={handleAddDay}
                className="rounded-xl bg-yellow-400 px-6 font-black text-xs text-black shadow-lg shadow-yellow-400/10 active:scale-95 transition"
              >
                AGREGAR
              </button>
            </div>
          </div>
        )}

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
          {exercises.length === 0 && !selectedSession ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[2rem] border-2 border-dashed border-zinc-800 bg-zinc-950/50">
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-zinc-900/50 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-black uppercase tracking-widest text-xs text-center">
                  {role === "STUDENT" ? "Día de Descanso" : "Sin ejercicios para este día"}
                </p>
                {role === "STUDENT" && (
                  <p className="text-zinc-600 text-xs text-center max-w-[200px]">
                    Hoy no hay entrenamiento programado. ¡Aprovecha para recuperarte!
                  </p>
                )}
              </div>
            </div>
          ) : exercises.length === 0 ? (
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
