"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { importTemplateToStudent, createBlankPlan, updatePlanMeta, deletePlan } from "./actions";

type TemplateOption = {
  id: number;
  name: string;
  training_days_count: number;
};

type ManagedPlan = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
};

type ImportTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  managedPlan?: ManagedPlan | null;
  planHasSessions?: boolean;
};

const DAY_OPTIONS = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mié", value: 3 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntil = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return toLocalDateStr(next);
}

function shiftWeek(mondayStr: string, weeks: number): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return toLocalDateStr(d);
}

function formatMonday(dateStr: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
}

function formatDateES(dateStr: string): string {
  const raw = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function calcEndDateLocal(mondayStr: string, weeks: number): string {
  const start = new Date(mondayStr + "T00:00:00");
  start.setDate(start.getDate() + Math.max(weeks, 1) * 7 - 1);
  return toLocalDateStr(start);
}

function computeInitialWeeks(startDate?: string | null, endDate?: string | null): number {
  if (!startDate || !endDate) return 4;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.round(diffDays / 7));
}

function getDefaultDaysForCount(count: number): number[] {
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 3, 5];
  if (count === 4) return [1, 2, 4, 5];
  return [1, 3, 5].slice(0, Math.max(1, Math.min(count, 3)));
}

export function ImportTemplateModal({ isOpen, onClose, studentId, managedPlan, planHasSessions = false }: ImportTemplateModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isManageMode = !!managedPlan;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Create mode state
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [planName, setPlanName] = useState("");
  const [weeksCount, setWeeksCount] = useState(4);

  // Edit mode state
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editWeeks, setEditWeeks] = useState(4);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (managedPlan) {
      setIsConfirmingDelete(false);
      setEditName(managedPlan.name);
      setEditStartDate(managedPlan.start_date || getNextMonday());
      setEditWeeks(computeInitialWeeks(managedPlan.start_date, managedPlan.end_date));
    } else {
      setTemplateId("");
      setPlanName("");
      setWeeksCount(4);
      setSelectedDays([1, 3, 5]);
      setStartDate(getNextMonday());
    }
  }, [isOpen, managedPlan?.id]);

  useEffect(() => {
    if (!isOpen || isManageMode) return;
    const fetchTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const response = await fetch("/api/templates");
        if (!response.ok) throw new Error();
        const data = await response.json();
        setTemplates((data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          training_days_count: item.training_days_count || 0,
        })));
      } catch {
        console.error("Error al cargar plantillas");
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [isOpen, isManageMode]);

  const selectedTemplate = templates.find(t => String(t.id) === templateId) ?? null;
  const templateDaysCount = selectedTemplate?.training_days_count ?? 0;

  const selectedDaysSorted = useMemo(() => {
    return [...selectedDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  }, [selectedDays]);

  const hasExactSelectedDays = !templateDaysCount || selectedDaysSorted.length === templateDaysCount;

  useEffect(() => {
    if (!templateId || !templateDaysCount) return;
    setSelectedDays(getDefaultDaysForCount(templateDaysCount));
  }, [templateId, templateDaysCount]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const offsetDays = useMemo(() => {
    if (!editStartDate || !managedPlan?.start_date) return 0;
    return Math.round(
      (new Date(editStartDate + "T00:00:00").getTime() - new Date(managedPlan.start_date + "T00:00:00").getTime())
      / (1000 * 60 * 60 * 24)
    );
  }, [editStartDate, managedPlan?.start_date]);

  const editPreviewEndDate = useMemo(() => {
    if (!editStartDate || editWeeks < 1) return null;
    return calcEndDateLocal(editStartDate, editWeeks);
  }, [editStartDate, editWeeks]);

  const endDateBlocked = useMemo(() => {
    if (!planHasSessions || !editPreviewEndDate || !managedPlan?.end_date) return false;
    return editPreviewEndDate < managedPlan.end_date;
  }, [planHasSessions, editPreviewEndDate, managedPlan?.end_date]);

  const handleCreatePlan = () => {
    setError(null);
    if (!planName.trim()) { setError("Ingresá un nombre para el plan."); return; }
    if (!startDate) { setError("Seleccioná una semana de inicio."); return; }

    if (!templateId) {
      if (weeksCount < 1) { setError("La cantidad de semanas debe ser al menos 1."); return; }
      startTransition(async () => {
        try {
          await createBlankPlan(studentId, planName, startDate, weeksCount);
          await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
          router.refresh();
          onClose();
        } catch (e: any) {
          setError(e?.message ?? "No se pudo crear el plan.");
        }
      });
    } else {
      if (selectedDaysSorted.length === 0) { setError("Seleccioná al menos un día de entrenamiento."); return; }
      if (templateDaysCount && selectedDaysSorted.length !== templateDaysCount) {
        setError(`Esta plantilla requiere exactamente ${templateDaysCount} días por semana. Tenés ${selectedDaysSorted.length} seleccionados.`);
        return;
      }
      startTransition(async () => {
        try {
          await importTemplateToStudent(studentId, Number(templateId), startDate, selectedDaysSorted, planName);
          await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
          router.refresh();
          onClose();
        } catch (e: any) {
          setError(e?.message ?? "No se pudo importar la plantilla.");
        }
      });
    }
  };

  const handleUpdatePlan = () => {
    if (!managedPlan) return;
    setError(null);
    if (!editName.trim()) { setError("El nombre no puede estar vacío."); return; }
    if (!editStartDate) { setError("Seleccioná una fecha de inicio."); return; }
    if (!editPreviewEndDate) return;

    startTransition(async () => {
      try {
        await updatePlanMeta(managedPlan.id, {
          name: editName,
          start_date: editStartDate,
          end_date: editPreviewEndDate,
        });
        await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
        router.refresh();
        onClose();
      } catch (e: any) {
        const msg = e?.message ?? "No se pudo actualizar el plan.";
        setError(msg.replace("PLAN_COLLISION:", ""));
      }
    });
  };

  const handleDeletePlan = () => {
    if (!managedPlan) return;
    startTransition(async () => {
      try {
        await deletePlan(managedPlan.id);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
        router.refresh();
        onClose();
      } catch (e: any) {
        setError(e?.message ?? "No se pudo eliminar el plan.");
        setIsConfirmingDelete(false);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl flex flex-col sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="shrink-0 px-5 pt-3 pb-4 flex flex-col gap-3">
          <div className="flex justify-center sm:hidden">
            <div className="h-1 w-10 rounded-full bg-zinc-700" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-black uppercase tracking-tight text-zinc-100">
              {isManageMode ? "Editar Plan" : "Nuevo Plan"}
            </h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto flex-1 px-5 flex flex-col gap-3 pb-2">

          {/* MODO CREAR */}
          {!isManageMode && (
            <>
              <Field label="Nombre del plan">
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="Ej: Potencia Junio"
                  className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400 placeholder:text-zinc-600"
                />
              </Field>

              <Field label="Plantilla">
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400"
                >
                  <option value="">{isLoadingTemplates ? "Cargando..." : "Sin plantilla (plan en blanco)"}</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Semana de inicio">
                <WeekNavigator value={startDate} onChange={setStartDate} />
              </Field>

              {!templateId && (
                <Field label="Duración">
                  <Stepper
                    value={weeksCount}
                    label={`semana${weeksCount !== 1 ? "s" : ""}`}
                    onDecrement={() => setWeeksCount(w => Math.max(1, w - 1))}
                    onIncrement={() => setWeeksCount(w => w + 1)}
                  />
                </Field>
              )}

              {templateId && (
                <Field
                  label="Días de entrenamiento"
                  badge={templateDaysCount > 0
                    ? { text: `${selectedDaysSorted.length} / ${templateDaysCount}`, ok: hasExactSelectedDays }
                    : undefined
                  }
                >
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {DAY_OPTIONS.map(day => {
                      const checked = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                            checked
                              ? "bg-yellow-400 text-black"
                              : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-yellow-400/50"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {templateDaysCount > 0 && !hasExactSelectedDays && (
                    <p className="text-xs text-red-400 mt-1">
                      Seleccioná exactamente {templateDaysCount} días.
                    </p>
                  )}
                </Field>
              )}
            </>
          )}

          {/* MODO GESTIONAR: EDITAR */}
          {isManageMode && (
            <>
              <Field label="Nombre del plan">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400 placeholder:text-zinc-600"
                />
              </Field>

              <Field label="Semana de inicio">
                <WeekNavigator value={editStartDate} onChange={setEditStartDate} />
                {planHasSessions && offsetDays !== 0 && (
                  <p className="text-xs text-zinc-500 leading-snug mt-1">
                    Las sesiones se desplazarán {Math.abs(offsetDays)} días hacia {offsetDays < 0 ? "atrás" : "adelante"}.
                  </p>
                )}
              </Field>

              <Field label="Duración">
                <Stepper
                  value={editWeeks}
                  label={`semana${editWeeks !== 1 ? "s" : ""}`}
                  onDecrement={() => setEditWeeks(w => Math.max(1, w - 1))}
                  onIncrement={() => setEditWeeks(w => w + 1)}
                />
              </Field>

              {editPreviewEndDate && (
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Fin del plan</p>
                  <p className="text-sm font-black text-zinc-100">{formatDateES(editPreviewEndDate)}</p>
                  {endDateBlocked && (
                    <p className="text-xs text-zinc-500 leading-snug mt-1">
                      Si hay sesiones fuera de este rango, no se podrá guardar.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer fijo */}
        <div className="shrink-0 px-5 pt-3 pb-6 sm:pb-5 flex flex-col gap-2 border-t border-zinc-800/60">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 flex items-start gap-2">
              <span className="text-red-400 font-black text-sm shrink-0">!</span>
              <p className="text-xs font-bold text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {!isManageMode && (
            <button
              onClick={handleCreatePlan}
              disabled={isPending || (!!templateId && !hasExactSelectedDays)}
              className="w-full rounded-2xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isPending ? "Procesando..." : "CREAR PLAN"}
            </button>
          )}

          {isManageMode && !isConfirmingDelete && (
            <button
              onClick={handleUpdatePlan}
              disabled={isPending}
              className="w-full rounded-2xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "GUARDAR CAMBIOS"}
            </button>
          )}

          {isManageMode && !isConfirmingDelete && (
            <button
              onClick={() => { setIsConfirmingDelete(true); setError(null); }}
              disabled={isPending}
              className="w-full rounded-2xl border border-red-500/30 py-2.5 text-sm font-black uppercase tracking-widest text-red-500 transition hover:bg-red-500/10 active:scale-[0.99] disabled:opacity-50"
            >
              ELIMINAR PLAN
            </button>
          )}

          {isManageMode && isConfirmingDelete && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-zinc-400 text-center">
                ¿Seguro? Se eliminarán todas las sesiones y ejercicios del plan.
              </p>
              <button
                onClick={handleDeletePlan}
                disabled={isPending}
                className="w-full rounded-2xl bg-red-500 py-3.5 text-sm font-black uppercase tracking-widest text-white transition hover:bg-red-600 active:scale-[0.99] disabled:opacity-50"
              >
                {isPending ? "Eliminando..." : "SÍ, ELIMINAR"}
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isPending}
                className="w-full rounded-2xl border border-zinc-700 py-3 text-sm font-black uppercase tracking-widest text-zinc-400 transition hover:bg-zinc-900 active:scale-[0.99] disabled:opacity-50"
              >
                CANCELAR
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ──

function WeekNavigator({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftWeek(value, -1))}
        className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex-1 rounded-xl border-2 border-zinc-800 bg-zinc-900 py-2.5 px-2 text-center">
        <p className="text-xs font-black text-zinc-100">Lun. {value ? formatMonday(value) : "—"}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftWeek(value, 1))}
        className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  badge?: { text: string; ok: boolean };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
        {badge && (
          <span className={`text-[10px] font-bold ${badge.ok ? "text-zinc-600" : "text-red-400"}`}>
            {badge.text}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  label,
  onDecrement,
  onIncrement,
}: {
  value: number;
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrement}
        className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex-1 rounded-xl border-2 border-zinc-800 bg-zinc-900 py-2.5 text-center">
        <span className="text-sm font-black text-zinc-100">{value} {label}</span>
      </div>
      <button
        type="button"
        onClick={onIncrement}
        className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
