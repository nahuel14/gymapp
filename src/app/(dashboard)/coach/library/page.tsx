import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  BODY_ZONE_LABELS,
  EXERCISE_CATEGORY_LABELS,
} from "@/lib/constants";
import type { Database, Tables, TablesInsert } from "@/types/supabase";
import { ExerciseListClient } from "./ExerciseListClient";

type LibraryPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

type BodyZone = Database["public"]["Enums"]["body_zone"];
type ExerciseCategory = Database["public"]["Enums"]["exercise_category"];
type Exercise = Tables<"exercises">;
type ExercisesResponse = {
  data: Exercise[] | null;
};

async function ensureCoach() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name, last_name")
    .eq("id", user.id as never)
    .single();

  const coachProfile =
    profile as
      | {
          role: Database["public"]["Enums"]["user_role"] | null;
          name: string | null;
          last_name: string | null;
        }
      | null;

  if (!coachProfile || (coachProfile.role !== "COACH" && coachProfile.role !== "ADMIN")) {
    redirect("/auth?view=login");
  }

  return { supabase, coach: coachProfile };
}

async function createExercise(formData: FormData) {
  "use server";

  const { supabase } = await ensureCoach();

  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const bodyZoneValue = formData.get("body_zone");
  const categoryValue = formData.get("category");
  const videoUrlValue = formData.get("video_url");

  if (typeof nameValue !== "string" || nameValue.trim().length === 0) {
    redirect("/coach/library?error=missingName");
  }

  const bodyZone =
    typeof bodyZoneValue === "string" &&
    bodyZoneValue in BODY_ZONE_LABELS
      ? (bodyZoneValue as BodyZone)
      : null;

  const category =
    typeof categoryValue === "string" &&
    categoryValue in EXERCISE_CATEGORY_LABELS
      ? (categoryValue as ExerciseCategory)
      : null;

  const description =
    typeof descriptionValue === "string" &&
    descriptionValue.trim().length > 0
      ? descriptionValue
      : null;

  const videoUrl =
    typeof videoUrlValue === "string" &&
    videoUrlValue.trim().length > 0
      ? videoUrlValue
      : null;

  const insert: TablesInsert<"exercises"> = {
    name: nameValue.trim(),
    description,
    body_zone: bodyZone,
    category,
    video_url: videoUrl,
  };

  const { error } = await supabase.from("exercises").insert(insert as never);

  if (error) {
    redirect("/coach/library?error=save");
  }

  revalidatePath("/coach/library");
  redirect("/coach/library");
}

async function getExercises(): Promise<Exercise[]> {
  const { supabase } = await ensureCoach();

  const response = (await supabase
    .from("exercises")
    .select("id, name, body_zone, category, created_at")
    .order("created_at", { ascending: false })) as ExercisesResponse;

  const data = response.data ?? [];

  return data;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const exercises = await getExercises();

  const errorKey = params.error;

  let errorMessage = "";

  if (errorKey === "missingName") {
    errorMessage = "El nombre del ejercicio es obligatorio.";
  } else if (errorKey === "save") {
    errorMessage = "Ocurrió un error al guardar el ejercicio.";
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Librería de ejercicios
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea y gestiona los ejercicios disponibles para tus planes.
        </p>
      </header>

      <section className="rounded-lg bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Nuevo ejercicio
        </h2>

        {errorMessage ? (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={createExercise} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label
              htmlFor="name"
              className="block text-xs font-medium text-foreground"
            >
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label
              htmlFor="description"
              className="block text-xs font-medium text-foreground"
            >
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="body_zone"
              className="block text-xs font-medium text-foreground"
            >
              Zona del cuerpo
            </label>
            <select
              id="body_zone"
              name="body_zone"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Sin especificar</option>
              {Object.entries(BODY_ZONE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="category"
              className="block text-xs font-medium text-foreground"
            >
              Categoría
            </label>
            <select
              id="category"
              name="category"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Sin especificar</option>
              {Object.entries(EXERCISE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label
              htmlFor="video_url"
              className="block text-xs font-medium text-foreground"
            >
              URL de video (opcional)
            </label>
            <input
              id="video_url"
              name="video_url"
              type="url"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Guardar ejercicio
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Ejercicios creados
        </h2>

        <ExerciseListClient initialExercises={exercises} />
      </section>
    </div>
  );
}
