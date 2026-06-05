"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createTemplatePlan } from "../../student/actions";

export default function CreateTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setError(null);
    if (!name.trim()) { setError("Ingresá un nombre para la plantilla."); return; }
    startTransition(async () => {
      try {
        const res = await fetch("/api/user");
        const { user } = await res.json();
        if (!user) { router.push("/auth"); return; }
        const result = await createTemplatePlan(name.trim(), user.id);
        router.push(`/coach/templates/${result.templateId}/edit`);
      } catch {
        setError("No se pudo crear la plantilla.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col px-4 py-6 md:px-6">
      <button
        onClick={() => router.back()}
        className="mb-6 flex w-fit items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-1 text-2xl font-black uppercase tracking-tight text-zinc-100">
          Nueva Plantilla
        </h1>
        <p className="mb-6 text-xs text-zinc-500">
          Ingresá un nombre y luego editá la estructura de semanas y días.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Nombre de la plantilla
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ej: Fuerza 3 días"
              className="w-full rounded-xl border-2 border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-yellow-400"
              autoFocus // eslint-disable-line jsx-a11y/no-autofocus
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-400">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="w-full rounded-2xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isPending ? "Creando..." : "CREAR PLANTILLA"}
          </button>
        </div>
      </div>
    </div>
  );
}
