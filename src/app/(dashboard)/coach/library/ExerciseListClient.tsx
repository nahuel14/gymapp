"use client";

import { useState } from "react";
import { Plus, Search, Dumbbell, X } from "lucide-react";
import { BODY_ZONE_LABELS } from "@/lib/constants";
import { filterExercises } from "@/lib/exercises/library";
import { useExercises } from "@/hooks/useExercises";
import type { Tables } from "@/types/supabase";

type Exercise = Tables<"exercises">;

type Props = {
  initialExercises: Exercise[];
  createAction: (formData: FormData) => Promise<void>;
  errorKey?: string;
};

export function ExerciseListClient({ initialExercises, createAction, errorKey }: Props) {
  const { data: exercises } = useExercises(initialExercises);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = filterExercises(exercises ?? [], searchTerm);

  let errorMessage = "";
  if (errorKey === "missingName") errorMessage = "El nombre del ejercicio es obligatorio.";
  else if (errorKey === "save") errorMessage = "Ocurrió un error al guardar el ejercicio.";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black tracking-tight text-foreground">Ejercicios</h1>
          <p className="text-xs text-muted-foreground">
            Crea y gestiona los ejercicios disponibles para tus planes.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Nuevo Ejercicio</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </header>

      {/* Error banner */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar ejercicio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border-2 border-transparent bg-muted py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-primary"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-20 px-4">
          <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-1 text-base font-black text-foreground">
            {searchTerm ? "Sin resultados" : "No hay ejercicios aún"}
          </h3>
          <p className="max-w-xs text-center text-xs text-muted-foreground mb-6">
            {searchTerm
              ? `No encontramos ejercicios con "${searchTerm}".`
              : "Creá tu primer ejercicio para empezar a armar rutinas."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl border-2 border-border px-4 py-2.5 text-sm font-black text-muted-foreground transition-all hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Crear Ejercicio
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((exercise) => (
            <div
              key={exercise.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-black text-foreground">{exercise.name}</p>
                <p className="text-xs text-muted-foreground">
                  {exercise.body_zone ? (BODY_ZONE_LABELS as Record<string, string>)[exercise.body_zone] : "Sin zona"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-card rounded-t-4xl sm:rounded-3xl border-t sm:border border-border shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:max-w-md flex flex-col max-h-[92dvh]">
            <div className="shrink-0 px-6 pt-4 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-foreground tracking-tight">Nuevo Ejercicio</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                    Agregar a la biblioteca
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="ml-4 shrink-0 h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-8 pt-2 sm:px-8">
              <form action={createAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Nombre *
                  </label>
                  <input
                    name="name"
                    required
                    autoFocus
                    className="w-full rounded-2xl border-2 border-transparent bg-muted px-4 py-3 text-sm font-medium outline-none transition focus:border-primary"
                    placeholder="Ej: Sentadilla búlgara"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Zona del cuerpo
                  </label>
                  <select
                    name="body_zone"
                    className="w-full rounded-2xl border-2 border-transparent bg-muted px-4 py-3 text-sm font-medium outline-none transition focus:border-primary appearance-none"
                  >
                    <option value="">Sin especificar</option>
                    {Object.entries(BODY_ZONE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    URL de video (opcional)
                  </label>
                  <input
                    name="video_url"
                    type="url"
                    className="w-full rounded-2xl border-2 border-transparent bg-muted px-4 py-3 text-sm font-medium outline-none transition focus:border-primary"
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-2xl border-2 border-border py-3.5 text-sm font-black text-muted-foreground transition hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
