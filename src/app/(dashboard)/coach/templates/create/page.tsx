"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  Trash2, 
  Dumbbell,
  Calendar,
  LayoutTemplate,
  X
} from "lucide-react";
import { createTemplatePlan } from "../../student/actions";
import { createSupabaseServerClient } from "@/lib/supabase";
import { useExercises } from "@/hooks/useExercises";
import { ExerciseExcelGrid } from "../../student/ExerciseExcelGrid";

type TemplateSession = {
  id?: number;
  day_name: string;
  order_index: number;
  week_number: number;
  exercises: any[];
};

type TemplatePlan = {
  id?: number;
  name: string;
  sessions: TemplateSession[];
};

export default function CreateTemplatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: allExercises = [] } = useExercises();
  
  const [template, setTemplate] = useState<TemplatePlan>({
    name: "",
    sessions: []
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Form for new exercise
  const [newExForm, setNewExForm] = useState({
    exerciseId: "",
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null] as (number | null)[],
    target_rpe: 8,
    rest: 60,
    coach_notes: "" // Cambiado de notes a coach_notes
  });

  // Create template on mount
  useEffect(() => {
    const createTemplate = async () => {
      try {
        const response = await fetch("/api/user");
        const { user } = await response.json();
        
        if (!user) {
          router.push("/login");
          return;
        }

        const result = await createTemplatePlan("Nueva Plantilla", user.id);
        if (result.success) {
          setTemplateId(result.templateId);
          setTemplate(prev => ({ ...prev, id: result.templateId }));
        }
      } catch (error) {
        console.error("Error creating template:", error);
      }
    };

    createTemplate();
  }, [router]);

  const addSession = async (weekNumber: number) => {
    if (!templateId) return;
    
    // Calcular el nombre del día basado en cuántas sesiones hay en esa semana
    const sessionsInWeek = template.sessions.filter(s => s.week_number === weekNumber);
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

      const result = await response.json();
      
      // Actualizar estado local con la sesión persistida
      const newSession: TemplateSession = {
        id: result.session.id,
        day_name: `Día ${dayNumber}`,
        order_index: nextOrder,
        week_number: weekNumber,
        exercises: []
      };
      
      setTemplate(prev => ({
        ...prev,
        sessions: [...prev.sessions, newSession]
      }));
      
    } catch (error) {
      console.error("Error in addSession:", error);
    }
  };

  const removeSession = (orderIndex: number) => {
    setTemplate(prev => ({
      ...prev,
      sessions: prev.sessions
        .filter(s => s.order_index !== orderIndex)
        .map((s, idx) => ({ ...s, order_index: idx + 1, day_name: `Día ${idx + 1}` }))
    }));
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
        const result = await response.json();
        const selectedExercise = allExercises.find(ex => ex.id === Number(newExForm.exerciseId));
        
        // Actualizar el estado local inmediatamente para que React re-renderice
        setTemplate(prev => ({
          ...prev,
          sessions: prev.sessions.map(session => {
            if (session.id === selectedSessionId) {
              // Crear el nuevo ejercicio con la estructura completa
              const newExercise = {
                id: result.exercise.id,
                exercise_id: Number(newExForm.exerciseId),
                target_sets: newExForm.target_sets,
                target_reps: newExForm.target_reps,
                target_weight: newExForm.target_weight,
                target_rpe: newExForm.target_rpe,
                rest_seconds: newExForm.rest,
                coach_notes: newExForm.coach_notes || "",
                order_index: (session.exercises?.length || 0) + 1,
                exercises: selectedExercise ? {
                  id: selectedExercise.id,
                  name: selectedExercise.name,
                  body_zone: selectedExercise.body_zone,
                  category: selectedExercise.category
                } : null
              };
              
              return {
                ...session,
                exercises: [...(session.exercises || []), newExercise]
              };
            }
            return session;
          })
        }));
        
        // Reset form
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
      }
    } catch (error) {
      console.error("Error adding exercise:", error);
    }
  };

  const fetchTemplateData = async () => {
    if (!templateId) return;
    
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const data = await response.json();
      
      // Actualizar solo las sesiones, preservando el resto del template (incluido el nombre)
      setTemplate(prev => ({
        ...prev,
        sessions: data.sessions || [],
        // Preservar el nombre actual si existe, sino usar el del servidor
        name: prev.name || data.name
      }));
    } catch (error) {
      console.error("Error fetching template data:", error);
    }
  };

  const saveTemplateName = async () => {
    if (!template.name.trim() || !templateId) return;
    
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name })
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["templates"] });
        router.refresh(); // Invalidar caché del cliente antes de navegar
        router.push("/coach/templates");
      }
    } catch (error) {
      console.error("Error saving template name:", error);
    }
  };

  const selectedSession = template.sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/coach/templates")}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              
              <div className="flex items-center gap-3">
                <LayoutTemplate className="h-6 w-6 text-yellow-400" />
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la Plantilla"
                  className="text-xl font-black text-zinc-100 bg-transparent border-none outline-none placeholder-zinc-600"
                />
              </div>
            </div>
            
            <button
              onClick={saveTemplateName}
              disabled={!template.name.trim() || isSaving}
              className="flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-2 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar Plantilla"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sessions List */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
                Estructura del Plan
              </h3>
            </div>
            
            <div className="space-y-6">
              {/* Agrupar sesiones por semana */}
              {template.sessions.length > 0 ? (
                <>
                  {Object.entries(
                    template.sessions.reduce((acc: Record<number, TemplateSession[]>, session) => {
                      const week = session.week_number;
                      if (!acc[week]) acc[week] = [];
                      acc[week].push(session);
                      return acc;
                    }, {})
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([weekNumber, sessions]) => (
                      <div key={weekNumber} className="space-y-2">
                        {/* Encabezado de Semana */}
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
                        
                        {/* Sesiones de la semana */}
                        <div className="space-y-2">
                          {sessions.map((session) => (
                            <SessionCard
                              key={session.order_index}
                              session={session}
                              isSelected={selectedSessionId === session.id}
                              onSelect={() => setSelectedSessionId(session.id || null)}
                              onRemove={() => removeSession(session.order_index)}
                            />
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
              
              {/* Botón Agregar Semana */}
              <button
                onClick={() => {
                  const maxWeek = template.sessions.length > 0
                    ? Math.max(...template.sessions.map(s => s.week_number))
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

          {/* Exercise Editor */}
          <div className="lg:col-span-2">
            {selectedSession ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
                      {selectedSession.day_name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {selectedSession.exercises.length} ejercicios
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setIsAddingExercise(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Ejercicio
                  </button>
                </div>

                {/* Add Exercise Form */}
                {isAddingExercise && (
                  <AddExerciseForm
                    form={newExForm}
                    onChange={setNewExForm}
                    onSave={addExerciseToTemplate}
                    onCancel={() => setIsAddingExercise(false)}
                    exercises={allExercises}
                  />
                )}

                {/* Exercise List */}
                {selectedSession.exercises.length > 0 ? (
                  <ExerciseExcelGrid exercises={selectedSession.exercises} role="COACH" />
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
    </div>
  );
}

function SessionCard({ 
  session, 
  isSelected, 
  onSelect, 
  onRemove 
}: { 
  session: TemplateSession;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? "bg-yellow-400 border-yellow-400"
          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`font-bold text-sm uppercase tracking-tight ${
            isSelected ? "text-black" : "text-zinc-100"
          }`}>
            {session.day_name}
          </h4>
          <p className={`text-xs ${
            isSelected ? "text-black/70" : "text-zinc-500"
          }`}>
            {session.exercises.length} ejercicios
          </p>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
        >
          <Trash2 className={`h-4 w-4 ${isSelected ? "text-black" : "text-red-400"}`} />
        </button>
      </div>
    </div>
  );
}

function AddExerciseForm({ 
  form, 
  onChange, 
  onSave, 
  onCancel, 
  exercises 
}: {
  form: any;
  onChange: (form: any) => void;
  onSave: () => void;
  onCancel: () => void;
  exercises: any[];
}) {
  const sets = form.target_sets || 0; // ← DEFINIR AQUÍ LA VARIABLE
  
  const updateArrayField = (field: string, index: number, value: string) => {
    onChange((prev: any) => {
      const newArray = [...(prev[field] || [])];
      // Si el valor es vacío y el campo es de peso, ponemos null
      if (value === "" && field.includes("weight")) {
        newArray[index] = null;
      } else {
        newArray[index] = Number(value);
      }
      return { ...prev, [field]: newArray };
    });
  };

  const selectedExercise = exercises.find(ex => ex.id === form.exerciseId);

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-zinc-100">Nuevo Ejercicio</h4>
        <button onClick={onCancel} className="text-zinc-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Exercise Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ejercicio</label>
          <select 
            className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400"
            value={form.exerciseId}
            onChange={(e) => onChange({...form, exerciseId: e.target.value})}
          >
            <option value="">Seleccionar ejercicio...</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets</label>
          <input 
            type="number" 
            className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-yellow-400 outline-none focus:border-yellow-400" 
            value={form.target_sets} 
            onChange={e => {
              const sets = Math.max(1, Math.min(10, Number(e.target.value)));
              onChange({
                ...form, 
                target_sets: sets,
                target_reps: Array(sets).fill(form.target_reps[0] || 10),
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
            className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400" 
            value={form.target_rpe} 
            onChange={e => onChange({...form, target_rpe: Number(e.target.value)})} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pausa (segundos)</label>
          <input 
            type="number" 
            className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 p-3 text-sm font-black text-center text-zinc-100 outline-none focus:border-yellow-400" 
            value={form.rest} 
            onChange={e => onChange({...form, rest: Number(e.target.value)})} 
          />
        </div>
      </div>

      {/* Detailed Sets Grid - SIEMPRE visible si hay sets > 0 */}
      {sets > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-black uppercase tracking-widest text-zinc-500">Configuración por Set</div>
          
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
                {Array.from({ length: sets }).map((_, i) => (
                  <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-2 py-2 border-r border-zinc-800 text-center font-black text-yellow-400">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 border-r border-zinc-800">
                      <input 
                        type="number"
                        min="1"
                        className="w-full h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300"
                        value={form.target_reps?.[i] ?? 10}
                        onChange={e => updateArrayField("target_reps", i, e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 border-r border-zinc-800">
                      <input 
                        type="number"
                        step="0.5"
                        className="w-full h-6 bg-zinc-950 border border-zinc-800 rounded text-center outline-none focus:border-yellow-400 transition-colors text-zinc-300"
                        placeholder="Kg"
                        value={form.target_weight?.[i] ?? ""}
                        onChange={e => updateArrayField("target_weight", i, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input 
                        type="text"
                        className="w-full bg-transparent outline-none text-zinc-300 text-xs"
                        placeholder="Notas..."
                        value={form.coach_notes || ""}
                        onChange={e => onChange({...form, coach_notes: e.target.value})}
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
        onClick={onSave}
        disabled={!form.exerciseId || sets === 0}
        className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Agregar Ejercicio
      </button>
    </div>
  );
}
