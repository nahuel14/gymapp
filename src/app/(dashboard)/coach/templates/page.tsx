import { createSupabaseServerClient } from "@/lib/supabase";
import TemplateListClient from "./TemplateListClient";

type TemplatePlan = {
  id: number;
  name: string;
  created_at: string;
  coach_id: string;
  week_count: number;
  days_per_week: number;
  owner_name?: string;
  owner_last_name?: string;
  owner_role?: string;
};

type AssignableUser = {
  id: string;
  name: string;
  last_name: string;
  role: string;
};

export default async function TemplatesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">No autenticado</div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'ADMIN';

  let templateQuery = supabase
    .from('training_plans')
    .select('*')
    .eq('is_template', true)
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    templateQuery = templateQuery.eq('coach_id', user.id);
  }

  const { data: templates, error } = await templateQuery;

  if (error) {
    console.error('Error fetching templates:', error);
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error al cargar las plantillas</div>
      </div>
    );
  }

  // Build owner map for ADMIN view
  const ownerMap: Record<string, { name: string; last_name: string; role: string }> = {};
  let assignableUsers: AssignableUser[] = [];

  if (isAdmin) {
    const ownerIds = [...new Set((templates ?? []).map((t: any) => t.coach_id).filter(Boolean))];

    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, name, last_name, role')
        .in('id', ownerIds as any);

      for (const owner of owners ?? []) {
        ownerMap[(owner as any).id] = {
          name: (owner as any).name ?? "",
          last_name: (owner as any).last_name ?? "",
          role: (owner as any).role ?? "",
        };
      }
    }

    const { data: assignable } = await supabase
      .from('profiles')
      .select('id, name, last_name, role')
      .in('role', ['COACH', 'ADMIN', 'SUPER_STUDENT'] as any)
      .order('name', { ascending: true });

    assignableUsers = (assignable ?? []).map((u: any) => ({
      id: u.id,
      name: u.name ?? "",
      last_name: u.last_name ?? "",
      role: u.role ?? "",
    }));
  }

  // Build templates with week/day stats and owner info
  const templatesWithCounts: TemplatePlan[] = await Promise.all(
    (templates || []).map(async (template: any) => {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('week_number')
        .eq('plan_id', Number(template.id));

      const totalSessions = sessions?.length ?? 0;
      const distinctWeeks = new Set((sessions ?? []).map((s: any) => s.week_number)).size;
      const weekCount = distinctWeeks || 0;
      const daysPerWeek = weekCount > 0 ? Math.round(totalSessions / weekCount) : 0;

      const owner = ownerMap[template.coach_id];

      return {
        id: Number(template.id),
        name: template.name,
        created_at: template.created_at,
        coach_id: template.coach_id,
        week_count: weekCount,
        days_per_week: daysPerWeek,
        owner_name: owner?.name,
        owner_last_name: owner?.last_name,
        owner_role: owner?.role,
      };
    })
  );

  return (
    <TemplateListClient
      initialTemplates={templatesWithCounts}
      isAdmin={isAdmin}
      currentUserId={user.id}
      assignableUsers={assignableUsers}
    />
  );
}
