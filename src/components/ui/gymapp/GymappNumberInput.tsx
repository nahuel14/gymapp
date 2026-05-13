"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

interface GymappNumberInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  className?: string;
  allowNull?: boolean;
}

export function GymappNumberInput({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  placeholder = "0",
  className = "",
  allowNull = false,
}: GymappNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleIncrement = () => {
    const currentValue = value ?? (allowNull ? 0 : min);
    const newValue = Math.min(max, currentValue + step);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const currentValue = value ?? (allowNull ? 0 : min);
    const newValue = Math.max(min, currentValue - step);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "" && allowNull) {
      onChange(null);
      return;
    }

    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value !== null && value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-400 active:scale-95 disabled:opacity-30 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-400"
          aria-label="Disminuir"
        >
          <Minus className="h-4 w-4" />
        </button>

        <input
          type="number"
          value={value ?? ""}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`h-10 w-16 rounded-lg border-2 bg-zinc-950 px-3 text-center text-base font-black text-zinc-100 outline-none transition-all ${
            isFocused
              ? "border-yellow-400 ring-2 ring-yellow-400/20"
              : "border-zinc-800"
          }`}
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value !== null && value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:border-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-400 active:scale-95 disabled:opacity-30 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-400"
          aria-label="Aumentar"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
