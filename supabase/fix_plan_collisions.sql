-- ARCHIVADO: la columna is_active fue eliminada de training_plans.
-- Este script es solo referencia histórica y ya no puede ejecutarse.
-- =============================================================================
-- SCRIPT: Auditoría y regularización de planes solapados
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================================

-- =============================================================================
-- SCRIPT 1 — DIAGNÓSTICO: Detectar planes que se superponen por alumno
-- Muestra todos los pares de planes (activos e inactivos) cuyas fechas se cruzan
-- para el mismo student_id. Correr primero para evaluar el estado de los datos.
-- =============================================================================

SELECT
  p.email                                        AS alumno_email,
  CONCAT(p.name, ' ', p.last_name)               AS alumno_nombre,
  a.id                                           AS plan_a_id,
  a.name                                         AS plan_a_nombre,
  a.start_date                                   AS plan_a_inicio,
  a.end_date                                     AS plan_a_fin,
  a.is_active                                    AS plan_a_activo,
  b.id                                           AS plan_b_id,
  b.name                                         AS plan_b_nombre,
  b.start_date                                   AS plan_b_inicio,
  b.end_date                                     AS plan_b_fin,
  b.is_active                                    AS plan_b_activo,
  -- Rango de solapamiento real
  GREATEST(a.start_date, b.start_date)           AS solapamiento_desde,
  LEAST(a.end_date, b.end_date)                  AS solapamiento_hasta
FROM training_plans a
JOIN training_plans b ON (
  a.student_id  = b.student_id
  AND a.id      < b.id           -- evitar duplicados (A,B) y (B,A)
  AND a.is_template = false
  AND b.is_template = false
  AND a.start_date IS NOT NULL
  AND b.start_date IS NOT NULL
  AND a.end_date   IS NOT NULL
  AND b.end_date   IS NOT NULL
  -- Condición estándar de solapamiento de intervalos
  AND a.start_date <= b.end_date
  AND a.end_date   >= b.start_date
)
JOIN profiles p ON p.id = a.student_id
ORDER BY p.email, a.start_date;


-- =============================================================================
-- SCRIPT 2 — DIAGNÓSTICO: Planes sin end_date (no cubiertos por la validación)
-- Estos planes deben regularizarse manualmente antes de que el sistema
-- de bloqueo de colisiones pueda detectarlos.
-- =============================================================================

SELECT
  p.email                           AS alumno_email,
  CONCAT(p.name, ' ', p.last_name) AS alumno_nombre,
  tp.id                             AS plan_id,
  tp.name                           AS plan_nombre,
  tp.start_date                     AS inicio,
  tp.is_active                      AS activo,
  tp.created_at
FROM training_plans tp
JOIN profiles p ON p.id = tp.student_id
WHERE tp.is_template = false
  AND tp.end_date IS NULL
ORDER BY p.email, tp.created_at;


-- =============================================================================
-- SCRIPT 3 — CORRECCIÓN OPCIONAL: Desactivar planes solapados más antiguos
--
-- ESTRATEGIA: Por cada alumno con colisiones, conservar como activo el plan
-- más reciente (ordenado por created_at DESC + is_active primero) y desactivar
-- todos los demás que tengan solapamiento.
--
-- ⚠️  EJECUTAR PRIMERO EL SCRIPT 1 PARA REVISAR QUÉ SE VE AFECTADO.
-- ⚠️  HACER UN BACKUP O SNAPSHOT ANTES DE CORRER ESTE UPDATE.
-- =============================================================================

-- PASO A — Vista previa: muestra qué planes quedarían desactivados (sin modificar nada)
WITH estudiantes_con_conflicto AS (
  SELECT DISTINCT a.student_id
  FROM training_plans a
  JOIN training_plans b ON (
    a.student_id  = b.student_id
    AND a.id      < b.id
    AND a.is_template = false
    AND b.is_template = false
    AND a.end_date IS NOT NULL
    AND b.end_date IS NOT NULL
    AND a.start_date <= b.end_date
    AND a.end_date   >= b.start_date
  )
),
planes_rankeados AS (
  SELECT
    tp.id,
    tp.name,
    tp.student_id,
    tp.start_date,
    tp.end_date,
    tp.is_active,
    tp.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY tp.student_id
      ORDER BY
        CASE WHEN tp.is_active THEN 0 ELSE 1 END,  -- activos primero
        tp.created_at DESC                           -- luego el más reciente
    ) AS rn
  FROM training_plans tp
  WHERE tp.is_template = false
    AND tp.student_id IN (SELECT student_id FROM estudiantes_con_conflicto)
)
SELECT
  pr.id          AS plan_id,
  pr.name        AS plan_nombre,
  pr.start_date  AS inicio,
  pr.end_date    AS fin,
  pr.is_active   AS activo_ahora,
  pr.rn,
  CASE WHEN pr.rn = 1 THEN 'CONSERVAR (más reciente)' ELSE 'DESACTIVAR' END AS accion
FROM planes_rankeados pr
ORDER BY pr.student_id, pr.rn;


-- PASO B — Ejecución real: desactiva los planes más antiguos con solapamiento
-- ⚠️  DESCOMENTAR SOLO DESPUÉS DE REVISAR EL PASO A

/*
WITH estudiantes_con_conflicto AS (
  SELECT DISTINCT a.student_id
  FROM training_plans a
  JOIN training_plans b ON (
    a.student_id  = b.student_id
    AND a.id      < b.id
    AND a.is_template = false
    AND b.is_template = false
    AND a.end_date IS NOT NULL
    AND b.end_date IS NOT NULL
    AND a.start_date <= b.end_date
    AND a.end_date   >= b.start_date
  )
),
planes_rankeados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id
      ORDER BY
        CASE WHEN is_active THEN 0 ELSE 1 END,
        created_at DESC
    ) AS rn
  FROM training_plans
  WHERE is_template = false
    AND student_id IN (SELECT student_id FROM estudiantes_con_conflicto)
)
UPDATE training_plans
SET is_active = false
WHERE id IN (
  SELECT id FROM planes_rankeados WHERE rn > 1
);
*/
