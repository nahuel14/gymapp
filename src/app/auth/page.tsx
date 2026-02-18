import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

type AuthPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
    view?: "login" | "signup";
    mode?: "password" | "otp";
  };
};

async function loginWithPassword(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/auth?error=missing&view=login&mode=password");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/auth?error=invalid&view=login&mode=password");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?error=missing&view=login&mode=password");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id as any)
    .single()) as any;

  const role = profile?.role;

  if (role === "COACH") {
    redirect("/coach");
  }

  if (role === "STUDENT") {
    redirect("/student");
  }

  redirect("/auth?error=norole&view=login&mode=password");
}

async function loginWithOtp(formData: FormData) {
  "use server";

  const identifier = formData.get("identifier");
  const type = formData.get("type");

  if (typeof identifier !== "string" || identifier.trim().length === 0) {
    redirect("/auth?error=missing&view=login&mode=otp");
  }

  const supabase = await createSupabaseServerClient();

  if (type === "phone") {
    const { error } = await supabase.auth.signInWithOtp({
      phone: identifier,
    });

    if (error) {
      redirect("/auth?error=otp&view=login&mode=otp");
    }
  } else {
    const { error } = await supabase.auth.signInWithOtp({
      email: identifier,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth`,
      },
    });

    if (error) {
      redirect("/auth?error=otp&view=login&mode=otp");
    }
  }

  redirect("/auth?success=otpSent&view=login&mode=otp");
}

async function signUpWithPassword(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/auth?error=missing&view=signup");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect("/auth?error=signup&view=signup");
  }

  if (!data.session || !data.user) {
    redirect("/auth?success=signupPending&view=login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id as any)
    .single()) as any;

  const role = profile?.role;

  if (role === "COACH") {
    redirect("/coach");
  }

  if (role === "STUDENT") {
    redirect("/student");
  }

  redirect("/auth?error=norole&view=login");
}

export default function AuthPage({ searchParams }: AuthPageProps) {
  const view = searchParams?.view ?? "login";
  const mode = searchParams?.mode ?? "password";
  const errorKey = searchParams?.error;
  const successKey = searchParams?.success;

  let errorMessage = "";
  let successMessage = "";

  if (errorKey === "missing") {
    errorMessage = "Por favor completa los campos requeridos.";
  } else if (errorKey === "invalid") {
    errorMessage = "Credenciales inválidas. Intenta nuevamente.";
  } else if (errorKey === "norole") {
    errorMessage = "No se encontró un rol asignado a este usuario.";
  } else if (errorKey === "otp") {
    errorMessage =
      "No se pudo enviar el código. Verifica el dato ingresado y la configuración de Supabase.";
  } else if (errorKey === "signup") {
    errorMessage =
      "No se pudo crear la cuenta. Revisa el email o intenta con otro.";
  }

  if (successKey === "otpSent") {
    successMessage =
      "Enviamos un enlace o código a tu email o teléfono. Sigue las instrucciones para completar el acceso.";
  } else if (successKey === "signupPending") {
    successMessage =
      "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.";
  }

  const isLoginView = view === "login";
  const isPasswordMode = mode === "password";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900">
          Gymapp
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          {isLoginView
            ? "Inicia sesión para acceder a tu panel."
            : "Crea una cuenta para comenzar a usar Gymapp."}
        </p>

        <div className="mb-4 flex rounded-md bg-zinc-100 p-1 text-sm">
          <a
            href="/auth?view=login&mode=password"
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${
              isLoginView
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Iniciar sesión
          </a>
          <a
            href="/auth?view=signup"
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${
              !isLoginView
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Crear cuenta
          </a>
        </div>

        {isLoginView ? (
          <div className="mb-4 flex rounded-md bg-zinc-100 p-1 text-xs">
            <a
              href="/auth?view=login&mode=password"
              className={`flex-1 rounded-md px-2 py-1 text-center ${
                isPasswordMode
                  ? "bg-white font-medium text-zinc-900 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              Email y contraseña
            </a>
            <a
              href="/auth?view=login&mode=otp"
              className={`flex-1 rounded-md px-2 py-1 text-center ${
                !isPasswordMode
                  ? "bg-white font-medium text-zinc-900 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              Email o teléfono
            </a>
          </div>
        ) : null}

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
          isPasswordMode ? (
            <form action={loginWithPassword} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-800"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-800"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Entrar
              </button>
            </form>
          ) : (
            <form action={loginWithOtp} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-zinc-800"
                >
                  Método
                </label>
                <select
                  id="type"
                  name="type"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  defaultValue="email"
                >
                  <option value="email">Email (enlace mágico/código)</option>
                  <option value="phone">Teléfono (SMS)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-zinc-800"
                >
                  Email o teléfono
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="ej. usuario@correo.com o +54911..."
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <p className="text-xs text-zinc-500">
                Te enviaremos un enlace mágico al email o un código por SMS al
                teléfono indicado. Una vez completes el flujo, se iniciará tu
                sesión en Gymapp.
              </p>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Enviar enlace o código
              </button>
            </form>
          )
        ) : (
          <form action={signUpWithPassword} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="signup_email"
                className="block text-sm font-medium text-zinc-800"
              >
                Email
              </label>
              <input
                id="signup_email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="signup_password"
                className="block text-sm font-medium text-zinc-800"
              >
                Contraseña
              </label>
              <input
                id="signup_password"
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <p className="text-xs text-zinc-500">
              Usaremos tu email para crear tu cuenta en Gymapp. Dependiendo de
              la configuración de Supabase, puede que necesites confirmar tu
              correo antes de acceder.
            </p>

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Crear cuenta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
