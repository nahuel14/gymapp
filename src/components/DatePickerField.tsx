"use client";

import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  label?: string;
}

function strToDate(str: string): Date {
  return new Date(str + "T00:00:00");
}

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePickerField({ value, onChange, min, max, label }: DatePickerFieldProps) {
  const selected = value ? strToDate(value) : undefined;
  const fromDate = min ? strToDate(min) : undefined;
  const toDate = max ? strToDate(max) : undefined;

  // Arrancar en el primer mes con fechas disponibles
  const defaultMonth =
    selected && fromDate && selected < fromDate ? fromDate
    : (selected ?? fromDate ?? new Date());

  const disabledDays = [
    ...(fromDate ? [{ before: fromDate }] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ];

  const displayDate = selected
    ? selected.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Seleccionar fecha";

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {label}
        </span>
      )}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Fecha seleccionada */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className={cn(
            "text-sm font-black first-letter:uppercase",
            selected ? "text-zinc-100" : "text-zinc-500"
          )}>
            {displayDate}
          </p>
        </div>
        {/* Calendario inline */}
        <div className="flex justify-center py-1">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => { if (date) onChange(dateToStr(date)); }}
            locale={es}
            disabled={disabledDays.length > 0 ? disabledDays : undefined}
            defaultMonth={defaultMonth}
            showOutsideDays={false}
            classNames={{
              // Solo overrides de color — se mantiene flex-1 y resto del layout por defecto
              today: "bg-zinc-700 text-zinc-100 font-bold rounded-lg data-[selected=true]:rounded-none",
              disabled: "opacity-25 cursor-not-allowed",
              weekday: "flex-1 text-zinc-500 text-[0.72rem] font-bold text-center select-none",
              caption_label: "text-sm font-black text-zinc-100 capitalize",
            }}
          />
        </div>
      </div>
    </div>
  );
}
