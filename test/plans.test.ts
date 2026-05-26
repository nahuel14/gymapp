import { describe, it, expect } from 'vitest';

// UTILERÍA: Simula la lógica exacta de corrimiento de fecha que definimos para el Escenario 1
function calculatePlanDates(startDate: string, durationWeeks: number) {
  // 1. Forzar que el inicio sea el LUNES de la semana elegida
  const chosenStart = new Date(startDate + "T00:00:00");
  const startDay = chosenStart.getDay();
  const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
  chosenStart.setDate(chosenStart.getDate() + diffToMonday);
  const startDateStr = chosenStart.toISOString().split("T")[0];

  // 2. Calcular el fin exacto sumando las semanas (cae domingo automáticamente)
  const exactEnd = new Date(chosenStart);
  exactEnd.setDate(chosenStart.getDate() + Math.max(durationWeeks, 1) * 7 - 1);
  const endDateStr = exactEnd.toISOString().split("T")[0];

  // 3. Simular el cálculo automático de day_name en base a una fecha dada
  const getDayNameInEnglish = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return {
    start_date: startDateStr,
    end_date: endDateStr,
    generated_day_name: getDayNameInEnglish(startDateStr) // Probamos con el mismo día de inicio
  };
}

// UTILERÍA: Simula las reglas de negocio de movimiento de sesión del Escenario 4
function simulateMoveSession(currentSessions: { date: string }[], newDate: string) {
  // Guardrail: Validar colisión de entrenamientos
  const hasCollision = currentSessions.some(s => s.date === newDate);
  if (hasCollision) {
    throw new Error("Ya existe un entrenamiento en esta fecha. Selecciona un día libre.");
  }

  // Si pasa la validación, calcula el nuevo day_name
  const d = new Date(newDate + "T00:00:00");
  const dayNameStr = d.toLocaleDateString('en-US', { weekday: 'long' });

  return {
    success: true,
    new_date: newDate,
    new_day_name: dayNameStr
  };
}

// --- BLOQUE DE PRUEBAS UNITARIAS ---

describe('⚙️ ESCENARIO 1: Creación de Plan con Normalización Semanal Strict', () => {
  it('Debe forzar el start_date al lunes de esa semana y el end_date al domingo de la última semana', () => {
    // Caso de prueba: El coach elige un Jueves como inicio
    const inputStartDate = '2026-05-21'; // Jueves
    const durationWeeks = 4;

    const result = calculatePlanDates(inputStartDate, durationWeeks);

    // Verificaciones (Asserts)
    expect(result.start_date).toBe('2026-05-18'); // El lunes previo al jueves 21
    expect(result.end_date).toBe('2026-06-14');   // El domingo donde terminan las 4 semanas exactas
  });

  it('Debe guardar el campo day_name estrictamente en inglés standar', () => {
    const inputStartDate = '2026-05-18'; // Es un Lunes
    const result = calculatePlanDates(inputStartDate, 4);

    expect(result.generated_day_name).toBe('Monday'); // Validamos consistencia idiomática
    expect(result.generated_day_name).not.toBe('Lunes');
    expect(result.generated_day_name).not.toBe('Día 1');
  });
});

describe('⚙️ ESCENARIO 4: Movimiento de Sesiones y Guardrails de Colisión', () => {
  it('Debe permitir mover la sesión a un día libre y recalcular el day_name correctamente', () => {
    // Simulamos las sesiones que ya tiene agendadas el alumno en la semana
    const mockStudentSessions = [
      { date: '2026-05-18' }, // Monday
      { date: '2026-05-20' }, // Wednesday
    ];
    
    // Intentamos mover una sesión al Jueves 21 (que está libre)
    const targetDate = '2026-05-21'; 

    const result = simulateMoveSession(mockStudentSessions, targetDate);

    expect(result.success).toBe(true);
    expect(result.new_date).toBe('2026-05-21');
    expect(result.new_day_name).toBe('Thursday'); // Se recalcula dinámicamente en base al date
  });

  it('Debe lanzar un error y bloquear la operación si se intenta mover a un día ya ocupado', () => {
    const mockStudentSessions = [
      { date: '2026-05-18' }, // Monday
      { date: '2026-05-22' }, // Friday (Ocupado)
    ];
    
    const targetDate = '2026-05-22'; // Intentamos colisionar el viernes

    // Verificamos que la función lance exactamente el error de la regla de negocio
    expect(() => simulateMoveSession(mockStudentSessions, targetDate)).toThrow(
      "Ya existe un entrenamiento en esta fecha. Selecciona un día libre."
    );
  });
});