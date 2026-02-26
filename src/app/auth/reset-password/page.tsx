 "use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ 
          type: "success", 
          text: "¡Contraseña actualizada con éxito! Redirigiendo al login..." 
        });
        setTimeout(() => {
          router.push("/auth?view=login&success=passwordUpdated");
        }, 2000);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-md border border-border">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Nueva contraseña</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu nueva clave de acceso.
          </p>
        </div>

        {message && (
          <div className={`mb-6 flex items-start gap-3 rounded-lg p-4 text-sm ${
            message.type === "success" 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
              : "bg-red-50 text-red-700 border border-red-100"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <p>{message.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="pass" className="block text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
              Nueva Contraseña
            </label>
            <input
              required
              id="pass"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-xl border-2 border-border bg-background p-4 text-sm outline-none focus:border-primary transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
              Confirmar Contraseña
            </label>
            <input
              required
              id="confirm"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-xl border-2 border-border bg-background p-4 text-sm outline-none focus:border-primary transition-all font-medium"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            disabled={isPending}
            className="w-full rounded-xl bg-primary py-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending ? "ACTUALIZANDO..." : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
