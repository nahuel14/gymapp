"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Save, Loader2, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { updateOwnProfile } from "@/app/(dashboard)/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { validateProfileFields } from "@/lib/profile/validation";

type ProfileProps = {
  initialData: {
    email: string;
    name: string;
    last_name: string;
  };
};

export function ProfileClient({ initialData }: ProfileProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    last_name: initialData.last_name || "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const validation = validateProfileFields(formData.name, formData.last_name);
    if (!validation.ok) {
      setMessage({ type: "error", text: "Nombre y apellido son obligatorios." });
      return;
    }
    startTransition(async () => {
      try {
        await updateOwnProfile(formData.name, formData.last_name);
        setMessage({ type: "success", text: "Perfil actualizado con éxito." });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Error al actualizar perfil." });
      }
    });
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-8">
      <header className="mb-4 flex flex-col gap-1">
        <h1 className="text-xl font-black tracking-tight text-foreground">Mi Perfil</h1>
        <p className="text-xs text-muted-foreground">Gestiona tu información personal y de contacto.</p>
      </header>

      {message && (
        <div className={`mb-4 flex items-start gap-3 rounded-2xl p-3 text-sm animate-in fade-in slide-in-from-top-2 ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : "bg-red-50 text-red-700 border border-red-100"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      <div className="rounded-[2.5rem] border-2 border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Email — solo lectura */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            <p className="text-sm font-medium text-muted-foreground px-1 py-1">{initialData.email}</p>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Nombre
            </label>
            <input
              required
              type="text"
              className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-3 outline-none transition font-medium text-sm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Apellido */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Apellido
            </label>
            <input
              required
              type="text"
              className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-3 outline-none transition font-medium text-sm"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
          </div>

          <button
            disabled={isPending}
            className="mt-2 flex items-center justify-center gap-2 bg-foreground text-background py-4 rounded-2xl font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> GUARDANDO...</>
            ) : (
              <><Save className="h-4 w-4" /> GUARDAR CAMBIOS</>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-red-500/30 text-red-400 py-3.5 rounded-2xl font-black text-sm hover:bg-red-500/10 transition active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" /> CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
}
