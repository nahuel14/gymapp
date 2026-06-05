import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { BODY_ZONE_LABELS } from "@/lib/constants";
import type { Database, Tables, TablesInsert } from "@/types/supabase";
import { ExerciseListClient } from "./ExerciseListClient";

type LibraryPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

type BodyZone = Database["public"]["Enums"]["body_zone"];
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
  const bodyZoneValue = formData.get("body_zone");
  const videoUrlValue = formData.get("video_url");

  if (typeof nameValue !== "string" || nameValue.trim().length === 0) {
    redirect("/coach/library?error=missingName");
  }

  const bodyZone =
    typeof bodyZoneValue === "string" &&
    bodyZoneValue in BODY_ZONE_LABELS
      ? (bodyZoneValue as BodyZone)
      : null;

  const videoUrl =
    typeof videoUrlValue === "string" &&
    videoUrlValue.trim().length > 0
      ? videoUrlValue
      : null;

  const insert: TablesInsert<"exercises"> = {
    name: nameValue.trim(),
    body_zone: bodyZone,
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
    .select("id, name, body_zone, created_at")
    .order("created_at", { ascending: false })) as ExercisesResponse;

  return response.data ?? [];
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const exercises = await getExercises();

  return (
    <ExerciseListClient
      initialExercises={exercises}
      createAction={createExercise}
      errorKey={params.error}
    />
  );
}
