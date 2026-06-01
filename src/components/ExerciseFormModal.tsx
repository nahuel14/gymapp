"use client";

import { useState, useEffect } from "react";
import { Plus, X, Database } from "lucide-react";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import { createInlineExercise } from "@/app/(dashboard)/coach/student/actions";
import { useQueryClient } from "@tanstack/react-query";

interface ExerciseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formState: any;
  setFormState: (state: any) => void;
  onSave: () => void;
  isPending: boolean;
  allExercises: any[];
}

export function ExerciseFormModal({
  isOpen,
  onClose,
  formState,
  setFormState,
  onSave,
  isPending,
  allExercises
}: ExerciseFormModalProps) {
  const queryClient = useQueryClient();
  
  // Lista local para actualizaciones instantáneas (Optimistic UI)
  const [localExercises, setLocalExercises] = useState<any[]>([]);

  useEffect(() => {
    // Sincronizamos la lista local cuando llegan datos frescos de la BD
    setLocalExercises(allExercises);
  }, [allExercises]);

  const [exerciseSearch, setExerciseSearch] = useState("");
  const [isExerciseDropdownOpen, setIsExerciseDropdownOpen] = useState(false);
  
  // Estados para creación en base de datos
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [newLibraryEx, setNewLibraryEx] = useState({
    name: "",
    body_zone: "",
    category: ""
  });

  if (!isOpen) return null;

  const updateArrayField = (field: string, index: number, value: string) => {
    setFormState((prev: any) => {
      const newArray = [...(prev[field] || [])];
      if (value === "" && field.includes("weight")) {
        newArray[index] = null;
      } else {
        newArray[index] = Number(value);
      }
      return { ...prev, [field]: newArray };
    });
  };

  const handleCreateInLibrary = async () => {
    if (!newLibraryEx.name.trim()) return alert("El nombre es obligatorio");
    setIsSavingToLibrary(true);
    
    try {
      // 1. Guardamos en Supabase
      const createdExercise = await createInlineExercise(newLibraryEx);
      
      // 2. MAGIA: Inyectamos el ejercicio nuevo en nuestra lista local instantáneamente
      setLocalExercises(prev => [createdExercise, ...prev]);
      
      // 3. Autoseleccionamos el ID nuevo
      setFormState({ ...formState, exerciseId: createdExercise.id.toString() });
      
      // 4. Volvemos a la vista normal
      setIsCreatingInline(false);
      setNewLibraryEx({ name: "", body_zone: "", category: "" });
      setExerciseSearch("");
      
      // 5. Le decimos a React Query que re-valide la caché en segundo plano
      // Asumo que tu hook useExercises usa la key "exercises", ajustala si usa otra
      await queryClient.invalidateQueries({ queryKey: ["exercises"] });
      
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al guardar el ejercicio.");
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  // Buscamos el nombre usando nuestra lista local (que incluye el recién creado)
  const selectedExerciseObj = localExercises.find(ex => ex.id.toString() === formState.exerciseId);
  const displayExerciseName = selectedExerciseObj?.name || (formState.exerciseId ? newLibraryEx.name : "Buscar ejercicio...");

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-h-[90vh] flex flex-col bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 max-w-lg">
        
        {/* HEADER */}
        <div className="flex items-center justify-between shrink-0 border-b border-zinc-800/50 p-4">
          <h4 className="text-sm font-black uppercase tracking-tight text-zinc-100 flex items-center gap-2">
            <Plus className="h-4 w-4 text-yellow-400" /> Nuevo Ejercicio
          </h4>
          <button 
            onClick={() => {
              onClose();
              setIsExerciseDropdownOpen(false);
              setIsCreatingInline(false);
            }} 
            className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 no-scrollbar">
          
          {/* VISTA 1: CREAR EJERCICIO NUEVO */}
          {isCreatingInline ? (
            <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
              <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-yellow-400" />
                  <h5 className="text-xs font-black text-yellow-400 uppercase tracking-widest">Nuevo Ejercicio</h5>
                </div>
                
                <input 
                  type="text" 
                  placeholder="Nombre del Ejercicio" 
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-100 outline-none focus:border-yellow-400"
                  value={newLibraryEx.name}
                  onChange={e => setNewLibraryEx({...newLibraryEx, name: e.target.value})}
                />
                
                <select 
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-100 outline-none focus:border-yellow-400 appearance-none"
                  value={newLibraryEx.body_zone}
                  onChange={e => setNewLibraryEx({...newLibraryEx, body_zone: e.target.value})}
                >
                  <option value="">Zona del Cuerpo (Opcional)</option>
                  {Object.entries(BODY_ZONE_LABELS || {}).map(([key, label]) => (
                    <option key={key} value={key}>{label as string}</option>
                  ))}
                </select>

                <select 
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-100 outline-none focus:border-yellow-400 appearance-none"
                  value={newLibraryEx.category}
                  onChange={e => setNewLibraryEx({...newLibraryEx, category: e.target.value})}
                >
                  <option value="">Categoría (Opcional)</option>
                  {Object.entries(EXERCISE_CATEGORY_LABELS || {}).map(([key, label]) => (
                    <option key={key} value={key}>{label as string}</option>
                  ))}
                </select>

                <div className="flex gap-2 mt-2">
                  <button onClick={() => setIsCreatingInline(false)} className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-xs font-black uppercase text-zinc-300 transition-colors hover:bg-zinc-700 whitespace-nowrap">Cancelar</button>
                  <button onClick={handleCreateInLibrary} disabled={isSavingToLibrary} className="flex-1 rounded-lg bg-yellow-400 py-2.5 text-xs font-black uppercase text-black transition-colors hover:bg-yellow-300 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap">
                    {isSavingToLibrary ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* VISTA 2: FORMULARIO NORMAL */
            <div className="flex flex-col gap-3 animate-in slide-in-from-left-4">
              
              {/* SELECTOR CON BUSCADOR (Ahora usa localExercises) */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Ejercicio</label>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsExerciseDropdownOpen(!isExerciseDropdownOpen)}
                    className="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-bold text-zinc-100 flex items-center justify-between focus:border-yellow-400 transition-all"
                  >
                    <span className="truncate">
                      {displayExerciseName}
                    </span>
                    <span className={`text-[10px] text-zinc-500 transition-transform ${isExerciseDropdownOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {isExerciseDropdownOpen && (
                    <div className="absolute top-full left-0 z-70 mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                      <div className="p-2 border-b border-zinc-800 bg-zinc-900">
                        <input
                          autoFocus
                          className="w-full h-9 bg-zinc-950 border border-zinc-700 rounded-lg px-3 text-sm text-zinc-100 outline-none focus:border-yellow-400"
                          placeholder="Escribí para filtrar..."
                          value={exerciseSearch}
                          onChange={(e) => setExerciseSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1 bg-zinc-900">
                        {localExercises
                          .filter(ex => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                          .map(ex => (
                          <button
                            key={ex.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-yellow-400/10 hover:text-yellow-400 border-b border-zinc-800/50 last:border-0 transition-colors"
                            onClick={() => {
                              setFormState({...formState, exerciseId: ex.id.toString()});
                              setIsExerciseDropdownOpen(false);
                              setExerciseSearch("");
                            }}
                          >
                            {ex.name}
                          </button>
                        ))}
                      </div>
                      <div className="p-2 border-t border-zinc-800 bg-zinc-900 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.5)]">
                        <button
                          type="button"
                          onClick={() => {
                            setNewLibraryEx(prev => ({...prev, name: exerciseSearch}));
                            setIsCreatingInline(true);
                            setIsExerciseDropdownOpen(false);
                          }}
                          className="w-full py-2.5 rounded-lg bg-yellow-400/10 text-yellow-400 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="h-3.5 w-3.5" /> Crear &quot;{exerciseSearch || "Nuevo"}&quot;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SETS, RPE, PAUSA */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Sets</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400" value={formState.target_sets} onFocus={(e) => e.target.select()} onChange={(e) => {
                    const sets = Math.max(1, Math.min(10, Number(e.target.value)));
                    setFormState({
                      ...formState, target_sets: sets,
                      target_reps: Array(sets).fill(formState.target_reps[0] || 10),
                      target_weight: Array(sets).fill(null)
                    });
                  }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">RPE</label>
                  <input type="number" step="0.5" className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400" value={formState.target_rpe} onFocus={(e) => e.target.select()} onChange={(e) => setFormState({ ...formState, target_rpe: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Pausa</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 text-center text-sm font-black text-yellow-400 outline-none focus:border-yellow-400" value={formState.rest} onFocus={(e) => e.target.select()} onChange={(e) => setFormState({ ...formState, rest: Number(e.target.value) })} />
                </div>
              </div>

              {/* SERIES DETALLADAS */}
              <div className="flex flex-col gap-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Configuración de Series</span>
                <div className="flex flex-col gap-2">
                  {formState.target_reps.map((rep: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 w-full">
                      <span className="w-5 shrink-0 text-[10px] font-black text-zinc-500">S{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input type="number" placeholder="Reps" className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center text-xs text-zinc-100 outline-none focus:border-yellow-400 transition-colors" value={rep} onFocus={(e) => e.target.select()} onChange={(e) => updateArrayField("target_reps", idx, e.target.value)} />
                        <input type="number" step="0.5" placeholder="Kg" className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center text-xs text-zinc-100 outline-none focus:border-yellow-400 transition-colors" value={formState.target_weight[idx] ?? ""} onFocus={(e) => e.target.select()} onChange={(e) => updateArrayField("target_weight", idx, e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTAS GLOBALES */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Notas para el alumno</label>
                <textarea 
                  className="min-h-9.5 rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-100 outline-none focus:border-yellow-400 resize-none transition-colors" 
                  placeholder="Opcional..." 
                  value={formState.notes || formState.coach_notes || ""} 
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value, coach_notes: e.target.value })} 
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {!isCreatingInline && (
          <div className="shrink-0 p-4 border-t border-zinc-800/50 bg-zinc-950 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button 
              onClick={() => {
                onSave();
                onClose();
              }} 
              disabled={isPending || !formState.exerciseId} 
              className="h-11 w-full rounded-xl bg-yellow-400 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Procesando..." : "Guardar en Rutina"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}