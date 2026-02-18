import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

async function login(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/login?error=missing");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=missing");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (role === "COACH") {
    redirect("/coach");
  }

  if (role === "STUDENT") {
    redirect("/student");
  }

  redirect("/login?error=norole");
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const errorKey = searchParams?.error;

  let errorMessage = "";

  if (errorKey === "missing") {
    errorMessage = "Por favor ingresa email y contraseña.";
  } else if (errorKey === "invalid") {
    errorMessage = "Credenciales inválidas. Intenta nuevamente.";
  } else if (errorKey === "norole") {
    errorMessage = "No se encontró un rol asignado a este usuario.";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900">
          Gymapp
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          Inicia sesión para acceder a tu panel.
        </p>

        {errorMessage ? (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={login} className="space-y-4">
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
      </div>
    </div>
  );
}
