import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { AuthPasswordField } from "./AuthPasswordField";

async function loginWithPassword(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/auth?error=missing&view=login");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
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

  if (role === "ADMIN") {
    redirect("/admin");
  }

  if (role === "COACH") {
    redirect("/coach");
  }

  if (role === "STUDENT") {
    redirect("/student");
  }

  redirect("/auth?error=norole&view=login");
}

async function signUpWithPassword(formData: FormData) {
  "use server";

  const firstName = formData.get("first_name");
  const lastName = formData.get("last_name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0
  ) {
    redirect("/auth?error=missing&view=signup");
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    redirect("/auth?error=missing&view=signup");
  }

  if (password !== confirmPassword) {
    redirect("/auth?error=password_mismatch&view=signup");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
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

  if (role === "ADMIN") {
    redirect("/admin");
  }

  if (role === "COACH") {
    redirect("/coach");
  }

  if (role === "STUDENT") {
    redirect("/student");
  }

  redirect("/auth?error=norole&view=login");
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

  let errorMessage = "";
  let successMessage = "";

  if (errorKey === "missing") {
    errorMessage = "Por favor completa los campos requeridos.";
  } else if (errorKey === "invalid") {
    errorMessage = "Credenciales inválidas. Intenta nuevamente.";
  } else if (errorKey === "norole") {
    errorMessage = "No se encontró un rol asignado a este usuario.";
  } else if (errorKey === "signup") {
    errorMessage =
      "No se pudo crear la cuenta. Revisa el email o intenta con otro.";
  }

  if (successKey === "signupPending") {
    successMessage =
      "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.";
  } else if (successKey === "passwordUpdated") {
    successMessage = "¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva clave.";
  } else if (errorKey === "password_mismatch") {
    errorMessage = "Las contraseñas no coinciden. Vuelve a intentarlo.";
  }

  const isLoginView = view === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
          Gymapp
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {isLoginView
            ? "Inicia sesión para acceder a tu panel."
            : "Crea una cuenta para comenzar a usar Gymapp."}
        </p>

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
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <AuthPasswordField
              id="password"
              name="password"
              label="Contraseña"
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
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <AuthPasswordField
              id="signup_password"
              name="password"
              label="Contraseña"
            />

            <AuthPasswordField
              id="signup_confirm_password"
              name="confirm_password"
              label="Confirmar contraseña"
            />

            <p className="text-xs text-muted-foreground">
              Crearemos tu cuenta como estudiante. Más adelante un coach podrá
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
