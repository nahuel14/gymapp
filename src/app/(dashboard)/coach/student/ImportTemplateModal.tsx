"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { importTemplateToStudent } from "./actions";

type TemplateOption = {
  id: number;
  name: string;
};

type ImportTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
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

export function ImportTemplateModal({ isOpen, onClose, studentId }: ImportTemplateModalProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const response = await fetch("/api/templates");
        if (!response.ok) {
          throw new Error("No se pudieron cargar las plantillas");
        }
        const data = await response.json();
        setTemplates((data || []).map((item: any) => ({ id: item.id, name: item.name })));
      } catch (error) {
        console.error("Error fetching templates:", error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!startDate) {
      const today = new Date();
      const day = today.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);
      setStartDate(monday.toISOString().split("T")[0]);
    }
  }, [isOpen, startDate]);

  const selectedDaysSorted = useMemo(() => {
    return [...selectedDays].sort((a, b) => {
      const normalizedA = a === 0 ? 7 : a;
      const normalizedB = b === 0 ? 7 : b;
      return normalizedA - normalizedB;
    });
  }, [selectedDays]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((item) => item !== day);
      }
      return [...prev, day];
    });
  };

  const handleConfirm = () => {
    if (!templateId) {
      alert("Selecciona una plantilla");
      return;
    }

    if (!startDate) {
      alert("Selecciona una fecha de inicio");
      return;
    }

    if (selectedDaysSorted.length === 0) {
      alert("Selecciona al menos un día de entrenamiento");
      return;
    }

    startTransition(async () => {
      try {
        await importTemplateToStudent(studentId, Number(templateId), startDate, selectedDaysSorted);
        await queryClient.invalidateQueries({ queryKey: ["student", "routine", studentId] });
        onClose();
      } catch (error) {
        console.error("Error importing template:", error);
        alert("No se pudo importar la plantilla");
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-100">
              Importar Plantilla
            </h3>
            <p className="text-xs font-medium text-zinc-500">
              Elige plantilla, fecha de inicio y días de entrenamiento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Plantilla
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400"
            >
              <option value="">{isLoadingTemplates ? "Cargando plantillas..." : "Seleccionar plantilla..."}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Fecha de inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-4 text-sm font-bold text-zinc-100 outline-none transition-all focus:border-yellow-400"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Días de entrenamiento
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DAY_OPTIONS.map((day) => {
                const checked = selectedDays.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                      checked
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-zinc-800 bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDay(day.value)}
                      className="h-4 w-4 accent-yellow-400"
                    />
                    <span>{day.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-[1.5rem] bg-yellow-400 py-4 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isPending ? "Importando..." : "Confirmar Importación"}
          </button>
        </div>
      </div>
    </div>
  );
}
