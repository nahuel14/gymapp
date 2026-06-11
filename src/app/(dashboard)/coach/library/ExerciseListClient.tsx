"use client";

import { useState, useEffect } from "react";
import { Plus, Search, X, Pencil, Trash2, ChevronLeft, ChevronRight, Play, Image as ImageIcon } from "lucide-react";

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}
import { DumbbellIcon } from "@/components/DumbbellIcon";
import { BODY_ZONE_LABELS } from "@/lib/constants";
import { filterExercises, paginateExercises } from "@/lib/exercises/library";
import { useExercises } from "@/hooks/useExercises";
import type { Tables } from "@/types/supabase";

type Exercise = Tables<"exercises">;

type Props = {
  initialExercises: Exercise[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  errorKey?: string;
};

const PAGE_SIZE = 20;

export function ExerciseListClient({ initialExercises, createAction, updateAction, deleteAction, errorKey }: Props) {
  const { data: exercises } = useExercises(initialExercises);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filtered = filterExercises(exercises ?? [], searchTerm);
  const { items: paginated, totalPages } = paginateExercises(filtered, currentPage, PAGE_SIZE);

  const isEditOpen = editingExercise !== null;

  let errorMessage = "";
  if (errorKey === "missingName") errorMessage = "El nombre del ejercicio es obligatorio.";
  else if (errorKey === "inUse") errorMessage = "No podés eliminar este ejercicio porque está asignado a una o más rutinas.";
  else if (errorKey === "save") errorMessage = "Ocurrió un error al guardar el ejercicio.";

  function closeModal() {
    setIsModalOpen(false);
    setEditingExercise(null);
  }

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
          <DumbbellIcon className="mb-4 h-12 w-12 text-muted-foreground" />
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
        <>
          <div className="flex flex-col gap-2">
            {paginated.map((exercise) => (
              <div
                key={exercise.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{exercise.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.body_zone
                      ? (BODY_ZONE_LABELS as Record<string, string>)[exercise.body_zone]
                      : "Sin zona"}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {exercise.video_url && confirmDeleteId !== exercise.id && (
                    <a
                      href={exercise.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={isImageUrl(exercise.video_url) ? "Ver imagen" : "Ver video"}
                      className="h-8 w-8 flex items-center justify-center rounded-xl text-yellow-500 transition hover:bg-yellow-400/10"
                    >
                      {isImageUrl(exercise.video_url)
                        ? <ImageIcon className="h-3.5 w-3.5" />
                        : <Play className="h-3.5 w-3.5 fill-current" />
                      }
                    </a>
                  )}
                  {confirmDeleteId === exercise.id ? (
                    <>
                      <span className="text-xs text-destructive font-bold mr-1">¿Eliminar?</span>
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={exercise.id} />
                        <button
                          type="submit"
                          className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-black text-destructive transition hover:bg-destructive/20"
                        >
                          Sí
                        </button>
                      </form>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground transition hover:bg-muted/60"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingExercise(exercise)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Editar ejercicio"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(exercise.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Eliminar ejercicio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground font-bold tabular-nums">
                {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal crear / editar */}
      {(isModalOpen || isEditOpen) && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full bg-card rounded-t-4xl sm:rounded-3xl border-t sm:border border-border shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:max-w-md flex flex-col max-h-[92dvh]">
            <div className="shrink-0 px-6 pt-4 pb-3 sm:px-8 sm:pt-8 sm:pb-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-foreground tracking-tight">
                    {isEditOpen ? "Editar Ejercicio" : "Nuevo Ejercicio"}
                  </h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                    {isEditOpen ? editingExercise!.name : "Agregar a la biblioteca"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="ml-4 shrink-0 h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-8 pt-2 sm:px-8">
              <form action={isEditOpen ? updateAction : createAction} className="flex flex-col gap-4">
                {isEditOpen && (
                  <input type="hidden" name="id" value={editingExercise!.id} />
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Nombre *
                  </label>
                  <input
                    name="name"
                    required
                    defaultValue={isEditOpen ? editingExercise!.name : ""}
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
                    defaultValue={isEditOpen ? (editingExercise!.body_zone ?? "") : ""}
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
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Video / foto (URL)
                    </label>
                    {isEditOpen && editingExercise!.video_url && (
                      <a
                        href={editingExercise!.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={isImageUrl(editingExercise!.video_url) ? "Ver imagen" : "Ver video"}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-500 hover:text-yellow-400 transition"
                      >
                        {isImageUrl(editingExercise!.video_url)
                          ? <><ImageIcon className="h-3 w-3" /> Ver foto</>
                          : <><Play className="h-3 w-3 fill-current" /> Ver video</>
                        }
                      </a>
                    )}
                  </div>
                  <input
                    name="video_url"
                    type="url"
                    defaultValue={isEditOpen ? (editingExercise!.video_url ?? "") : ""}
                    className="w-full rounded-2xl border-2 border-transparent bg-muted px-4 py-3 text-sm font-medium outline-none transition focus:border-primary"
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
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
