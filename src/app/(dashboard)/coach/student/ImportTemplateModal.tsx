"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { importTemplateToStudent, createBlankPlan, extendPlan } from "./actions";

type TemplateOption = {
  id: number;
  name: string;
  training_days_count: number;
};

type ActivePlan = {
  id: number;
  name: string;
  end_date?: string | null;
};

type ImportTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  activePlan?: ActivePlan | null;
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

function getNextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntil = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().split("T")[0];
}

function shiftWeek(mondayStr: string, weeks: number): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
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

function getDefaultDaysForCount(count: number): number[] {
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 3, 5];
  if (count === 4) return [1, 2, 4, 5];
  return [1, 3, 5].slice(0, Math.max(1, Math.min(count, 3)));
}

export function ImportTemplateModal({ isOpen, onClose, studentId, activePlan }: ImportTemplateModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasActivePlan = !!(activePlan?.end_date);
  const [tab, setTab] = useState<"new" | "extend">("new");

  // New plan state
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [planName, setPlanName] = useState("");
  const [weeksCount, setWeeksCount] = useState(4);

  // Extend state
  const [extendWeeks, setExtendWeeks] = useState(1);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab("new");
    setError(null);
    setTemplateId("");
    setPlanName("");
    setWeeksCount(4);
    setExtendWeeks(1);
    setSelectedDays([1, 3, 5]);
    setStartDate(getNextMonday());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

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

  const newExtendedEndDate = useMemo(() => {
    if (!activePlan?.end_date || extendWeeks < 1) return null;
    const d = new Date(activePlan.end_date + "T00:00:00");
    d.setDate(d.getDate() + extendWeeks * 7);
    const dow = d.getDay();
    if (dow !== 0) d.setDate(d.getDate() + (7 - dow));
    return d.toISOString().split("T")[0];
  }, [activePlan?.end_date, extendWeeks]);

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

  const handleExtendPlan = () => {
    if (!activePlan) return;
    setError(null);
    if (extendWeeks < 1) { setError("Agregá al menos 1 semana."); return; }
    startTransition(async () => {
      try {
        await extendPlan(activePlan.id, extendWeeks);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
        router.refresh();
        onClose();
      } catch (e: any) {
        setError(e?.message ?? "No se pudo extender el plan.");
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
        className="w-full bg-zinc-950 rounded-t-4xl sm:rounded-3xl border-t sm:border border-zinc-800 shadow-2xl flex flex-col sm:max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header fijo ── */}
        <div className="shrink-0 px-5 pt-3 pb-4 flex flex-col gap-3">
          {/* Drag handle */}
          <div className="flex justify-center sm:hidden">
            <div className="h-1 w-10 rounded-full bg-zinc-700" />
          </div>

          {/* Título */}
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-black uppercase tracking-tight text-zinc-100">Gestionar Plan</h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          {hasActivePlan && (
            <div className="flex gap-1 rounded-xl bg-zinc-900 p-1">
              <button
                onClick={() => { setTab("new"); setError(null); }}
                className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  tab === "new" ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Nuevo Bloque
              </button>
              <button
                onClick={() => { setTab("extend"); setError(null); }}
                className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  tab === "extend" ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Extender Plan
              </button>
            </div>
          )}
        </div>

        {/* ── Contenido (scrolleable solo si hace falta) ── */}
        <div className="overflow-y-auto flex-1 px-5 flex flex-col gap-3 pb-2">

          {/* Tab: Nuevo Bloque */}
          {tab === "new" && (
            <>
              {/* Nombre */}
              <Field label="Nombre del plan">
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="Ej: Potencia Junio"
                  className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400 placeholder:text-zinc-600"
                />
              </Field>

              {/* Plantilla */}
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

              {/* Semana de inicio — navegador por semanas (sin input date nativo) */}
              <Field label="Semana de inicio">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStartDate(d => shiftWeek(d, -1))}
                    className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex-1 rounded-xl border-2 border-zinc-800 bg-zinc-900 py-2.5 px-2 text-center">
                    <p className="text-xs font-black text-zinc-100">Lun. {startDate ? formatMonday(startDate) : "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStartDate(d => shiftWeek(d, 1))}
                    className="h-10 w-10 shrink-0 rounded-xl border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </Field>

              {/* Sin plantilla: stepper semanas */}
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

              {/* Con plantilla: días */}
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

          {/* Tab: Extender Plan */}
          {tab === "extend" && activePlan && (
            <>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex flex-col gap-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plan actual</p>
                <p className="text-sm font-black text-zinc-100">{activePlan.name}</p>
                {activePlan.end_date && (
                  <p className="text-xs text-zinc-500">Termina: {formatDateES(activePlan.end_date)}</p>
                )}
              </div>

              <Field label="Semanas a agregar">
                <Stepper
                  value={extendWeeks}
                  label={`semana${extendWeeks !== 1 ? "s" : ""}`}
                  onDecrement={() => setExtendWeeks(w => Math.max(1, w - 1))}
                  onIncrement={() => setExtendWeeks(w => w + 1)}
                />
              </Field>

              {newExtendedEndDate && (
                <div className="rounded-xl bg-yellow-400/5 border border-yellow-400/20 px-4 py-3 flex flex-col gap-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nuevo fin estimado</p>
                  <p className="text-sm font-black text-yellow-400">{formatDateES(newExtendedEndDate)}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer fijo: error + CTA ── */}
        <div className="shrink-0 px-5 pt-3 pb-8 sm:pb-5 flex flex-col gap-2.5 border-t border-zinc-800/60 mt-3">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 flex items-start gap-2">
              <span className="text-red-400 font-black text-sm shrink-0">!</span>
              <p className="text-xs font-bold text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {tab === "new" && (
            <button
              onClick={handleCreatePlan}
              disabled={isPending || (!!templateId && !hasExactSelectedDays)}
              className="w-full rounded-2xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isPending ? "Procesando..." : "CREAR PLAN"}
            </button>
          )}

          {tab === "extend" && (
            <button
              onClick={handleExtendPlan}
              disabled={isPending}
              className="w-full rounded-2xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isPending ? "Extendiendo..." : `EXTENDER ${extendWeeks} SEMANA${extendWeeks !== 1 ? "S" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componentes auxiliares ──

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
