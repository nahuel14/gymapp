"use client";

import { useCoachStudents } from "@/hooks/useCoachStudents";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, User, ChevronRight, Loader2, LayoutTemplate, CalendarClock } from "lucide-react";
import { createTrainingPlan, instantiateTemplateToStudent } from "./student/actions";
import { useQueryClient, useQuery } from "@tanstack/react-query";

// Shadcn UI Imports
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  errorKey?: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
  
  // Forzamos que el estado inicial sea el lunes de esta semana
  const [newPlan, setNewPlan] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    today.setDate(today.getDate() + diffToMonday);
    return { name: "", startDate: today.toISOString().split('T')[0] };
  });
  
  const [creationMode, setCreationMode] = useState<'template' | 'blank'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 3, 5]);
  const [planError, setPlanError] = useState<string | null>(null);

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
  // Semanas aproximadas = total sesiones / días semanales de la plantilla
  const templateWeeksCount = selectedTemplateData && templateDaysCount > 0
    ? Math.ceil((selectedTemplateData.session_count || 1) / templateDaysCount)
    : 4;
  const hasExactSelectedDays = creationMode !== 'template' || !templateDaysCount || preferredDays.length === templateDaysCount;
/*
  // --- REGLA DE NEGOCIO: FORZAR LUNES (OPCIÓN A) ---
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value + "T00:00:00");
    const day = selectedDate.getDay();
    
    // Si no es Lunes (1), lo corregimos al Lunes de esa misma semana
    if (day !== 1) {
      const diffToMonday = day === 0 ? -6 : 1 - day;
      selectedDate.setDate(selectedDate.getDate() + diffToMonday);
    }
    
    setNewPlan({ ...newPlan, startDate: selectedDate.toISOString().split('T')[0] });
  };
*/
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !newPlan.name) return;
    setPlanError(null);

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
        resetModalState();
      } catch (error: any) {
        const msg: string = error?.message ?? "";
        if (msg.startsWith("PLAN_COLLISION:")) {
          setPlanError(msg.replace("PLAN_COLLISION:", "").trim());
        } else {
          setPlanError("Ocurrió un error al crear el plan. Intentá de nuevo.");
        }
      }
    });
  };

  const resetModalState = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
    const today = new Date();
    const diffToMonday = today.getDay() === 0 ? -6 : 1 - today.getDay();
    today.setDate(today.getDate() + diffToMonday);
    setNewPlan({ name: "", startDate: today.toISOString().split('T')[0] });
    setCreationMode('template');
    setSelectedTemplate(null);
    setDurationWeeks(4);
    setPreferredDays([1, 3, 5]);
    setPlanError(null);
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

// --- REGLA DE NEGOCIO: FORZAR LUNES (CORRECCIÓN) ---
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Si es domingo (0), resta 6 para ir al lunes anterior. Si es otro día, resta (day - 1)
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDate = new Date(e.target.value + "T00:00:00");
    const monday = getMonday(rawDate);
    setNewPlan({ ...newPlan, startDate: monday.toISOString().split('T')[0] });
  };

  // --- CÁLCULO DE PREVISUALIZACIÓN (CORRECCIÓN) ---
  const previewStart = new Date(newPlan.startDate + "T00:00:00");
  const activeWeeks = creationMode === 'blank' ? durationWeeks : templateWeeksCount;
  
  // Calculamos el domingo exacto: Start (Lunes) + (Semanas * 7 días) - 1 día
  const previewEnd = new Date(previewStart);
  previewEnd.setDate(previewStart.getDate() + (Math.max(activeWeeks, 1) * 7) - 1);

  let errorMessage = "";
  if (errorKey === "save") {
    errorMessage = "Ocurrió un error al realizar la acción.";
  }

  if (isLoading && !data) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Cargando alumnos...
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
        <h1 className="text-xl font-black text-foreground tracking-tight">Panel de alumnos</h1>
        <p className="text-xs text-muted-foreground">
          {(coach as any).name ? `Hola, ${(coach as any).name}.` : "Hola, revisa el estado de tus alumnos."}
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs font-bold text-destructive">
          {errorMessage}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-xs font-bold text-muted-foreground shadow-sm text-center border-2 border-dashed border-border">
          No tienes alumnos asignados.
        </div>
      ) : (
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
                <Link
                  href={`/coach/student/${student.studentId}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground group-hover:translate-x-0.5 transition-transform"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog 
        open={isModalOpen} 
        onOpenChange={(open) => {
          if (!open) resetModalState();
          else setIsModalOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-4xl border-border bg-card shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Nuevo Plan</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Para: {selectedStudent?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePlan} className="flex flex-col gap-5 py-2">
            
            <Tabs 
              defaultValue="template" 
              value={creationMode} 
              onValueChange={(v) => setCreationMode(v as 'template' | 'blank')}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl h-auto p-1 bg-muted">
                <TabsTrigger value="template" className="rounded-lg py-2.5 text-xs font-black data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  <LayoutTemplate className="h-4 w-4 mr-2" /> Plantilla
                </TabsTrigger>
                <TabsTrigger value="blank" className="rounded-lg py-2.5 text-xs font-black data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  <Plus className="h-4 w-4 mr-2" /> En Blanco
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-2">
              <Label htmlFor="planName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre del Plan</Label>
              <Input 
                id="planName"
                required
                placeholder={creationMode === 'template' ? "Ej: Hipertrofia Basada en Plantilla" : "Ej: Hipertrofia Marzo"}
                value={newPlan.name}
                onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                className="rounded-xl border-border bg-muted/50 focus-visible:ring-primary h-12"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha de Inicio (Semana Lunes)</Label>
              <Input 
                id="startDate"
                required
                type="date" 
                value={newPlan.startDate}
                onChange={handleDateChange}
                className="rounded-xl border-border bg-muted/50 focus-visible:ring-primary h-12"
              />
            </div>

            {creationMode === 'template' && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seleccionar Plantilla</Label>
                  <Select required onValueChange={handleTemplateChange} value={selectedTemplate?.toString() || ""}>
                    <SelectTrigger className="rounded-xl border-border bg-muted/50 h-12">
                      <SelectValue placeholder="Elegir una plantilla..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name} ({template.session_count} sesiones)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Días de Entrenamiento</Label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant={preferredDays.includes(index) ? "default" : "outline"}
                        onClick={() => toggleDay(index)}
                        className={`aspect-square p-0 h-auto rounded-lg text-xs font-black transition-all ${
                          preferredDays.includes(index) ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
                        }`}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1">
                    {templateDaysCount > 0
                      ? `La plantilla exige ${templateDaysCount} días semanales. Seleccionados: ${preferredDays.length}.`
                      : "Seleccioná en qué días caerán las sesiones de la plantilla."}
                  </p>
                </div>
              </>
            )}

            {creationMode === 'blank' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duración (Semanas)</Label>
                <Input
                  id="duration"
                  required
                  min={1}
                  type="number"
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Math.max(1, Number(e.target.value) || 1))}
                  className="rounded-xl border-border bg-muted/50 focus-visible:ring-primary h-12"
                />
              </div>
            )}

            {/* PREVISUALIZACIÓN DE FECHAS */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
              <CalendarClock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Resumen del Bloque</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Desde el <b>{formatDate(previewStart)}</b> hasta el <b>{formatDate(previewEnd)}</b> ({activeWeeks} semanas).
                </span>
              </div>
            </div>

            {/* ERROR DE COLISIÓN */}
            {planError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2.5 flex items-start gap-2">
                <span className="text-destructive mt-0.5 shrink-0 text-sm font-black">!</span>
                <p className="text-xs font-bold text-destructive leading-relaxed">{planError}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || (creationMode === 'blank' && durationWeeks < 1) || (creationMode === 'template' && (!selectedTemplate || preferredDays.length === 0 || !hasExactSelectedDays))}
              className="mt-2 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
              ) : creationMode === 'template' ? (
                <><LayoutTemplate className="mr-2 h-5 w-5" /> Instanciar Plantilla</>
              ) : (
                <><Plus className="mr-2 h-5 w-5" /> Crear Plan Vacío</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}