"use client";

import { useCoachStudents } from "@/hooks/useCoachStudents";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, User, ChevronRight, Loader2, X, LayoutTemplate } from "lucide-react";
import { createTrainingPlan, instantiateTemplateToStudent } from "./student/actions";
import { useQueryClient, useQuery } from "@tanstack/react-query";

type Props = {
  errorKey?: string;
};

const getDefaultDaysForCount = (count: number) => {
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 3, 5];
  if (count === 4) return [1, 2, 4, 5];
  return [1, 3, 5].slice(0, Math.max(1, Math.min(count, 3)));
};

export function CoachDashboardClient({ errorKey }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useCoachStudents();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [newPlan, setNewPlan] = useState({ name: "", startDate: new Date().toISOString().split('T')[0] });
  const [creationMode, setCreationMode] = useState<'template' | 'blank'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 3, 5]);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Error fetching templates");
      return response.json();
    },
    enabled: isModalOpen && creationMode === 'template'
  });
  
  const selectedTemplateData = templates.find((template: any) => template.id === selectedTemplate) as any;
  const templateDaysCount = selectedTemplateData?.training_days_count || 0;
  const hasExactSelectedDays = creationMode !== 'template' || !templateDaysCount || preferredDays.length === templateDaysCount;

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !newPlan.name) return;

    startTransition(async () => {
      try {
        if (creationMode === 'template') {
          if (!selectedTemplate) return;
          await instantiateTemplateToStudent(
            selectedTemplate,
            selectedStudent.id,
            newPlan.startDate,
            preferredDays
          );
        } else {
          await createTrainingPlan(selectedStudent.id, newPlan.name, newPlan.startDate, durationWeeks);
        }
        
        await queryClient.invalidateQueries({ queryKey: ["coach", "students"] });
        setIsModalOpen(false);
        setSelectedStudent(null);
        setNewPlan({ name: "", startDate: new Date().toISOString().split('T')[0] });
        setCreationMode('template');
        setSelectedTemplate(null);
        setDurationWeeks(4);
        setPreferredDays([1, 3, 5]);
      } catch (error) {
        console.error("Error creating plan:", error);
      }
    });
  };

  const toggleDay = (dayIndex: number) => {
    setPreferredDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleTemplateChange = (templateValue: string) => {
    const nextTemplateId = Number(templateValue);
    setSelectedTemplate(nextTemplateId);
    const nextTemplate = templates.find((template: any) => template.id === nextTemplateId) as any;
    const nextDaysCount = nextTemplate?.training_days_count || 0;
    if (nextDaysCount > 0) {
      setPreferredDays(getDefaultDaysForCount(nextDaysCount));
    }
  };

  let errorMessage = "";
  if (errorKey === "save") {
    errorMessage = "Ocurrió un error al realizar la acción.";
  }

  if (isLoading && !data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Cargando estudiantes...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground">No se pudo cargar la información del coach.</p>
      </div>
    );
  }

  const { coach, students } = data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black text-foreground tracking-tight">Panel de estudiantes</h1>
        <p className="text-xs text-muted-foreground">
          {(coach as any).name ? `Hola, ${(coach as any).name}.` : "Hola, revisa el estado de tus estudiantes."}
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs font-bold text-red-400">
          {errorMessage}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-xs font-bold text-muted-foreground shadow-sm text-center border-2 border-dashed border-border">
          No tienes estudiantes asignados.
        </div>
      ) : (
        /* LISTA COMPACTA MOBILE-FIRST (Sin texto del plan) */
        <div className="flex flex-col gap-2">
          {students.map((student) => (
            <div 
              key={student.studentId}
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all"
            >
              <Link 
                href={`/coach/student/${student.studentId}`}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <User className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                
                <div className="flex flex-col min-w-0 justify-center">
                  <p className="text-sm font-black text-foreground truncate">
                    {student.studentName}
                  </p>
                </div>
              </Link>

              <div className="flex items-center shrink-0 pl-2">
                {!student.planId ? (
                  <button
                    onClick={() => {
                      setSelectedStudent({ id: student.studentId, name: student.studentName });
                      setIsModalOpen(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                    title="Asignar Plan"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : (
                  <Link 
                    href={`/coach/student/${student.studentId}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground group-hover:translate-x-0.5 transition-transform"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Crear Plan */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border-2 border-border w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-foreground tracking-tight">Nuevo Plan</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Para: {selectedStudent.name}</p>
              </div>
              <button onClick={() => {
                setIsModalOpen(false);
                setCreationMode('template');
                setSelectedTemplate(null);
                setDurationWeeks(4);
                setPreferredDays([1, 3, 5]);
              }} className="p-2 rounded-full hover:bg-muted transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Tipo de Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreationMode('template')}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      creationMode === 'template' 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border bg-muted text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <LayoutTemplate className="h-5 w-5" />
                    <span className="text-xs font-black">Importar Plantilla</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setCreationMode('blank')}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      creationMode === 'blank' 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border bg-muted text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs font-black">Crear desde cero</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre del Plan</label>
                <input 
                  required
                  type="text" 
                  className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                  placeholder={creationMode === 'template' ? "Ej: Hipertrofia Basada en Plantilla" : "Ej: Hipertrofia Marzo"}
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                />
              </div>

              {creationMode === 'template' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Fecha de Inicio</label>
                    <input 
                      required
                      type="date" 
                      className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                      value={newPlan.startDate}
                      onChange={(e) => setNewPlan({...newPlan, startDate: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Plantilla</label>
                    <select 
                      required
                      className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                      value={selectedTemplate || ""}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                    >
                      <option value="">Seleccionar plantilla...</option>
                      {templates.map((template: any) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.session_count} sesiones)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Días de Entrenamiento</label>
                    <div className="grid grid-cols-7 gap-2">
                      {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleDay(index)}
                          className={`aspect-square rounded-lg border-2 text-xs font-black transition-all ${
                            preferredDays.includes(index)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {templateDaysCount > 0
                        ? `Esta plantilla requiere exactamente ${templateDaysCount} días por semana. Has seleccionado ${preferredDays.length}.`
                        : "Selecciona los días para distribuir las sesiones"}
                    </p>
                  </div>
                </>
              )}

              {creationMode === 'blank' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Fecha de Inicio</label>
                    <input 
                      required
                      type="date" 
                      className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                      value={newPlan.startDate}
                      onChange={(e) => setNewPlan({...newPlan, startDate: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Duración (Semanas)</label>
                    <input
                      required
                      min={1}
                      type="number"
                      className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </>
              )}

              <button 
                disabled={isPending || (creationMode === 'blank' && durationWeeks < 1) || (creationMode === 'template' && (!selectedTemplate || preferredDays.length === 0 || !hasExactSelectedDays))}
                className="mt-4 bg-primary text-primary-foreground py-5 rounded-3xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> PROCESANDO...
                  </>
                ) : creationMode === 'template' ? (
                  <>
                    <LayoutTemplate className="h-5 w-5" /> INSTANCIAR PLANTILLA
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" /> CREAR PLAN EN BLANCO
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}