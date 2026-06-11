import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { AuthPasswordField } from "./AuthPasswordField";
import {
  validateLoginFields,
  validateSignupFields,
  getAuthRedirect,
  resolveAuthError,
  resolveAuthSuccess,
} from "@/lib/auth/validation";
import { DumbbellIcon } from "@/components/DumbbellIcon";

async function loginWithPassword(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  const validation = validateLoginFields(email, password);
  if (!validation.ok) {
    redirect(`/auth?error=${validation.code}&view=login`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  });

  if (error) {
    redirect("/auth?error=invalid&view=login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?error=missing&view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id as never)
    .single();

  const existingProfile =
    profile as
      | {
          role: Database["public"]["Enums"]["user_role"] | null;
        }
      | null;

  const role = existingProfile?.role;
  redirect(getAuthRedirect(role));
}

async function signUpWithPassword(formData: FormData) {
  "use server";

  const firstName = formData.get("first_name");
  const lastName = formData.get("last_name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  const signupValidation = validateSignupFields(firstName, lastName, email, password, confirmPassword);
  if (!signupValidation.ok) {
    redirect(`/auth?error=${signupValidation.code}&view=signup`);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: email as string,
    password: password as string,
    options: {
      data: {
        name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    redirect("/auth?error=signup&view=signup");
  }

  if (!data.session || !data.user) {
    redirect("/auth?success=signupPending&view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id as never)
    .single();

  const existingProfile =
    profile as
      | {
          role: Database["public"]["Enums"]["user_role"] | null;
        }
      | null;

  const role = existingProfile?.role ?? "STUDENT";

  if (!existingProfile) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email ?? null,
        name: firstName,
        last_name: lastName,
        role,
      } as any,
      { onConflict: "id" },
    );
  }

  redirect(getAuthRedirect(role));
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    view?: "login" | "signup";
  }>;
}) {
  const params = await searchParams;

  const view = params.view ?? "login";
  const errorKey = params.error;
  const successKey = params.success;

  const errorMessage = resolveAuthError(errorKey);
  const successMessage = resolveAuthSuccess(successKey);

  const isLoginView = view === "login";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 gap-6">

      {/* Branding hero */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-yellow-400/10 p-4 ring-1 ring-yellow-400/20">
          <DumbbellIcon className="h-10 w-10 text-yellow-400" />
        </div>
        <p className="text-2xl font-black text-foreground tracking-tight">BeeGym</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-md">

          <div className="mb-4 flex rounded-md bg-muted p-1 text-sm">
          <a
            href="/auth?view=login"
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${
              isLoginView
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Iniciar sesión
          </a>
          <a
            href="/auth?view=signup"
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${
              !isLoginView
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Crear cuenta
          </a>
        </div>

        {isLoginView ? null : null}

        {errorMessage ? (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {isLoginView ? (
          <form action={loginWithPassword} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <AuthPasswordField
              id="password"
              name="password"
              label="Contraseña"
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <a
                href="/auth/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Entrar
            </button>
          </form>
        ) : (
          <form action={signUpWithPassword} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-foreground"
                >
                  Nombre
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  autoComplete="given-name"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-foreground"
                >
                  Apellido
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  autoComplete="family-name"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="signup_email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="signup_email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <AuthPasswordField
              id="signup_password"
              name="password"
              label="Contraseña"
              autoComplete="new-password"
            />

            <AuthPasswordField
              id="signup_confirm_password"
              name="confirm_password"
              label="Confirmar contraseña"
              autoComplete="new-password"
            />

            <p className="text-xs text-muted-foreground">
              Crearemos tu cuenta como alumno. Más adelante un coach podrá
              cambiar tu rol si corresponde.
            </p>

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Crear cuenta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
