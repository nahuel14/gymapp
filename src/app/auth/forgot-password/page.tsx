 "use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ 
          type: "success", 
          text: "Se ha enviado un enlace de recuperación a tu email. Por favor, revisa tu bandeja de entrada." 
        });
        setEmail("");
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-md border border-border">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu email y te enviaremos un enlace para blanquear tu clave.
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
            <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
              Email
            </label>
            <input
              required
              id="email"
              type="email"
              placeholder="tu@email.com"
              className="w-full rounded-xl border-2 border-border bg-background p-4 text-sm outline-none focus:border-primary transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            disabled={isPending}
            className="w-full rounded-xl bg-primary py-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending ? "ENVIANDO..." : "ENVIAR ENLACE"}
          </button>
        </form>

        <div className="mt-8 flex justify-center">
          <Link 
            href="/auth" 
            className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> VOLVER AL LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}
