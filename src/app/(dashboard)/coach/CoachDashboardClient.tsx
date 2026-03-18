 "use client";
import { useCoachStudents } from "@/hooks/useCoachStudents";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Calendar, User, ChevronRight, Loader2, X, LayoutTemplate } from "lucide-react";
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
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 3, 5]); // Lunes, Miércoles, Viernes

  // Fetch templates for the coach
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
          if (!selectedTemplate) {
            return;
          }

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
        <p className="text-sm text-muted-foreground">Cargando estudiantes...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground">
          No se pudo cargar la información del coach.
        </p>
      </div>
    );
  }

  const { coach, students } = data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Panel de estudiantes
        </h1>
        <p className="text-sm text-muted-foreground">
          {(coach as any).name
            ? `Hola, ${(coach as any).name}.`
            : "Hola, revisa el estado de tus estudiantes."}
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="rounded-lg bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No tienes estudiantes asignados.
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student) => (
            <div
              key={student.studentId}
              className="group flex flex-col items-start justify-between gap-4 rounded-3xl bg-card p-6 shadow-sm border border-border hover:border-primary/50 transition-all md:flex-row md:items-center"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <User className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex flex-col">
                  <p className="text-base font-black text-foreground">
                    {student.studentName}
                  </p>
                  {student.planId ? (
                    <div className="flex flex-col">
                      <p className="text-xs font-bold text-primary flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {student.planName}
                      </p>
                      {student.startDate && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Iniciado el {new Date(student.startDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex mt-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider border border-red-100">
                      Sin plan asignado
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex w-full items-center gap-2 md:w-auto">
                <Link
                  href={`/coach/student/${student.studentId}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border px-4 py-2.5 text-xs font-black text-foreground hover:bg-muted transition md:flex-none"
                >
                  <Calendar className="h-4 w-4" /> VER RUTINA <ChevronRight className="h-4 w-4" />
                </Link>
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
              {/* Tipo de Plan */}
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

              {/* Nombre del Plan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                  Nombre del Plan
                </label>
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

                  {/* Días de la Semana */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Días de Entrenamiento
                    </label>
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
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Duración (Semanas)
                    </label>
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
                className="mt-4 bg-primary text-primary-foreground py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
