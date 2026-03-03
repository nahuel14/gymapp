 "use client";

import { useState, useTransition } from "react";
import { User, Mail, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateOwnProfile } from "@/app/actions/admin";

type ProfileProps = {
  initialData: {
    email: string;
    name: string;
    last_name: string;
  };
};

export function ProfileClient({ initialData }: ProfileProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    last_name: initialData.last_name || "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      try {
        await updateOwnProfile(formData.name, formData.last_name);
        setMessage({ type: "success", text: "Perfil actualizado con éxito." });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Error al actualizar perfil." });
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-black text-foreground tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground font-medium">Gestiona tu información personal y de contacto.</p>
      </header>

      {message && (
        <div className={`mb-6 flex items-start gap-3 rounded-2xl p-4 text-sm animate-in fade-in slide-in-from-top-2 ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
            : "bg-red-50 text-red-700 border border-red-100"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      <div className="rounded-[2.5rem] border-2 border-border bg-card p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Email - Read Only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email (No editable)
            </label>
            <input 
              disabled
              type="email" 
              className="bg-muted/50 border-2 border-transparent rounded-2xl p-4 outline-none font-medium text-sm text-muted-foreground cursor-not-allowed"
              value={initialData.email}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Nombre
              </label>
              <input 
                required
                type="text" 
                className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            {/* Last Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Apellido
              </label>
              <input 
                required
                type="text" 
                className="bg-muted border-2 border-transparent focus:border-primary rounded-2xl p-4 outline-none transition font-medium text-sm"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              />
            </div>
          </div>

          <button 
            disabled={isPending}
            className="mt-4 flex items-center justify-center gap-2 bg-foreground text-background py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> GUARDANDO...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" /> GUARDAR CAMBIOS
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
