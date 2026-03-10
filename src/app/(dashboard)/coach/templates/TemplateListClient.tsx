"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutTemplate, Calendar, Dumbbell, Edit, Eye, Trash2, LayoutGrid, List } from "lucide-react";
import { createTemplatePlan, duplicatePlan, deleteTemplatePlan } from "@/app/(dashboard)/coach/student/actions";

type TemplatePlan = {
  id: number;
  name: string;
  created_at: string;
  coach_id: string;
  session_count?: number;
  exercise_count?: number;
};

interface TemplateListClientProps {
  initialTemplates: TemplatePlan[];
}

export default function TemplateListClient({ initialTemplates }: TemplateListClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localTemplates, setLocalTemplates] = useState<TemplatePlan[]>(initialTemplates);

  // Sincronizar templates del servidor con estado local
  useEffect(() => {
    if (initialTemplates) {
      setLocalTemplates(initialTemplates);
    }
  }, [initialTemplates]);

  useEffect(() => {
    // Obtener el rol del usuario
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/user");
        const { user } = await response.json();
        if (user?.role) {
          setUserRole(user.role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, []);

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch("/api/user");
      const { user } = await response.json();
      
      if (!user) {
        router.push("/login");
        return;
      }

      const result = await createTemplatePlan("Nueva Plantilla", user.id);
      if (result.success) {
        router.push(`/coach/templates/${result.templateId}/edit`);
      }
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const handleDuplicateTemplate = async (templateId: number) => {
    try {
      await duplicatePlan(templateId);
      router.refresh();
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (error) {
      console.error("Error duplicating template:", error);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("¿Estás seguro de eliminar esta plantilla? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      // Actualizar estado local inmediatamente para eliminar la tarjeta (optimistic update)
      setLocalTemplates(prev => prev.filter(t => t.id !== templateId));
      
      // Intentar eliminar en el servidor
      await deleteTemplatePlan(templateId);
      
      // Invalidar caché de Next.js
      router.refresh();
      // Invalidar caché de React Query
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      
      // Si falla, revertir el cambio optimista
      setLocalTemplates(initialTemplates);
      
      // Mostrar mensaje de error más específico
      if (error?.code === 'PGRST116') {
        alert("La plantilla ya fue eliminada");
      } else {
        alert("Error al eliminar la plantilla");
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-yellow-400/10 flex items-center justify-center">
              <LayoutTemplate className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-zinc-100 uppercase tracking-tighter">
                Librería de Plantillas
              </h1>
              <p className="text-zinc-500 text-sm font-medium">
                Crea y gestiona tus planes de entrenamiento maestros
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Toggle Vista Grilla/Lista */}
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-yellow-400 text-black'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista en grilla"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-yellow-400 text-black'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista en lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleCreateTemplate}
              className="flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black text-black transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nueva Plantilla
            </button>
          </div>
        </div>

        {/* Templates Grid/List */}
        {localTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 rounded-[2rem] border-2 border-dashed border-zinc-800 bg-zinc-950/50">
            <LayoutTemplate className="h-16 w-16 text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-zinc-300 mb-2">No hay plantillas aún</h3>
            <p className="text-zinc-500 text-center max-w-md mb-6">
              Crea tu primera plantilla para empezar a diseñar programas de entrenamiento reutilizables
            </p>
            <button
              onClick={handleCreateTemplate}
              className="flex items-center gap-2 rounded-xl border-2 border-zinc-700 px-6 py-3 text-sm font-black text-zinc-300 transition-all hover:border-yellow-400 hover:text-yellow-400"
            >
              <Plus className="h-4 w-4" />
              Crear Primera Plantilla
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "flex flex-col gap-4"
          }>
            {localTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onDuplicate={() => handleDuplicateTemplate(template.id)}
                onEdit={() => router.push(`/coach/templates/${template.id}/edit`)}
                onPreview={() => router.push(`/coach/templates/${template.id}`)}
                onDelete={() => handleDeleteTemplate(template.id)}
                userRole={userRole}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ 
  template, 
  onDuplicate, 
  onEdit, 
  onPreview,
  onDelete,
  userRole,
  viewMode
}: { 
  template: TemplatePlan;
  onDuplicate: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
  userRole: string | null;
  viewMode: 'grid' | 'list';
}) {
  const canEdit = userRole === "COACH" || userRole === "ADMIN";

  if (viewMode === 'list') {
    return (
      <div className="group relative bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-4 transition-all hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/5">
        <div className="flex items-center gap-6">
          {/* Info Section */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-zinc-100 mb-1">
              {template.name}
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Creada: {new Date(template.created_at).toLocaleDateString('es-AR')}
            </p>
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">{template.session_count || 0} sesiones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Dumbbell className="h-4 w-4" />
                <span className="text-xs font-medium">{template.exercise_count || 0} ejercicios</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onPreview}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-300 transition-all hover:bg-zinc-700 hover:border-zinc-600"
            >
              <Eye className="h-3.5 w-3.5" />
              Vista
            </button>
            
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-300 transition-all hover:bg-zinc-700 hover:border-zinc-600"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            
            {canEdit && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-black text-red-400 transition-all hover:bg-red-500/20 hover:border-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-6 transition-all hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/5">
      
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-zinc-100 mb-1 line-clamp-2">
          {template.name}
        </h3>
        <p className="text-xs text-zinc-500">
          Creada: {new Date(template.created_at).toLocaleDateString('es-AR')}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6 text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span className="text-xs font-medium">{template.session_count || 0} sesiones</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dumbbell className="h-4 w-4" />
          <span className="text-xs font-medium">{template.exercise_count || 0} ejercicios</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 transition-all hover:bg-zinc-700 hover:border-zinc-600"
        >
          <Eye className="h-3.5 w-3.5" />
          Vista
        </button>
        
        {canEdit && (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 transition-all hover:bg-zinc-700 hover:border-zinc-600"
          >
            <Edit className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
        
        {canEdit && (
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs font-black text-red-400 transition-all hover:bg-red-500/20 hover:border-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
