-- Migration para agregar soporte de plantillas
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna is_template a training_plans
ALTER TABLE training_plans 
ADD COLUMN is_template BOOLEAN DEFAULT false;

-- 2. Crear índice para mejor rendimiento
CREATE INDEX idx_training_plans_is_template ON training_plans(is_template);
CREATE INDEX idx_training_plans_coach_template ON training_plans(coach_id, is_template);

-- 3. Actualizar RLS policies para incluir plantillas
DROP POLICY IF EXISTS "Users can view their own training plans" ON training_plans;
DROP POLICY IF EXISTS "Coaches can manage their students' plans" ON training_plans;

-- Policy para ver planes (propios y plantillas)
CREATE POLICY "Users can view their own training plans and templates" ON training_plans
FOR SELECT USING (
  auth.uid() = student_id OR 
  (auth.uid() = coach_id AND is_template = true)
);

-- Policy para coaches (crear y gestionar plantillas y planes de estudiantes)
CREATE POLICY "Coaches can manage their plans and templates" ON training_plans
FOR ALL USING (
  auth.uid() = coach_id
);

-- 4. Opcional: Crear algunas plantillas de ejemplo
-- INSERT INTO training_plans (name, coach_id, is_template, is_active)
-- VALUES 
-- ('Hipertrofia Básica 3 días', 'coach-user-id', true, false),
-- ('Fuerza 4 días', 'coach-user-id', true, false);
