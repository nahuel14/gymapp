import { createSupabaseServerClient } from "@/lib/supabase";
import TemplateListClient from "./TemplateListClient";

type TemplatePlan = {
  id: number;
  name: string;
  created_at: string;
  coach_id: string;
  session_count?: number;
  exercise_count?: number;
};

export default async function TemplatesPage() {
  const supabase = await createSupabaseServerClient();
  
  // Obtener el usuario autenticado
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">No autenticado</div>
      </div>
    );
  }

  // Fetch templates desde Supabase
  const { data: templates, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('coach_id', user.id)
    .eq('is_template', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error al cargar las plantillas</div>
      </div>
    );
  }

  // Calcular contadores de sesiones y ejercicios para cada plantilla
  const templatesWithCounts: TemplatePlan[] = await Promise.all(
    (templates || []).map(async (template: any) => {
      // Contar sesiones
      const { count: sessionCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', Number(template.id));

      // Obtener IDs de sesiones para contar ejercicios
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('plan_id', Number(template.id));

      const sessionIds = sessions?.map((s: any) => s.id) || [];

      // Contar ejercicios
      let exerciseCount = 0;
      if (sessionIds.length > 0) {
        const { count } = await supabase
          .from('session_exercises')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);
        exerciseCount = count || 0;
      }

      return {
        id: Number(template.id),
        name: template.name,
        created_at: template.created_at,
        coach_id: template.coach_id,
        session_count: sessionCount || 0,
        exercise_count: exerciseCount
      };
    })
  );

  return <TemplateListClient initialTemplates={templatesWithCounts} />;
}
