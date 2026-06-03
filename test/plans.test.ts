import { describe, it, expect } from 'vitest';

// ════════════════════════════════════════════════════════════════
// Módulo: Planes de Alumno
// Creación, edición de fechas, extensión, colisiones entre planes
// ════════════════════════════════════════════════════════════════

function calculatePlanDates(startDate: string, durationWeeks: number) {
  const chosenStart = new Date(startDate + "T00:00:00");
  const startDay = chosenStart.getDay();
  const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
  chosenStart.setDate(chosenStart.getDate() + diffToMonday);
  const startDateStr = chosenStart.toISOString().split("T")[0];

  const exactEnd = new Date(chosenStart);
  exactEnd.setDate(chosenStart.getDate() + Math.max(durationWeeks, 1) * 7 - 1);
  const endDateStr = exactEnd.toISOString().split("T")[0];

  const getDayNameInEnglish = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return {
    start_date: startDateStr,
    end_date: endDateStr,
    generated_day_name: getDayNameInEnglish(startDateStr),
  };
}

function calculateExtendedEnd(currentEndDate: string, additionalWeeks: number) {
  if (additionalWeeks < 1) throw new Error("Debe agregar al menos 1 semana");
  const d = new Date(currentEndDate + "T00:00:00");
  d.setDate(d.getDate() + additionalWeeks * 7);
  const dow = d.getDay();
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow));
  return d.toISOString().split("T")[0];
}

function simulateExtendCollision(
  otherPlans: Array<{ name: string; start_date: string }>,
  currentEndDate: string,
  newEndDate: string
) {
  const conflict = otherPlans.find(
    p => p.start_date > currentEndDate && p.start_date <= newEndDate
  );
  if (conflict) {
    throw new Error('No se puede extender: el plan "' + conflict.name + '" comienza el ' + conflict.start_date + '.');
  }
  return { success: true, newEndDate };
}

function checkPlanShiftCollision(
  otherPlans: Array<{ name: string; start_date: string; end_date: string }>,
  newStart: string,
  newEnd: string
): { hasCollision: boolean; conflictPlan?: string } {
  const conflict = otherPlans.find(p => p.start_date <= newEnd && p.end_date >= newStart);
  return conflict ? { hasCollision: true, conflictPlan: conflict.name } : { hasCollision: false };
}

function hasShiftedSessionOutside(
  sessions: { date: string }[],
  offsetDays: number,
  newEndDate: string
): boolean {
  return sessions.some(s => {
    const d = new Date(s.date + "T00:00:00");
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}` > newEndDate;
  });
}

function shiftSessionDates(sessions: { id: number; date: string | null }[], offsetDays: number) {
  return sessions.map(s => {
    if (!s.date) return s;
    const d = new Date(s.date + "T00:00:00");
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { ...s, date: `${y}-${m}-${day}` };
  });
}

function computeEndDateBlocked(planHasSessions: boolean, newEndDate: string, currentEndDate: string): boolean {
  if (!planHasSessions) return false;
  return newEndDate < currentEndDate;
}

function calcEndDateLocal(mondayStr: string, weeks: number): string {
  const start = new Date(mondayStr + "T00:00:00");
  start.setDate(start.getDate() + Math.max(weeks, 1) * 7 - 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftWeekLocal(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe('Estudiantes', () => {

describe('Planes de Alumno', () => {
  describe('ESCENARIO 1: Creacion de Plan', () => {
    it('fuerza start_date al lunes y end_date al domingo de la ultima semana', () => {
      const result = calculatePlanDates('2026-05-21', 4);
      expect(result.start_date).toBe('2026-05-18');
      expect(result.end_date).toBe('2026-06-14');
    });

    it('day_name se guarda en ingles', () => {
      const result = calculatePlanDates('2026-05-18', 4);
      expect(result.generated_day_name).toBe('Monday');
      expect(result.generated_day_name).not.toBe('Lunes');
    });
  });

  describe('ESCENARIO 2: Extension de Plan Activo', () => {
    it('el nuevo end_date siempre cae en domingo', () => {
      const result = calculateExtendedEnd('2026-06-14', 1);
      const dow = new Date(result + "T00:00:00").getDay();
      expect(dow).toBe(0);
    });

    it('extender 1 semana suma exactamente 7 dias', () => {
      expect(calculateExtendedEnd('2026-06-14', 1)).toBe('2026-06-21');
    });

    it('extender 3 semanas suma exactamente 21 dias', () => {
      expect(calculateExtendedEnd('2026-06-14', 3)).toBe('2026-07-05');
    });

    it('lanza error si additionalWeeks es 0', () => {
      expect(() => calculateExtendedEnd('2026-06-14', 0)).toThrow("Debe agregar al menos 1 semana");
    });

    it('detecta colision cuando otro plan empieza dentro del rango extendido', () => {
      const others = [{ name: "Potencia Julio", start_date: "2026-06-22" }];
      const newEnd = calculateExtendedEnd("2026-06-14", 2);
      expect(() => simulateExtendCollision(others, "2026-06-14", newEnd)).toThrow(
        'No se puede extender: el plan "Potencia Julio" comienza el 2026-06-22.'
      );
    });

    it('permite la extension si el otro plan empieza despues del nuevo fin', () => {
      const others = [{ name: "Potencia Julio", start_date: "2026-06-29" }];
      const newEnd = calculateExtendedEnd("2026-06-14", 2);
      expect(simulateExtendCollision(others, "2026-06-14", newEnd).success).toBe(true);
    });
  });

  describe('ESCENARIO 5: Edicion de Plan - Calculo de Offset al Cambiar Fecha de Inicio', () => {
    it('calcula offset de -7 cuando se mueve la fecha 1 semana atras', () => {
      const currentStart = '2026-06-01';
      const newStart = '2026-05-25';
      const offsetDays = Math.round(
        (new Date(newStart + "T00:00:00").getTime() - new Date(currentStart + "T00:00:00").getTime())
        / (1000 * 60 * 60 * 24)
      );
      expect(offsetDays).toBe(-7);
    });

    it('calcula offset de +14 cuando se mueve la fecha 2 semanas adelante', () => {
      const currentStart = '2026-06-01';
      const newStart = '2026-06-15';
      const offsetDays = Math.round(
        (new Date(newStart + "T00:00:00").getTime() - new Date(currentStart + "T00:00:00").getTime())
        / (1000 * 60 * 60 * 24)
      );
      expect(offsetDays).toBe(14);
    });

    it('calcula offset de 0 cuando la fecha no cambia', () => {
      const currentStart = '2026-06-01';
      const newStart = '2026-06-01';
      const offsetDays = Math.round(
        (new Date(newStart + "T00:00:00").getTime() - new Date(currentStart + "T00:00:00").getTime())
        / (1000 * 60 * 60 * 24)
      );
      expect(offsetDays).toBe(0);
    });

    it('las sesiones se desplazan con el mismo offset que el inicio del plan', () => {
      const sessions = [{ id: 1, date: '2026-06-01' }, { id: 2, date: '2026-06-08' }];
      const shifted = shiftSessionDates(sessions, -7);
      expect(shifted[0].date).toBe('2026-05-25');
      expect(shifted[1].date).toBe('2026-06-01');
    });
  });

  describe('ESCENARIO 6: Edicion de Plan - Restriccion Lunes/Domingo', () => {
    it('calcEndDateLocal siempre retorna un domingo', () => {
      expect(new Date(calcEndDateLocal('2026-06-01', 4) + "T00:00:00").getDay()).toBe(0);
    });

    it('calcEndDateLocal: 4 semanas desde Lun 01/06 termina el Dom 28/06', () => {
      expect(calcEndDateLocal('2026-06-01', 4)).toBe('2026-06-28');
    });

    it('calcEndDateLocal: 1 semana desde Lun 01/06 termina el Dom 07/06', () => {
      expect(calcEndDateLocal('2026-06-01', 1)).toBe('2026-06-07');
    });

    it('calcEndDateLocal: 8 semanas termina en domingo', () => {
      const result = calcEndDateLocal('2026-06-01', 8);
      expect(new Date(result + "T00:00:00").getDay()).toBe(0);
    });

    it('shiftWeekLocal mantiene el lunes al navegar hacia adelante', () => {
      const result = shiftWeekLocal('2026-06-01', 1);
      expect(result).toBe('2026-06-08');
      expect(new Date(result + "T00:00:00").getDay()).toBe(1);
    });

    it('shiftWeekLocal mantiene el lunes al navegar hacia atras', () => {
      const result = shiftWeekLocal('2026-06-01', -1);
      expect(result).toBe('2026-05-25');
      expect(new Date(result + "T00:00:00").getDay()).toBe(1);
    });

    it('navegar 5 semanas hacia adelante siempre cae en lunes', () => {
      let date = '2026-06-01';
      for (let i = 0; i < 5; i++) { date = shiftWeekLocal(date, 1); }
      expect(new Date(date + "T00:00:00").getDay()).toBe(1);
    });

    it('navegar 3 semanas hacia atras siempre cae en lunes', () => {
      let date = '2026-06-01';
      for (let i = 0; i < 3; i++) { date = shiftWeekLocal(date, -1); }
      expect(new Date(date + "T00:00:00").getDay()).toBe(1);
    });
  });

  describe('ESCENARIO 7: Reduccion de Duracion del Plan con Sesiones', () => {
    it('bloquea cuando el plan tiene sesiones y el nuevo fin es anterior al actual', () => {
      expect(computeEndDateBlocked(true, '2026-06-07', '2026-06-14')).toBe(true);
    });

    it('no bloquea cuando el plan no tiene sesiones aunque se reduzca la duracion', () => {
      expect(computeEndDateBlocked(false, '2026-06-07', '2026-06-14')).toBe(false);
    });

    it('no bloquea cuando el nuevo fin es igual al actual', () => {
      expect(computeEndDateBlocked(true, '2026-06-14', '2026-06-14')).toBe(false);
    });

    it('no bloquea cuando el nuevo fin es posterior al actual (expansion)', () => {
      expect(computeEndDateBlocked(true, '2026-06-21', '2026-06-14')).toBe(false);
    });

    it('detecta que sesion del 13/06 queda fuera si el nuevo fin es el 07/06', () => {
      const newEnd = '2026-06-07';
      const sessionsOutside = [{ date: '2026-06-13' }].filter(s => s.date > newEnd);
      expect(sessionsOutside.length).toBeGreaterThan(0);
    });

    it('no detecta sesiones fuera si todas estan dentro del nuevo rango', () => {
      const newEnd = '2026-06-14';
      const sessionsOutside = [{ date: '2026-06-01' }, { date: '2026-06-03' }].filter(s => s.date > newEnd);
      expect(sessionsOutside.length).toBe(0);
    });
  });

  describe('ESCENARIO 8: Shift de Sesiones al Cambiar Fecha de Inicio', () => {
    it('desplaza sesiones 7 dias hacia atras al mover inicio una semana atras', () => {
      const sessions = [
        { id: 1, date: '2026-06-13' },
        { id: 2, date: '2026-06-03' },
      ];
      const result = shiftSessionDates(sessions, -7);
      expect(result[0].date).toBe('2026-06-06');
      expect(result[1].date).toBe('2026-05-27');
    });

    it('desplaza sesiones 7 dias hacia adelante al mover inicio una semana adelante', () => {
      const sessions = [{ id: 1, date: '2026-06-01' }, { id: 2, date: '2026-06-05' }];
      const result = shiftSessionDates(sessions, 7);
      expect(result[0].date).toBe('2026-06-08');
      expect(result[1].date).toBe('2026-06-12');
    });

    it('sesiones con date null no se modifican', () => {
      const sessions = [{ id: 1, date: null }, { id: 2, date: '2026-06-01' }];
      const result = shiftSessionDates(sessions, -7);
      expect(result[0].date).toBeNull();
      expect(result[1].date).toBe('2026-05-25');
    });

    it('el dia relativo dentro de la semana se preserva al hacer shift', () => {
      const sessions = [{ id: 1, date: '2026-06-13' }];
      const result = shiftSessionDates(sessions, -7);
      expect(new Date(result[0].date! + "T00:00:00").getDay()).toBe(6);
    });

    it('shift de 14 dias desplaza dos semanas correctamente', () => {
      const sessions = [{ id: 1, date: '2026-06-01' }];
      expect(shiftSessionDates(sessions, 14)[0].date).toBe('2026-06-15');
      expect(shiftSessionDates(sessions, -14)[0].date).toBe('2026-05-18');
    });
  });

  describe('ESCENARIO 9: Colision al Desplazar Fecha de Inicio del Plan', () => {
    it('bloquea desplazamiento para atras cuando otro plan ocupa el nuevo rango', () => {
      const otherPlans = [{ name: "Plan Fuerza", start_date: "2026-05-18", end_date: "2026-05-31" }];
      const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
      expect(result.hasCollision).toBe(true);
      expect(result.conflictPlan).toBe("Plan Fuerza");
    });

    it('permite desplazamiento para atras cuando el rango nuevo esta libre', () => {
      const otherPlans = [{ name: "Plan Fuerza", start_date: "2026-05-01", end_date: "2026-05-18" }];
      const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
      expect(result.hasCollision).toBe(false);
    });

    it('bloquea desplazamiento para adelante cuando otro plan ocupa el nuevo rango', () => {
      const otherPlans = [{ name: "Plan Potencia", start_date: "2026-06-16", end_date: "2026-06-30" }];
      const result = checkPlanShiftCollision(otherPlans, "2026-06-08", "2026-06-21");
      expect(result.hasCollision).toBe(true);
      expect(result.conflictPlan).toBe("Plan Potencia");
    });

    it('permite desplazamiento para adelante cuando el rango nuevo esta libre', () => {
      const otherPlans = [{ name: "Plan Potencia", start_date: "2026-06-22", end_date: "2026-06-30" }];
      const result = checkPlanShiftCollision(otherPlans, "2026-06-08", "2026-06-21");
      expect(result.hasCollision).toBe(false);
    });

    it('todos los planes (no solo activos) bloquean el desplazamiento', () => {
      const otherPlans = [{ name: "Plan Anterior", start_date: "2026-05-18", end_date: "2026-05-31" }];
      const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
      expect(result.hasCollision).toBe(true);
    });

    it('detecta sesion que queda fuera del rango tras el desplazamiento', () => {
      const sessions = [{ date: '2026-06-14' }];
      expect(hasShiftedSessionOutside(sessions, -7, '2026-06-06')).toBe(true);
    });

    it('no detecta sesion fuera cuando todas quedan dentro tras el desplazamiento', () => {
      const sessions = [{ date: '2026-06-01' }, { date: '2026-06-08' }];
      expect(hasShiftedSessionOutside(sessions, -7, '2026-06-14')).toBe(false);
    });
  });

});

// ════════════════════════════════════════════════════════════════
// Módulo: Sesiones del Plan
// Distribución de sesiones al importar, duplicar, reagendar,
// eliminar y agregar días dentro de un plan
// ════════════════════════════════════════════════════════════════

function distributeTemplateSessions(startMonday: string, selectedDays: number[], totalWeeks: number) {
  const sorted = [...selectedDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  const sessions: Array<{ week: number; date: string; dayName: string }> = [];
  const monday = new Date(startMonday + "T00:00:00");

  for (let week = 1; week <= totalWeeks; week++) {
    const weekMonday = new Date(monday);
    weekMonday.setDate(monday.getDate() + (week - 1) * 7);
    for (const dayOfWeek of sorted) {
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const sessionDate = new Date(weekMonday);
      sessionDate.setDate(weekMonday.getDate() + offset);
      sessions.push({
        week,
        date: sessionDate.toISOString().split("T")[0],
        dayName: sessionDate.toLocaleDateString('en-US', { weekday: 'long' }),
      });
    }
  }
  return sessions;
}

function simulateMoveSession(currentSessions: { date: string }[], newDate: string) {
  const hasCollision = currentSessions.some(s => s.date === newDate);
  if (hasCollision) {
    throw new Error("Ya existe un entrenamiento en esta fecha. Selecciona un dia libre.");
  }
  const d = new Date(newDate + "T00:00:00");
  return {
    success: true,
    new_date: newDate,
    new_day_name: d.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

function simulateDuplicateSession(
  existingSessions: { date: string }[],
  targetDate: string,
  planRange: { start_date: string; end_date: string }
): { success: boolean; date: string } {
  if (!targetDate) throw new Error("Seleccioná una fecha destino.");
  if (targetDate < planRange.start_date || targetDate > planRange.end_date) {
    throw new Error("La fecha destino está fuera del rango del plan.");
  }
  if (existingSessions.some(s => s.date === targetDate)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, date: targetDate };
}

function simulateCopyExercises(
  sourceExercises: { exercise_id: number; target_sets: number }[]
): { exercise_id: number; target_sets: number }[] {
  return sourceExercises.map(ex => ({ ...ex }));
}

function simulateMoveSessionWithRange(
  existingSessions: { date: string }[],
  newDate: string,
  planRange: { start_date: string | null; end_date: string | null }
): { success: boolean; new_date: string } {
  if (planRange.start_date && newDate < planRange.start_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (planRange.end_date && newDate > planRange.end_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (existingSessions.some(s => s.date === newDate)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, new_date: newDate };
}

function simulateDeleteSession(
  sessions: { id: number; date: string; exercises?: { id: number }[] }[],
  sessionId: number
): { sessions: { id: number; date: string; exercises?: { id: number }[] }[]; deleted: boolean } {
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return { sessions, deleted: false };
  const updated = sessions.filter(s => s.id !== sessionId);
  return { sessions: updated, deleted: true };
}

function simulateAddSession(
  existingSessions: { date: string; plan_id: number }[],
  newDate: string,
  planId: number,
  planRange: { start_date: string; end_date: string }
): { success: boolean; date: string; plan_id: number } {
  if (!newDate) throw new Error("Seleccioná una fecha.");
  if (newDate < planRange.start_date || newDate > planRange.end_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (existingSessions.some(s => s.date === newDate && s.plan_id === planId)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, date: newDate, plan_id: planId };
}

describe('Sesiones del Plan', () => {
  describe('ESCENARIO 3: Distribucion de Sesiones al Importar Plantilla', () => {
    it('plantilla Lun/Jue: sesiones de semana 1 caen en el dia correcto', () => {
      const sessions = distributeTemplateSessions('2026-06-01', [1, 4], 1);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({ date: '2026-06-01', dayName: 'Monday' });
      expect(sessions[1]).toMatchObject({ date: '2026-06-04', dayName: 'Thursday' });
    });

    it('plantilla Lun/Mie/Vie: semana 2 no se superpone con semana 1', () => {
      const sessions = distributeTemplateSessions('2026-06-01', [1, 3, 5], 2);
      expect(sessions).toHaveLength(6);
      const week1 = sessions.filter(s => s.week === 1);
      const week2 = sessions.filter(s => s.week === 2);
      expect(week1.map(s => s.date)).toEqual(['2026-06-01', '2026-06-03', '2026-06-05']);
      expect(week2.map(s => s.date)).toEqual(['2026-06-08', '2026-06-10', '2026-06-12']);
      const week1Set = new Set(week1.map(s => s.date));
      week2.forEach(s => expect(week1Set.has(s.date)).toBe(false));
    });

    it('domingo (valor 0) mapea al ultimo dia de la semana ISO', () => {
      const sessions = distributeTemplateSessions('2026-06-01', [0], 1);
      expect(sessions[0]).toMatchObject({ date: '2026-06-07', dayName: 'Sunday' });
    });

    it('los dias se ordenan Lun->Dom sin importar el orden de entrada', () => {
      const sessions = distributeTemplateSessions('2026-06-01', [5, 1], 1);
      expect(sessions[0].dayName).toBe('Monday');
      expect(sessions[1].dayName).toBe('Friday');
    });
  });

  describe('ESCENARIO 4: Movimiento de Sesiones y Colision', () => {
    it('permite mover a un dia libre y recalcula el day_name', () => {
      const sessions = [{ date: '2026-05-18' }, { date: '2026-05-20' }];
      const result = simulateMoveSession(sessions, '2026-05-21');
      expect(result.success).toBe(true);
      expect(result.new_date).toBe('2026-05-21');
      expect(result.new_day_name).toBe('Thursday');
    });

    it('lanza error al mover a un dia ya ocupado', () => {
      const sessions = [{ date: '2026-05-18' }, { date: '2026-05-22' }];
      expect(() => simulateMoveSession(sessions, '2026-05-22')).toThrow(
        "Ya existe un entrenamiento en esta fecha. Selecciona un dia libre."
      );
    });
  });

  describe('ESCENARIO 11: Duplicar Día', () => {
    const plan = { start_date: '2026-06-01', end_date: '2026-06-28' };

    it('permite duplicar a una fecha libre dentro del plan', () => {
      const sessions = [{ date: '2026-06-02' }, { date: '2026-06-05' }];
      const result = simulateDuplicateSession(sessions, '2026-06-09', plan);
      expect(result.success).toBe(true);
      expect(result.date).toBe('2026-06-09');
    });

    it('lanza error si la fecha destino ya tiene sesion', () => {
      const sessions = [{ date: '2026-06-02' }, { date: '2026-06-09' }];
      expect(() => simulateDuplicateSession(sessions, '2026-06-09', plan))
        .toThrow("Ya existe un entrenamiento en esa fecha.");
    });

    it('lanza error si la fecha destino esta fuera del rango del plan', () => {
      const sessions = [{ date: '2026-06-02' }];
      expect(() => simulateDuplicateSession(sessions, '2026-07-05', plan))
        .toThrow("La fecha destino está fuera del rango del plan.");
      expect(() => simulateDuplicateSession(sessions, '2026-05-31', plan))
        .toThrow("La fecha destino está fuera del rango del plan.");
    });

    it('lanza error si no se selecciono fecha', () => {
      expect(() => simulateDuplicateSession([], '', plan))
        .toThrow("Seleccioná una fecha destino.");
    });

    it('la duplicacion copia todos los ejercicios de la sesion origen', () => {
      const sourceExercises = [
        { exercise_id: 1, target_sets: 3 },
        { exercise_id: 5, target_sets: 4 },
      ];
      const copied = simulateCopyExercises(sourceExercises);
      expect(copied).toHaveLength(2);
      expect(copied[0]).toEqual({ exercise_id: 1, target_sets: 3 });
      expect(copied[1]).toEqual({ exercise_id: 5, target_sets: 4 });
    });

    it('los ejercicios copiados son independientes del original (sin referencia compartida)', () => {
      const sourceExercises = [{ exercise_id: 1, target_sets: 3 }];
      const copied = simulateCopyExercises(sourceExercises);
      copied[0].target_sets = 99;
      expect(sourceExercises[0].target_sets).toBe(3);
    });

    it('duplicar a cualquier dia de la semana es valido (no solo lunes)', () => {
      const sessions: { date: string }[] = [];
      expect(simulateDuplicateSession(sessions, '2026-06-02', plan).success).toBe(true);
      expect(simulateDuplicateSession(sessions, '2026-06-06', plan).success).toBe(true);
      expect(simulateDuplicateSession(sessions, '2026-06-07', plan).success).toBe(true);
    });
  });

  describe('ESCENARIO 12: Reagendar Sesion', () => {
    const plan = { start_date: '2026-06-01', end_date: '2026-06-28' };

    it('permite reagendar a una fecha libre dentro del plan', () => {
      const sessions = [{ date: '2026-06-02' }, { date: '2026-06-05' }];
      const result = simulateMoveSessionWithRange(sessions, '2026-06-10', plan);
      expect(result.success).toBe(true);
      expect(result.new_date).toBe('2026-06-10');
    });

    it('lanza error si la fecha destino ya tiene sesion', () => {
      const sessions = [{ date: '2026-06-02' }, { date: '2026-06-10' }];
      expect(() => simulateMoveSessionWithRange(sessions, '2026-06-10', plan))
        .toThrow("Ya existe un entrenamiento en esa fecha.");
    });

    it('lanza error si la fecha destino esta antes del inicio del plan', () => {
      const sessions = [{ date: '2026-06-02' }];
      expect(() => simulateMoveSessionWithRange(sessions, '2026-05-31', plan))
        .toThrow("La fecha está fuera del rango del plan.");
    });

    it('lanza error si la fecha destino esta despues del fin del plan', () => {
      const sessions = [{ date: '2026-06-02' }];
      expect(() => simulateMoveSessionWithRange(sessions, '2026-06-29', plan))
        .toThrow("La fecha está fuera del rango del plan.");
    });

    it('la sesion de origen no bloquea su propia reagendacion', () => {
      const sessions = [{ date: '2026-06-02' }];
      const result = simulateMoveSessionWithRange(sessions, '2026-06-10', plan);
      expect(result.success).toBe(true);
    });

    it('permite reagendar a la semana anterior dentro del plan', () => {
      const sessions = [{ date: '2026-06-08' }];
      const result = simulateMoveSessionWithRange(sessions, '2026-06-03', plan);
      expect(result.success).toBe(true);
      expect(result.new_date).toBe('2026-06-03');
    });

    it('permite reagendar a la semana siguiente dentro del plan', () => {
      const sessions = [{ date: '2026-06-03' }];
      const result = simulateMoveSessionWithRange(sessions, '2026-06-10', plan);
      expect(result.success).toBe(true);
      expect(result.new_date).toBe('2026-06-10');
    });

    it('no bloquea por rango cuando el plan no tiene end_date', () => {
      const sessions = [{ date: '2026-06-02' }];
      const planSinFin = { start_date: '2026-06-01', end_date: null };
      const result = simulateMoveSessionWithRange(sessions, '2026-12-31', planSinFin);
      expect(result.success).toBe(true);
    });

    it('no bloquea por rango cuando el plan no tiene start_date', () => {
      const sessions = [{ date: '2026-06-02' }];
      const planSinInicio = { start_date: null, end_date: '2026-06-28' };
      const result = simulateMoveSessionWithRange(sessions, '2026-01-01', planSinInicio);
      expect(result.success).toBe(true);
    });
  });

  describe('ESCENARIO 13: Eliminar Día', () => {
    it('eliminar una sesion la remueve de la lista', () => {
      const sessions = [
        { id: 1, date: '2026-06-02', exercises: [] },
        { id: 2, date: '2026-06-05', exercises: [] },
      ];
      const { sessions: updated, deleted } = simulateDeleteSession(sessions, 1);
      expect(deleted).toBe(true);
      expect(updated).toHaveLength(1);
      expect(updated.find(s => s.id === 1)).toBeUndefined();
    });

    it('las sesiones restantes no se modifican al eliminar una', () => {
      const sessions = [
        { id: 1, date: '2026-06-02', exercises: [] },
        { id: 2, date: '2026-06-05', exercises: [{ id: 10 }] },
      ];
      const { sessions: updated } = simulateDeleteSession(sessions, 1);
      expect(updated[0]).toEqual({ id: 2, date: '2026-06-05', exercises: [{ id: 10 }] });
    });

    it('eliminar una sesion remueve sus ejercicios junto con ella', () => {
      const sessions = [
        { id: 1, date: '2026-06-02', exercises: [{ id: 10 }, { id: 11 }] },
        { id: 2, date: '2026-06-05', exercises: [{ id: 20 }] },
      ];
      const { sessions: updated } = simulateDeleteSession(sessions, 1);
      const deletedSession = updated.find(s => s.id === 1);
      expect(deletedSession).toBeUndefined();
      expect(updated[0].exercises).toHaveLength(1);
      expect(updated[0].exercises![0].id).toBe(20);
    });

    it('intentar eliminar una sesion inexistente no modifica la lista', () => {
      const sessions = [{ id: 1, date: '2026-06-02', exercises: [] }];
      const { sessions: updated, deleted } = simulateDeleteSession(sessions, 99);
      expect(deleted).toBe(false);
      expect(updated).toHaveLength(1);
    });

    it('eliminar la unica sesion deja la lista vacia', () => {
      const sessions = [{ id: 1, date: '2026-06-02', exercises: [] }];
      const { sessions: updated, deleted } = simulateDeleteSession(sessions, 1);
      expect(deleted).toBe(true);
      expect(updated).toHaveLength(0);
    });
  });

  describe('ESCENARIO 14: Agregar Día (Iniciar Rutina)', () => {
    const plan = { start_date: '2026-06-01', end_date: '2026-06-28' };
    const planId = 7;

    it('permite agregar una sesion a una fecha libre dentro del plan', () => {
      const sessions: { date: string; plan_id: number }[] = [];
      const result = simulateAddSession(sessions, '2026-06-03', planId, plan);
      expect(result.success).toBe(true);
      expect(result.date).toBe('2026-06-03');
    });

    it('la sesion creada pertenece al plan correcto', () => {
      const sessions: { date: string; plan_id: number }[] = [];
      const result = simulateAddSession(sessions, '2026-06-03', planId, plan);
      expect(result.plan_id).toBe(planId);
    });

    it('lanza error si la fecha ya tiene una sesion en el mismo plan', () => {
      const sessions = [{ date: '2026-06-03', plan_id: planId }];
      expect(() => simulateAddSession(sessions, '2026-06-03', planId, plan))
        .toThrow("Ya existe un entrenamiento en esa fecha.");
    });

    it('permite agregar a la misma fecha si pertenece a otro plan', () => {
      const sessions = [{ date: '2026-06-03', plan_id: 99 }];
      const result = simulateAddSession(sessions, '2026-06-03', planId, plan);
      expect(result.success).toBe(true);
    });

    it('lanza error si la fecha esta fuera del rango del plan', () => {
      const sessions: { date: string; plan_id: number }[] = [];
      expect(() => simulateAddSession(sessions, '2026-05-31', planId, plan))
        .toThrow("La fecha está fuera del rango del plan.");
      expect(() => simulateAddSession(sessions, '2026-06-29', planId, plan))
        .toThrow("La fecha está fuera del rango del plan.");
    });

    it('permite agregar a cualquier dia de la semana (martes, sabado, domingo)', () => {
      const sessions: { date: string; plan_id: number }[] = [];
      expect(simulateAddSession(sessions, '2026-06-02', planId, plan).success).toBe(true);
      expect(simulateAddSession(sessions, '2026-06-06', planId, plan).success).toBe(true);
      expect(simulateAddSession(sessions, '2026-06-07', planId, plan).success).toBe(true);
    });

    it('permite agregar multiples sesiones en la misma semana', () => {
      const sessions: { date: string; plan_id: number }[] = [];
      simulateAddSession(sessions, '2026-06-01', planId, plan);
      sessions.push({ date: '2026-06-01', plan_id: planId });
      simulateAddSession(sessions, '2026-06-03', planId, plan);
      sessions.push({ date: '2026-06-03', plan_id: planId });
      const result = simulateAddSession(sessions, '2026-06-05', planId, plan);
      expect(result.success).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════
// Módulo: Ejercicios y Rutina
// Grid de ejercicios, superseries, reordenamiento, is_completed
// ════════════════════════════════════════════════════════════════

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function shouldShowTodayButton(currentMonday: string, todayMonday: string): boolean {
  return currentMonday !== todayMonday;
}

function toggleExercise(expandedIds: Set<number>, id: number): Set<number> {
  const next = new Set(expandedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function expandAll(exercises: { id: number }[]): Set<number> {
  return new Set(exercises.map(e => e.id));
}

function collapseAll(): Set<number> {
  return new Set<number>();
}

function isExerciseExpanded(expandedIds: Set<number>, id: number, isEditing: boolean): boolean {
  return expandedIds.has(id) || isEditing;
}

function sortByOrderIndex(exercises: { id: number; order_index: number }[]) {
  return [...exercises].sort((a, b) => a.order_index - b.order_index);
}

function swapOrderIndex(
  exercises: { id: number; order_index: number }[],
  indexA: number,
  indexB: number
): { id: number; order_index: number }[] {
  const sorted = sortByOrderIndex(exercises);
  if (indexA < 0 || indexA >= sorted.length || indexB < 0 || indexB >= sorted.length) {
    return sorted;
  }
  const result = sorted.map(e => ({ ...e }));
  const tmp = result[indexA].order_index;
  result[indexA].order_index = result[indexB].order_index;
  result[indexB].order_index = tmp;
  return sortByOrderIndex(result);
}

function canMoveUp(index: number): boolean {
  return index > 0;
}

function canMoveDown(index: number, total: number): boolean {
  return index < total - 1;
}

function resolveSuperset(
  exercises: { id: number; superset_group: number | null }[],
  sourceId: number,
  targetId: number
): { id: number; superset_group: number | null }[] {
  const ex1 = exercises.find(e => e.id === sourceId);
  const ex2 = exercises.find(e => e.id === targetId);
  if (!ex1 || !ex2) return exercises.map(e => ({ ...e }));

  let groupNumber: number;
  if (ex1.superset_group !== null) {
    groupNumber = ex1.superset_group;
  } else if (ex2.superset_group !== null) {
    groupNumber = ex2.superset_group;
  } else {
    const maxGroup = Math.max(0, ...exercises.map(e => e.superset_group ?? 0));
    groupNumber = maxGroup + 1;
  }

  const groupsToMerge = [ex1.superset_group, ex2.superset_group].filter(
    (g): g is number => g !== null && g !== groupNumber
  );

  return exercises.map(e => {
    if (e.id === sourceId || e.id === targetId) return { ...e, superset_group: groupNumber };
    if (groupsToMerge.includes(e.superset_group as number)) return { ...e, superset_group: groupNumber };
    return { ...e };
  });
}

function removeFromSupersetLocal(
  exercises: { id: number; superset_group: number | null }[],
  exerciseId: number
): { id: number; superset_group: number | null }[] {
  return exercises.map(e => e.id === exerciseId ? { ...e, superset_group: null } : { ...e });
}

function isSameGroupAsLinking(
  exercises: { id: number; superset_group: number | null }[],
  linkingId: number,
  targetId: number
): boolean {
  const source = exercises.find(e => e.id === linkingId);
  const target = exercises.find(e => e.id === targetId);
  if (!source || !target) return false;
  if (source.superset_group === null) return false;
  return source.superset_group === target.superset_group;
}

type ExItem = { id: number; order_index: number; superset_group: number | null };
type BlockItem =
  | { type: 'standalone'; ex: ExItem }
  | { type: 'superset'; group: number; exs: ExItem[] };

function buildBlocks(exercises: ExItem[]): BlockItem[] {
  const sorted = [...exercises].sort((a, b) => a.order_index - b.order_index);
  const blocks: BlockItem[] = [];
  const seenGroups = new Set<number>();
  for (const ex of sorted) {
    const g = ex.superset_group;
    if (g === null) {
      blocks.push({ type: 'standalone', ex });
    } else if (!seenGroups.has(g)) {
      seenGroups.add(g);
      blocks.push({ type: 'superset', group: g, exs: sorted.filter(e => e.superset_group === g) });
    }
  }
  return blocks;
}

function reorderItem(
  exercises: ExItem[],
  itemKey: { type: 'standalone'; exerciseId: number } | { type: 'superset'; group: number },
  direction: 'up' | 'down'
): { id: number; order_index: number }[] {
  const blocks = buildBlocks(exercises);
  const blockIdx = itemKey.type === 'standalone'
    ? blocks.findIndex(b => b.type === 'standalone' && (b as any).ex.id === itemKey.exerciseId)
    : blocks.findIndex(b => b.type === 'superset' && (b as any).group === itemKey.group);

  if (blockIdx === -1) return [...exercises].sort((a, b) => a.order_index - b.order_index).map(e => ({ id: e.id, order_index: e.order_index }));

  const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) {
    return [...exercises].sort((a, b) => a.order_index - b.order_index).map(e => ({ id: e.id, order_index: e.order_index }));
  }

  const newBlocks = [...blocks];
  [newBlocks[blockIdx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[blockIdx]];

  let idx = 1;
  const result: { id: number; order_index: number }[] = [];
  for (const block of newBlocks) {
    if (block.type === 'standalone') {
      result.push({ id: (block as any).ex.id, order_index: idx++ });
    } else {
      for (const ex of (block as any).exs) {
        result.push({ id: ex.id, order_index: idx++ });
      }
    }
  }
  return result.sort((a, b) => a.order_index - b.order_index);
}

function shouldMarkSessionComplete(data: Record<string, unknown>): boolean {
  const sets = data.actual_sets as number | null | undefined;
  return !!(sets && sets > 0);
}

function buildCoachPayload(form: {
  target_sets: number;
  target_reps: number[];
  target_weight: (number | null)[];
  target_rpe: number;
  rest_seconds: number;
  coach_notes: string;
  actual_sets?: number;
  actual_reps?: number[];
  actual_rpe?: number;
  student_notes?: string;
}) {
  return {
    target_sets: form.target_sets,
    target_reps: form.target_reps,
    target_weight: form.target_weight,
    target_rpe: form.target_rpe,
    rest_seconds: form.rest_seconds,
    coach_notes: form.coach_notes,
  };
}

describe('Ejercicios y Rutina', () => {
  describe('ESCENARIO 15: Botón "Hoy" - Lógica de Visibilidad y Navegación', () => {
    it('getMonday: un lunes retorna el mismo dia', () => {
      expect(getMonday('2026-06-01')).toBe('2026-06-01');
    });

    it('getMonday: un miercoles retorna el lunes de esa semana', () => {
      expect(getMonday('2026-06-03')).toBe('2026-06-01');
    });

    it('getMonday: un domingo retorna el lunes de esa misma semana ISO (6 dias antes)', () => {
      expect(getMonday('2026-06-07')).toBe('2026-06-01');
    });

    it('getMonday: un sabado retorna el lunes de esa semana', () => {
      expect(getMonday('2026-06-06')).toBe('2026-06-01');
    });

    it('getMonday: resultado siempre es dia 1 (lunes)', () => {
      const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
      dates.forEach(d => {
        expect(new Date(getMonday(d) + "T00:00:00").getDay()).toBe(1);
      });
    });

    it('getMonday: dos dias de la misma semana retornan el mismo lunes', () => {
      expect(getMonday('2026-06-02')).toBe(getMonday('2026-06-05'));
    });

    it('getMonday: dias de semanas distintas retornan lunes distintos', () => {
      expect(getMonday('2026-06-01')).not.toBe(getMonday('2026-06-08'));
    });

    it('oculta el botón cuando se está viendo la semana actual', () => {
      const todayMonday = '2026-06-01';
      expect(shouldShowTodayButton('2026-06-01', todayMonday)).toBe(false);
    });

    it('muestra el botón cuando se está viendo una semana pasada', () => {
      const todayMonday = '2026-06-08';
      expect(shouldShowTodayButton('2026-06-01', todayMonday)).toBe(true);
    });

    it('muestra el botón cuando se está viendo una semana futura', () => {
      const todayMonday = '2026-06-01';
      expect(shouldShowTodayButton('2026-06-15', todayMonday)).toBe(true);
    });

    it('muestra el botón al navegar 3 semanas hacia atrás', () => {
      const todayMonday = '2026-06-22';
      const viewingMonday = '2026-06-01';
      expect(shouldShowTodayButton(viewingMonday, todayMonday)).toBe(true);
    });

    it('al hacer click en Hoy, selectedDate pasa a ser el lunes de la semana actual', () => {
      const today = '2026-06-03';
      const todayMonday = getMonday(today);
      expect(todayMonday).toBe('2026-06-01');
      expect(shouldShowTodayButton(todayMonday, todayMonday)).toBe(false);
    });
  });

  describe('ESCENARIO 16: Colapsar/Expandir Ejercicios', () => {
    const exercises = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('al cargar, todos los ejercicios aparecen cerrados', () => {
      const expandedIds = collapseAll();
      exercises.forEach(ex => expect(expandedIds.has(ex.id)).toBe(false));
    });

    it('expandir un ejercicio no afecta a los demás', () => {
      const result = toggleExercise(new Set<number>(), 2);
      expect(result.has(2)).toBe(true);
      expect(result.has(1)).toBe(false);
      expect(result.has(3)).toBe(false);
    });

    it('tocar un ejercicio ya abierto lo cierra', () => {
      const result = toggleExercise(new Set([1, 2]), 2);
      expect(result.has(2)).toBe(false);
      expect(result.has(1)).toBe(true);
    });

    it('"Expandir todos" abre todos los ejercicios', () => {
      const result = expandAll(exercises);
      expect(result.size).toBe(3);
      exercises.forEach(ex => expect(result.has(ex.id)).toBe(true));
    });

    it('"Colapsar todos" cierra todos los ejercicios', () => {
      const result = collapseAll();
      expect(result.size).toBe(0);
    });

    it('isExpanded es true cuando el ID está en el Set', () => {
      expect(isExerciseExpanded(new Set([2]), 2, false)).toBe(true);
    });

    it('isExpanded es false cuando el ID no está en el Set y no está editando', () => {
      expect(isExerciseExpanded(new Set<number>(), 2, false)).toBe(false);
    });

    it('isExpanded es true cuando isEditing es true aunque el ID no esté en el Set', () => {
      expect(isExerciseExpanded(new Set<number>(), 2, true)).toBe(true);
    });

    it('auto-expand al editar: el ID se agrega al Set existente sin borrar los demás', () => {
      const before = new Set([1]);
      const after = new Set([...before, 3]);
      expect(after.has(1)).toBe(true);
      expect(after.has(3)).toBe(true);
      expect(after.has(2)).toBe(false);
    });

    it('al cambiar de día se cierran todos los ejercicios', () => {
      const result = collapseAll();
      expect(result.size).toBe(0);
    });

    it('abrir o cerrar no altera el estado anterior', () => {
      const original = new Set([1, 2]);
      toggleExercise(original, 2);
      expect(original.has(2)).toBe(true);
    });
  });

  describe('ESCENARIO 17: Reordenar Ejercicios', () => {
    const exercises = [
      { id: 1, order_index: 1 },
      { id: 2, order_index: 2 },
      { id: 3, order_index: 3 },
    ];

    it('mover arriba: el ejercicio intercambia posición con el anterior', () => {
      const result = swapOrderIndex(exercises, 1, 0);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(3);
    });

    it('mover abajo: el ejercicio intercambia posición con el siguiente', () => {
      const result = swapOrderIndex(exercises, 0, 1);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(3);
    });

    it('el primer ejercicio no puede subir más', () => {
      expect(canMoveUp(0)).toBe(false);
    });

    it('cualquier ejercicio excepto el primero puede subir', () => {
      expect(canMoveUp(1)).toBe(true);
      expect(canMoveUp(2)).toBe(true);
    });

    it('el último ejercicio no puede bajar más', () => {
      expect(canMoveDown(2, 3)).toBe(false);
    });

    it('cualquier ejercicio excepto el último puede bajar', () => {
      expect(canMoveDown(0, 3)).toBe(true);
      expect(canMoveDown(1, 3)).toBe(true);
    });

    it('después de mover, no quedan posiciones repetidas', () => {
      const result = swapOrderIndex(exercises, 0, 1);
      const orders = result.map(e => e.order_index);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('subir el último ejercicio dos veces lo deja al principio', () => {
      let ex = exercises.map(e => ({ ...e }));
      ex = swapOrderIndex(ex, 2, 1);
      ex = swapOrderIndex(ex, 1, 0);
      expect(ex[0].id).toBe(3);
    });

    it('bajar el primer ejercicio dos veces lo deja al final', () => {
      let ex = exercises.map(e => ({ ...e }));
      ex = swapOrderIndex(ex, 0, 1);
      ex = swapOrderIndex(ex, 1, 2);
      expect(ex[2].id).toBe(1);
    });

    it('índice fuera de rango no modifica la lista', () => {
      const result = swapOrderIndex(exercises, 0, -1);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it('mover ejercicios no altera la lista original', () => {
      swapOrderIndex(exercises, 0, 1);
      expect(exercises[0].id).toBe(1);
      expect(exercises[0].order_index).toBe(1);
    });
  });

  describe('ESCENARIO 18: Super Series - Agrupar y Desagrupar', () => {
    it('encadenar dos ejercicios sin grupo les asigna un grupo nuevo', () => {
      const exs = [
        { id: 1, superset_group: null },
        { id: 2, superset_group: null },
        { id: 3, superset_group: null },
      ];
      const result = resolveSuperset(exs, 1, 2);
      expect(result.find(e => e.id === 1)!.superset_group).toBe(1);
      expect(result.find(e => e.id === 2)!.superset_group).toBe(1);
      expect(result.find(e => e.id === 3)!.superset_group).toBeNull();
    });

    it('si ya hay un grupo, el nuevo encadenamiento usa el siguiente número', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
        { id: 3, superset_group: null },
        { id: 4, superset_group: null },
      ];
      const result = resolveSuperset(exs, 3, 4);
      expect(result.find(e => e.id === 3)!.superset_group).toBe(2);
      expect(result.find(e => e.id === 4)!.superset_group).toBe(2);
    });

    it('si el source ya tiene grupo, el target adopta el grupo del source', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: null },
      ];
      const result = resolveSuperset(exs, 1, 2);
      expect(result.find(e => e.id === 2)!.superset_group).toBe(1);
      expect(result.find(e => e.id === 1)!.superset_group).toBe(1);
    });

    it('si solo el target tiene grupo, el source adopta el grupo del target', () => {
      const exs = [
        { id: 1, superset_group: null },
        { id: 2, superset_group: 3 },
      ];
      const result = resolveSuperset(exs, 1, 2);
      expect(result.find(e => e.id === 1)!.superset_group).toBe(3);
      expect(result.find(e => e.id === 2)!.superset_group).toBe(3);
    });

    it('si ambos están en el mismo grupo, el resultado no cambia', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
      ];
      const result = resolveSuperset(exs, 1, 2);
      expect(result.find(e => e.id === 1)!.superset_group).toBe(1);
      expect(result.find(e => e.id === 2)!.superset_group).toBe(1);
    });

    it('si ambos tienen grupos distintos, todos los del grupo viejo pasan al del source', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
        { id: 3, superset_group: 2 },
        { id: 4, superset_group: 2 },
      ];
      const result = resolveSuperset(exs, 1, 3);
      expect(result.every(e => e.superset_group === 1)).toBe(true);
    });

    it('desencadenar un ejercicio lo deja sin grupo', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
      ];
      const result = removeFromSupersetLocal(exs, 1);
      expect(result.find(e => e.id === 1)!.superset_group).toBeNull();
    });

    it('desencadenar un ejercicio no afecta a los otros del mismo grupo', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
        { id: 3, superset_group: 1 },
      ];
      const result = removeFromSupersetLocal(exs, 1);
      expect(result.find(e => e.id === 2)!.superset_group).toBe(1);
      expect(result.find(e => e.id === 3)!.superset_group).toBe(1);
    });

    it('no se puede encadenar dos ejercicios que ya están en el mismo grupo', () => {
      const exs = [
        { id: 1, superset_group: 1 },
        { id: 2, superset_group: 1 },
      ];
      expect(isSameGroupAsLinking(exs, 1, 2)).toBe(true);
    });

    it('se puede encadenar si el ejercicio origen no tiene grupo asignado', () => {
      const exs = [
        { id: 1, superset_group: null },
        { id: 2, superset_group: 1 },
      ];
      expect(isSameGroupAsLinking(exs, 1, 2)).toBe(false);
    });

    it('encadenar 3 ejercicios en dos pasos (A-B luego A-C) deja los 3 en el mismo grupo', () => {
      let exs: { id: number; superset_group: number | null }[] = [
        { id: 1, superset_group: null },
        { id: 2, superset_group: null },
        { id: 3, superset_group: null },
      ];
      exs = resolveSuperset(exs, 1, 2);
      exs = resolveSuperset(exs, 1, 3);
      expect(exs.find(e => e.id === 1)!.superset_group).toBe(1);
      expect(exs.find(e => e.id === 2)!.superset_group).toBe(1);
      expect(exs.find(e => e.id === 3)!.superset_group).toBe(1);
    });
  });

  describe('ESCENARIO 19: Reordenar con Super Series', () => {
    it('mover un ejercicio individual hacia arriba lo intercambia con el anterior', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: null },
        { id: 3, order_index: 3, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'standalone', exerciseId: 2 }, 'up');
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(3);
    });

    it('mover un ejercicio individual hacia abajo lo intercambia con el siguiente', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: null },
        { id: 3, order_index: 3, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'standalone', exerciseId: 2 }, 'down');
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(2);
    });

    it('mover un ejercicio individual hacia arriba salta por encima de todo el superset', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: 1 },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'standalone', exerciseId: 3 }, 'up');
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(2);
    });

    it('mover un ejercicio individual hacia abajo salta por debajo de todo el superset', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 1 },
      ];
      const result = reorderItem(exs, { type: 'standalone', exerciseId: 1 }, 'down');
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(1);
    });

    it('mover superset block hacia arriba sube el bloque completo', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 1 },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'up');
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(1);
    });

    it('mover superset block hacia abajo baja el bloque completo', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: 1 },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'down');
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(2);
    });

    it('los ejercicios del superset se mantienen juntos después de mover el bloque', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 1 },
        { id: 4, order_index: 4, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'up');
      const idxB = result.findIndex(e => e.id === 2);
      const idxC = result.findIndex(e => e.id === 3);
      expect(Math.abs(idxB - idxC)).toBe(1);
    });

    it('después de reordenar, los números de posición quedan sin saltos', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: 1 },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'down');
      const orders = result.map(e => e.order_index).sort((a, b) => a - b);
      expect(orders).toEqual([1, 2, 3]);
    });

    it('el primer bloque no puede subir: el orden no cambia', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'standalone', exerciseId: 1 }, 'up');
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('el último bloque no puede bajar: el orden no cambia', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 1 },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'down');
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it('dos supersets independientes se mueven sin afectarse entre sí', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: 1 },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 2 },
        { id: 4, order_index: 4, superset_group: 2 },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 2 }, 'up');
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(4);
      expect(result[2].id).toBe(1);
      expect(result[3].id).toBe(2);
    });

    it('un superset de 3 ejercicios se mueve como unidad sin separarse', () => {
      const exs: ExItem[] = [
        { id: 1, order_index: 1, superset_group: null },
        { id: 2, order_index: 2, superset_group: 1 },
        { id: 3, order_index: 3, superset_group: 1 },
        { id: 4, order_index: 4, superset_group: 1 },
        { id: 5, order_index: 5, superset_group: null },
      ];
      const result = reorderItem(exs, { type: 'superset', group: 1 }, 'down');
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(5);
      expect(result[2].id).toBe(2);
      expect(result[3].id).toBe(3);
      expect(result[4].id).toBe(4);
    });
  });

  describe('ESCENARIO 20: is_completed y Bug de Datos del Alumno al Editar Coach', () => {
    it('shouldMarkSessionComplete: true cuando actual_sets > 0', () => {
      expect(shouldMarkSessionComplete({ actual_sets: 3 })).toBe(true);
    });

    it('shouldMarkSessionComplete: true cuando actual_sets = 1', () => {
      expect(shouldMarkSessionComplete({ actual_sets: 1 })).toBe(true);
    });

    it('shouldMarkSessionComplete: false cuando actual_sets = 0', () => {
      expect(shouldMarkSessionComplete({ actual_sets: 0 })).toBe(false);
    });

    it('shouldMarkSessionComplete: false cuando actual_sets es null', () => {
      expect(shouldMarkSessionComplete({ actual_sets: null })).toBe(false);
    });

    it('shouldMarkSessionComplete: false cuando actual_sets no está en el payload', () => {
      expect(shouldMarkSessionComplete({ target_sets: 3 })).toBe(false);
    });

    it('los datos que envía el entrenador solo incluyen los objetivos del ejercicio', () => {
      const form = {
        target_sets: 3,
        target_reps: [10, 10, 10],
        target_weight: [60, 60, 60],
        target_rpe: 8,
        rest_seconds: 90,
        coach_notes: 'Foco en la bajada',
        actual_sets: 2,
        actual_reps: [10, 9],
        actual_rpe: 7,
        student_notes: 'Pesado',
      };
      const payload = buildCoachPayload(form);
      expect('actual_sets' in payload).toBe(false);
      expect('actual_reps' in payload).toBe(false);
      expect('actual_rpe' in payload).toBe(false);
      expect('student_notes' in payload).toBe(false);
      expect(payload.target_sets).toBe(3);
      expect(payload.coach_notes).toBe('Foco en la bajada');
    });

    it('el entrenador no puede marcar la sesión como completada', () => {
      const form = {
        target_sets: 3,
        target_reps: [10, 10, 10],
        target_weight: [null, null, null],
        target_rpe: 8,
        rest_seconds: 60,
        coach_notes: 'Reducir sets',
        actual_sets: 4,
        actual_reps: [12, 10, 10, 9],
        actual_rpe: 7,
        student_notes: 'Estuvo pesado',
      };
      const payload = buildCoachPayload(form);
      expect('actual_sets' in payload).toBe(false);
      expect('actual_rpe' in payload).toBe(false);
      expect((payload as Record<string, unknown>).actual_sets).toBeUndefined();
      expect((payload as Record<string, unknown>).actual_rpe).toBeUndefined();
      expect(shouldMarkSessionComplete(payload)).toBe(false);
    });

    it('el payload del coach es idéntico independientemente de si el alumno completó o no', () => {
      const baseTargets = {
        target_sets: 3,
        target_reps: [10, 10, 10],
        target_weight: [60, 60, 60],
        target_rpe: 8,
        rest_seconds: 90,
        coach_notes: 'Foco en la bajada',
      };
      const payloadSinDatos = buildCoachPayload({ ...baseTargets });
      const payloadConDatos = buildCoachPayload({
        ...baseTargets,
        actual_sets: 4,
        actual_reps: [12, 10, 10, 8],
        actual_rpe: 9,
        student_notes: 'Muy pesado',
      });
      expect(payloadSinDatos).toEqual(payloadConDatos);
    });

    it('los datos del entrenador incluyen el tiempo de descanso', () => {
      const form = {
        target_sets: 3, target_reps: [10, 10, 10],
        target_weight: [null, null, null], target_rpe: 7,
        rest_seconds: 90, coach_notes: '',
      };
      expect(buildCoachPayload(form).rest_seconds).toBe(90);
    });

    it('el peso objetivo se guarda aunque algunos sets no tengan valor', () => {
      const form = {
        target_sets: 3, target_reps: [10, 10, 10],
        target_weight: [null, null, null], target_rpe: 8,
        rest_seconds: 60, coach_notes: '',
      };
      expect(buildCoachPayload(form).target_weight).toEqual([null, null, null]);
    });

    it('las repeticiones objetivo se guardan exactamente como las indicó el entrenador', () => {
      const form = {
        target_sets: 3, target_reps: [8, 6, 5],
        target_weight: [100, 105, 110], target_rpe: 9,
        rest_seconds: 180, coach_notes: 'Pesado',
      };
      expect(buildCoachPayload(form).target_reps).toEqual([8, 6, 5]);
    });

    it('se guarda aunque el entrenador no haya escrito notas', () => {
      const form = {
        target_sets: 3, target_reps: [10, 10, 10],
        target_weight: [null, null, null], target_rpe: 8,
        rest_seconds: 60, coach_notes: '',
      };
      expect(buildCoachPayload(form).coach_notes).toBe('');
    });

    it('shouldMarkSessionComplete: false cuando actual_sets es undefined', () => {
      expect(shouldMarkSessionComplete({ actual_sets: undefined })).toBe(false);
    });

    it('cambiar los sets objetivo no incluye los sets reales del alumno', () => {
      const coachEdit = {
        target_sets: 2, target_reps: [12, 12],
        target_weight: [70, 70], target_rpe: 7,
        rest_seconds: 60, coach_notes: 'Nuevo volumen',
        actual_sets: 3, actual_reps: [10, 10, 10],
      };
      const payload = buildCoachPayload(coachEdit);
      expect(payload.target_sets).toBe(2);
      expect('actual_sets' in payload).toBe(false);
    });
  });
});

}); // Estudiantes

// ════════════════════════════════════════════════════════════════
// Módulo: Plantillas
// Estructura uniforme N×M, visibilidad por coach/admin,
// eliminar semana, export de plan como plantilla
// ════════════════════════════════════════════════════════════════

type TemplateSession = {
  id: number;
  plan_id: number;
  week_number: number;
  day_name: string;
  order_index: number;
};

function parseDayNumber(dayName: string): number {
  const match = dayName.match(/D[íi]a\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function isTemplateUniform(sessions: TemplateSession[]): boolean {
  if (sessions.length === 0) return true;
  const weekMap = new Map<number, Set<string>>();
  for (const s of sessions) {
    if (!weekMap.has(s.week_number)) weekMap.set(s.week_number, new Set());
    weekMap.get(s.week_number)!.add(s.day_name);
  }
  const sets = [...weekMap.values()];
  const ref = sets[0];
  return sets.every((set) => {
    if (set.size !== ref.size) return false;
    for (const d of ref) if (!set.has(d)) return false;
    return true;
  });
}

function addDayToAllWeeksLocal(sessions: TemplateSession[]): TemplateSession[] {
  if (sessions.length === 0) {
    return [{ id: 1, plan_id: 1, week_number: 1, day_name: 'Día 1', order_index: 1 }];
  }
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort((a, b) => a - b);
  const maxDay = Math.max(0, ...sessions.map((s) => parseDayNumber(s.day_name)));
  const newDayName = `Día ${maxDay + 1}`;
  const maxOrderIndex = Math.max(0, ...sessions.map((s) => s.order_index));
  const nextId = Math.max(0, ...sessions.map((s) => s.id)) + 1;
  const newSessions: TemplateSession[] = weekNumbers.map((wk, i) => ({
    id: nextId + i,
    plan_id: sessions[0].plan_id,
    week_number: wk,
    day_name: newDayName,
    order_index: maxOrderIndex + i + 1,
  }));
  return [...sessions, ...newSessions];
}

function removeDayFromAllWeeksLocal(sessions: TemplateSession[]): { sessions: TemplateSession[]; success: boolean; reason?: string } {
  const maxDay = Math.max(0, ...sessions.map((s) => parseDayNumber(s.day_name)));
  if (maxDay <= 1) return { sessions, success: false, reason: 'min_days' };
  const filtered = sessions.filter((s) => parseDayNumber(s.day_name) !== maxDay);
  return { sessions: filtered, success: true };
}

function addWeekToTemplateLocal(sessions: TemplateSession[]): TemplateSession[] {
  if (sessions.length === 0) {
    return [{ id: 1, plan_id: 1, week_number: 1, day_name: 'Día 1', order_index: 1 }];
  }
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort((a, b) => a - b);
  const maxWeek = Math.max(...weekNumbers);
  const maxOrderIndex = Math.max(0, ...sessions.map((s) => s.order_index));
  const firstWeekSessions = sessions
    .filter((s) => s.week_number === weekNumbers[0])
    .sort((a, b) => parseDayNumber(a.day_name) - parseDayNumber(b.day_name));
  const dayNames = firstWeekSessions.map((s) => s.day_name);
  const nextId = Math.max(0, ...sessions.map((s) => s.id)) + 1;
  const newSessions: TemplateSession[] = dayNames.map((dn, i) => ({
    id: nextId + i,
    plan_id: sessions[0].plan_id,
    week_number: maxWeek + 1,
    day_name: dn,
    order_index: maxOrderIndex + i + 1,
  }));
  return [...sessions, ...newSessions];
}

function removeWeekFromTemplateLocal(
  sessions: TemplateSession[],
  weekNumber: number
): { sessions: TemplateSession[]; success: boolean; reason?: string } {
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))];
  if (weekNumbers.length <= 1) return { sessions, success: false, reason: 'min_weeks' };
  const filtered = sessions.filter((s) => s.week_number !== weekNumber);
  return { sessions: filtered, success: true };
}

function buildInitialTemplate(weeks: number, daysPerWeek: number): TemplateSession[] {
  const result: TemplateSession[] = [];
  let id = 1;
  let orderIndex = 1;
  for (let w = 1; w <= weeks; w++) {
    for (let d = 1; d <= daysPerWeek; d++) {
      result.push({ id: id++, plan_id: 1, week_number: w, day_name: `Día ${d}`, order_index: orderIndex++ });
    }
  }
  return result;
}

function remainingWeeks(sessions: TemplateSession[]): number[] {
  return [...new Set(sessions.map((s) => s.week_number))].sort((a, b) => a - b);
}

function filterTemplatesByCoach(
  templates: Array<{ id: number; coach_id: string; is_template: boolean }>,
  userId: string,
  role: 'COACH' | 'ADMIN'
): typeof templates {
  if (role === 'ADMIN') return templates.filter((t) => t.is_template);
  return templates.filter((t) => t.is_template && t.coach_id === userId);
}

function simulateDuplicatePlan(
  plan: { id: number; name: string; student_id: string | null; sessions: any[] },
  targetStudentId?: string
): { is_template: boolean; student_id: string | null; name: string } {
  return {
    is_template: !targetStudentId,
    student_id: targetStudentId ?? null,
    name: targetStudentId ? plan.name : `${plan.name} (Copia)`,
  };
}

type PlanSession = {
  id: number;
  week_number: number;
  day_name: string;
  order_index: number;
  date: string | null;
  exercises: Array<{
    exercise_id: number;
    target_sets: number;
    target_reps: number[];
    target_weight: (number | null)[];
    target_rpe: number;
    rest_seconds: number;
    coach_notes: string;
    superset_group: number | null;
    actual_sets?: number | null;
    actual_reps?: number[] | null;
  }>;
};

type TrainingPlanForExport = {
  id: number;
  name: string;
  coach_id: string;
  student_id: string | null;
  is_template: boolean;
  start_date: string | null;
  end_date: string | null;
  sessions: PlanSession[];
};

function exportPlanAsTemplate(plan: TrainingPlanForExport): TrainingPlanForExport {
  return {
    ...plan,
    id: plan.id + 1000,
    name: `${plan.name} (Copia)`,
    is_template: true,
    student_id: null,
    start_date: null,
    end_date: null,
    sessions: plan.sessions.map((s) => ({
      ...s,
      id: s.id + 1000,
      date: null,
      exercises: s.exercises.map((ex) => ({
        exercise_id: ex.exercise_id,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight: ex.target_weight,
        target_rpe: ex.target_rpe,
        rest_seconds: ex.rest_seconds,
        coach_notes: ex.coach_notes,
        superset_group: ex.superset_group,
      })),
    })),
  };
}

const STUDENT_PLAN: TrainingPlanForExport = {
  id: 42,
  name: 'Fuerza Junio',
  coach_id: 'coach-a',
  student_id: 'student-x',
  is_template: false,
  start_date: '2026-06-02',
  end_date: '2026-06-29',
  sessions: [
    {
      id: 101,
      week_number: 1,
      day_name: 'Monday',
      order_index: 1,
      date: '2026-06-02',
      exercises: [
        {
          exercise_id: 5,
          target_sets: 3,
          target_reps: [8, 8, 8],
          target_weight: [80, 80, 80],
          target_rpe: 8,
          rest_seconds: 120,
          coach_notes: 'Foco en la bajada',
          superset_group: null,
          actual_sets: 3,
          actual_reps: [8, 7, 6],
        },
        {
          exercise_id: 7,
          target_sets: 4,
          target_reps: [10, 10, 10, 10],
          target_weight: [null, null, null, null],
          target_rpe: 7,
          rest_seconds: 90,
          coach_notes: '',
          superset_group: 1,
          actual_sets: null,
          actual_reps: null,
        },
      ],
    },
    {
      id: 102,
      week_number: 1,
      day_name: 'Wednesday',
      order_index: 2,
      date: '2026-06-04',
      exercises: [],
    },
  ],
};

describe('Plantillas', () => {
  describe('ESCENARIO 21: Estructura uniforme de plantillas', () => {
    it('addDayToAllWeeks: 2×2 → 2×3 (agrega el mismo día a todas las semanas)', () => {
      const initial = buildInitialTemplate(2, 2);
      const result = addDayToAllWeeksLocal(initial);
      const week1 = result.filter((s) => s.week_number === 1);
      const week2 = result.filter((s) => s.week_number === 2);
      expect(week1).toHaveLength(3);
      expect(week2).toHaveLength(3);
      expect(week1.some((s) => s.day_name === 'Día 3')).toBe(true);
      expect(week2.some((s) => s.day_name === 'Día 3')).toBe(true);
    });

    it('addDayToAllWeeks: 3×3 → 3×4', () => {
      const initial = buildInitialTemplate(3, 3);
      const result = addDayToAllWeeksLocal(initial);
      const weeks = [1, 2, 3];
      for (const w of weeks) {
        const weekSessions = result.filter((s) => s.week_number === w);
        expect(weekSessions).toHaveLength(4);
        expect(weekSessions.some((s) => s.day_name === 'Día 4')).toBe(true);
      }
    });

    it('addDayToAllWeeks: plantilla vacía crea semana 1 día 1', () => {
      const result = addDayToAllWeeksLocal([]);
      expect(result).toHaveLength(1);
      expect(result[0].week_number).toBe(1);
      expect(result[0].day_name).toBe('Día 1');
    });

    it('removeDayFromAllWeeks: 2×3 → 2×2 (elimina último día de todas las semanas)', () => {
      const initial = buildInitialTemplate(2, 3);
      const { sessions: result, success } = removeDayFromAllWeeksLocal(initial);
      expect(success).toBe(true);
      const week1 = result.filter((s) => s.week_number === 1);
      const week2 = result.filter((s) => s.week_number === 2);
      expect(week1).toHaveLength(2);
      expect(week2).toHaveLength(2);
      expect(result.some((s) => s.day_name === 'Día 3')).toBe(false);
    });

    it('removeDayFromAllWeeks: no elimina si hay solo 1 día por semana', () => {
      const initial = buildInitialTemplate(3, 1);
      const { sessions: result, success, reason } = removeDayFromAllWeeksLocal(initial);
      expect(success).toBe(false);
      expect(reason).toBe('min_days');
      expect(result).toHaveLength(initial.length);
    });

    it('addWeekToTemplate: 2×3 → 3×3 (agrega semana nueva con mismos días)', () => {
      const initial = buildInitialTemplate(2, 3);
      const result = addWeekToTemplateLocal(initial);
      const week3 = result.filter((s) => s.week_number === 3);
      expect(week3).toHaveLength(3);
      expect(week3.map((s) => s.day_name).sort()).toEqual(['Día 1', 'Día 2', 'Día 3']);
    });

    it('addWeekToTemplate: los nuevos order_index son mayores que todos los existentes', () => {
      const initial = buildInitialTemplate(2, 3);
      const maxBefore = Math.max(...initial.map((s) => s.order_index));
      const result = addWeekToTemplateLocal(initial);
      const newSessions = result.filter((s) => s.week_number === 3);
      expect(newSessions.every((s) => s.order_index > maxBefore)).toBe(true);
    });

    it('addWeekToTemplate: plantilla vacía crea semana 1 día 1', () => {
      const result = addWeekToTemplateLocal([]);
      expect(result).toHaveLength(1);
      expect(result[0].week_number).toBe(1);
    });

    it('isTemplateUniform: plantilla uniforme → true', () => {
      const sessions = buildInitialTemplate(3, 4);
      expect(isTemplateUniform(sessions)).toBe(true);
    });

    it('isTemplateUniform: plantilla vacía → true', () => {
      expect(isTemplateUniform([])).toBe(true);
    });

    it('isTemplateUniform: plantilla de 1 semana siempre es uniforme', () => {
      const sessions = buildInitialTemplate(1, 5);
      expect(isTemplateUniform(sessions)).toBe(true);
    });

    it('isTemplateUniform: semanas con distinta cantidad de días → false', () => {
      const sessions: TemplateSession[] = [
        { id: 1, plan_id: 1, week_number: 1, day_name: 'Día 1', order_index: 1 },
        { id: 2, plan_id: 1, week_number: 1, day_name: 'Día 2', order_index: 2 },
        { id: 3, plan_id: 1, week_number: 2, day_name: 'Día 1', order_index: 3 },
        { id: 4, plan_id: 1, week_number: 2, day_name: 'Día 2', order_index: 4 },
        { id: 5, plan_id: 1, week_number: 2, day_name: 'Día 3', order_index: 5 },
      ];
      expect(isTemplateUniform(sessions)).toBe(false);
    });

    it('después de addDayToAllWeeks la plantilla es uniforme', () => {
      const initial = buildInitialTemplate(4, 2);
      const result = addDayToAllWeeksLocal(initial);
      expect(isTemplateUniform(result)).toBe(true);
    });

    it('después de addWeekToTemplate la plantilla es uniforme', () => {
      const initial = buildInitialTemplate(2, 3);
      const result = addWeekToTemplateLocal(initial);
      expect(isTemplateUniform(result)).toBe(true);
    });
  });

  describe('ESCENARIO 22: Visibilidad de plantillas por rol', () => {
    const templates = [
      { id: 1, coach_id: 'coach-a', is_template: true },
      { id: 2, coach_id: 'coach-a', is_template: true },
      { id: 3, coach_id: 'coach-b', is_template: true },
      { id: 4, coach_id: 'coach-b', is_template: false },
    ];

    it('COACH solo ve sus propias plantillas', () => {
      const result = filterTemplatesByCoach(templates, 'coach-a', 'COACH');
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.coach_id === 'coach-a')).toBe(true);
    });

    it('COACH-B no ve plantillas de COACH-A', () => {
      const result = filterTemplatesByCoach(templates, 'coach-b', 'COACH');
      expect(result.some((t) => t.coach_id === 'coach-a')).toBe(false);
    });

    it('ADMIN ve plantillas de todos los coaches', () => {
      const result = filterTemplatesByCoach(templates, 'any-admin-id', 'ADMIN');
      expect(result).toHaveLength(3);
      expect(result.some((t) => t.coach_id === 'coach-a')).toBe(true);
      expect(result.some((t) => t.coach_id === 'coach-b')).toBe(true);
    });

    it('ADMIN no ve planes (is_template=false)', () => {
      const result = filterTemplatesByCoach(templates, 'any-admin-id', 'ADMIN');
      expect(result.every((t) => t.is_template)).toBe(true);
    });
  });

  describe('ESCENARIO 22b: Cálculo de días por semana de una plantilla', () => {
    type SessionForCount = { week_number: number };

    function computeTrainingDaysCount(sessions: SessionForCount[]): number {
      const weekCounts = new Map<number, number>();
      for (const s of sessions) {
        weekCounts.set(s.week_number, (weekCounts.get(s.week_number) ?? 0) + 1);
      }
      const sortedWeeks = [...weekCounts.keys()].sort((a, b) => a - b);
      return sortedWeeks.length > 0 ? (weekCounts.get(sortedWeeks[0]) ?? 0) : 0;
    }

    it('plantilla 2×2: devuelve 2 días por semana', () => {
      const sessions: SessionForCount[] = [
        { week_number: 1 }, { week_number: 1 },
        { week_number: 2 }, { week_number: 2 },
      ];
      expect(computeTrainingDaysCount(sessions)).toBe(2);
    });

    it('plantilla 3×3: devuelve 3 días por semana', () => {
      const sessions: SessionForCount[] = [
        { week_number: 1 }, { week_number: 1 }, { week_number: 1 },
        { week_number: 2 }, { week_number: 2 }, { week_number: 2 },
        { week_number: 3 }, { week_number: 3 }, { week_number: 3 },
      ];
      expect(computeTrainingDaysCount(sessions)).toBe(3);
    });

    it('plantilla sin sesiones: devuelve 0', () => {
      expect(computeTrainingDaysCount([])).toBe(0);
    });

    it('plantilla de 1 sola semana: devuelve sus días', () => {
      const sessions: SessionForCount[] = [
        { week_number: 1 }, { week_number: 1 }, { week_number: 1 }, { week_number: 1 },
      ];
      expect(computeTrainingDaysCount(sessions)).toBe(4);
    });

    it('usa siempre la semana con el número más bajo como referencia', () => {
      // Semana 2 tiene 3 sesiones, semana 1 tiene 2 → debe devolver 2
      const sessions: SessionForCount[] = [
        { week_number: 1 }, { week_number: 1 },
        { week_number: 2 }, { week_number: 2 }, { week_number: 2 },
      ];
      expect(computeTrainingDaysCount(sessions)).toBe(2);
    });
  });

  describe('ESCENARIO 23: removeWeekFromTemplate', () => {
    it('elimina la semana indicada y sus sesiones', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions, success } = removeWeekFromTemplateLocal(initial, 2);
      expect(success).toBe(true);
      expect(sessions.every((s) => s.week_number !== 2)).toBe(true);
    });

    it('las sesiones de las otras semanas permanecen intactas', () => {
      const initial = buildInitialTemplate(3, 3);
      const week1Before = initial.filter((s) => s.week_number === 1).map((s) => s.id);
      const week3Before = initial.filter((s) => s.week_number === 3).map((s) => s.id);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(sessions.filter((s) => s.week_number === 1).map((s) => s.id)).toEqual(week1Before);
      expect(sessions.filter((s) => s.week_number === 3).map((s) => s.id)).toEqual(week3Before);
    });

    it('eliminar la primera semana deja las demás (semanas 2 y 3)', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      expect(remainingWeeks(sessions)).toEqual([2, 3]);
    });

    it('eliminar la última semana deja las anteriores (semanas 1 y 2)', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 3);
      expect(remainingWeeks(sessions)).toEqual([1, 2]);
    });

    it('eliminar semana del medio deja primera y última (semanas 1 y 3)', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(remainingWeeks(sessions)).toEqual([1, 3]);
    });

    it('no permite eliminar si solo queda 1 semana', () => {
      const initial = buildInitialTemplate(1, 3);
      const { sessions: result, success, reason } = removeWeekFromTemplateLocal(initial, 1);
      expect(success).toBe(false);
      expect(reason).toBe('min_weeks');
      expect(result).toHaveLength(initial.length);
    });

    it('el total de sesiones se reduce en (días × 1 semana eliminada)', () => {
      const initial = buildInitialTemplate(4, 3);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(sessions).toHaveLength(9);
    });

    it('después de eliminar la plantilla sigue siendo uniforme', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(isTemplateUniform(sessions)).toBe(true);
    });

    it('al eliminar la semana actual, el editor navega a la semana anterior', () => {
      const initial = buildInitialTemplate(3, 2);
      const selectedWeek = 3;
      const weekNums = remainingWeeks(initial);
      const afterDeletion = weekNums.filter((wk) => wk !== selectedWeek);
      const newSelected = afterDeletion[afterDeletion.length - 1];
      expect(newSelected).toBe(2);
    });

    it('al eliminar una de dos semanas, queda seleccionada la restante', () => {
      const initial = buildInitialTemplate(2, 2);
      const selectedWeek = 2;
      const weekNums = remainingWeeks(initial);
      const afterDeletion = weekNums.filter((wk) => wk !== selectedWeek);
      expect(afterDeletion).toHaveLength(1);
      expect(afterDeletion[0]).toBe(1);
    });
  });

  describe('ESCENARIO 24: Export plan como plantilla', () => {
    it('la plantilla exportada tiene is_template=true', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.is_template).toBe(true);
    });

    it('la plantilla exportada no está vinculada a ningún alumno', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.student_id).toBeNull();
    });

    it('la plantilla exportada no tiene fechas de plan (start_date y end_date null)', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.start_date).toBeNull();
      expect(result.end_date).toBeNull();
    });

    it('las sesiones de la plantilla exportada no tienen fecha específica', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.sessions.every((s) => s.date === null)).toBe(true);
    });

    it('el nombre de la plantilla exportada incluye "(Copia)"', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.name).toBe('Fuerza Junio (Copia)');
    });

    it('se preserva la estructura de semanas y días', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].week_number).toBe(1);
      expect(result.sessions[0].day_name).toBe('Monday');
      expect(result.sessions[1].day_name).toBe('Wednesday');
    });

    it('se preservan los targets del coach en los ejercicios', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      const ex = result.sessions[0].exercises[0];
      expect(ex.target_sets).toBe(3);
      expect(ex.target_reps).toEqual([8, 8, 8]);
      expect(ex.target_weight).toEqual([80, 80, 80]);
      expect(ex.target_rpe).toBe(8);
      expect(ex.rest_seconds).toBe(120);
      expect(ex.coach_notes).toBe('Foco en la bajada');
    });

    it('NO se copian los datos reales del alumno (actual_sets, actual_reps)', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      const ex = result.sessions[0].exercises[0];
      expect('actual_sets' in ex).toBe(false);
      expect('actual_reps' in ex).toBe(false);
    });

    it('se preserva el superset_group de los ejercicios', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      const exs = result.sessions[0].exercises;
      expect(exs[0].superset_group).toBeNull();
      expect(exs[1].superset_group).toBe(1);
    });

    it('el plan original no se modifica después de exportar', () => {
      const original = JSON.parse(JSON.stringify(STUDENT_PLAN));
      exportPlanAsTemplate(STUDENT_PLAN);
      expect(STUDENT_PLAN.is_template).toBe(original.is_template);
      expect(STUDENT_PLAN.student_id).toBe(original.student_id);
      expect(STUDENT_PLAN.start_date).toBe(original.start_date);
      expect(STUDENT_PLAN.sessions[0].date).toBe(original.sessions[0].date);
    });

    it('un plan sin sesiones exporta una plantilla vacía válida', () => {
      const emptyPlan: TrainingPlanForExport = { ...STUDENT_PLAN, id: 99, sessions: [] };
      const result = exportPlanAsTemplate(emptyPlan);
      expect(result.is_template).toBe(true);
      expect(result.sessions).toHaveLength(0);
    });

    it('el coach_id se preserva (la plantilla pertenece al mismo coach)', () => {
      const result = exportPlanAsTemplate(STUDENT_PLAN);
      expect(result.coach_id).toBe('coach-a');
    });

    it('se puede exportar un plan que ya fue importado desde una plantilla', () => {
      const derivedPlan: TrainingPlanForExport = { ...STUDENT_PLAN, id: 77, name: 'Fuerza Junio (importado)' };
      const result = exportPlanAsTemplate(derivedPlan);
      expect(result.is_template).toBe(true);
      expect(result.name).toBe('Fuerza Junio (importado) (Copia)');
    });

    it('duplicatePlan sin targetStudentId crea una plantilla', () => {
      const plan = { id: 5, name: 'Fuerza Julio', student_id: 'student-x', sessions: [] };
      const result = simulateDuplicatePlan(plan);
      expect(result.is_template).toBe(true);
      expect(result.student_id).toBeNull();
      expect(result.name).toBe('Fuerza Julio (Copia)');
    });

    it('duplicatePlan con targetStudentId crea un plan de alumno', () => {
      const plan = { id: 5, name: 'Fuerza Julio', student_id: 'student-x', sessions: [] };
      const result = simulateDuplicatePlan(plan, 'student-y');
      expect(result.is_template).toBe(false);
      expect(result.student_id).toBe('student-y');
      expect(result.name).toBe('Fuerza Julio');
    });

    it('duplicatePlan sin targetStudentId: student_id es null', () => {
      const plan = { id: 10, name: 'Potencia', student_id: 'student-z', sessions: [] };
      const result = simulateDuplicatePlan(plan);
      expect(result.student_id).toBeNull();
    });

    it('el nombre de la copia incluye "(Copia)" cuando no hay alumno destino', () => {
      const plan = { id: 1, name: 'Plan Base', student_id: null, sessions: [] };
      const result = simulateDuplicatePlan(plan);
      expect(result.name).toContain('(Copia)');
    });

    it('duplicatePlan con targetStudentId mantiene el nombre original sin "(Copia)"', () => {
      const plan = { id: 5, name: 'Fuerza Agosto', student_id: 'student-a', sessions: [] };
      const result = simulateDuplicatePlan(plan, 'student-b');
      expect(result.name).toBe('Fuerza Agosto');
      expect(result.name).not.toContain('(Copia)');
    });

    // ── Validación de estructura uniforme al exportar ──
    describe('Validación de semanas uniformes al exportar como plantilla', () => {
      type SessionForUniformity = { week_number: number };

      function validatePlanUniformity(sessions: SessionForUniformity[]): {
        isUniform: boolean;
        detail?: string;
      } {
        const weekCounts = new Map<number, number>();
        for (const s of sessions) {
          weekCounts.set(s.week_number, (weekCounts.get(s.week_number) ?? 0) + 1);
        }
        const counts = [...weekCounts.values()];
        if (counts.length <= 1 || counts.every(c => c === counts[0])) {
          return { isUniform: true };
        }
        const detail = [...weekCounts.entries()]
          .sort(([a], [b]) => a - b)
          .map(([wk, n]) => `Semana ${wk}: ${n} días`)
          .join(', ');
        return { isUniform: false, detail };
      }

      it('plan con todas las semanas iguales puede exportarse como plantilla', () => {
        const sessions: SessionForUniformity[] = [
          { week_number: 1 }, { week_number: 1 }, { week_number: 1 },
          { week_number: 2 }, { week_number: 2 }, { week_number: 2 },
        ];
        expect(validatePlanUniformity(sessions).isUniform).toBe(true);
      });

      it('plan con semanas desiguales no puede exportarse como plantilla', () => {
        const sessions: SessionForUniformity[] = [
          { week_number: 1 }, { week_number: 1 },
          { week_number: 2 }, { week_number: 2 }, { week_number: 2 },
        ];
        const result = validatePlanUniformity(sessions);
        expect(result.isUniform).toBe(false);
        expect(result.detail).toContain('Semana 1');
        expect(result.detail).toContain('Semana 2');
      });

      it('el detalle del error menciona cuántos días tiene cada semana', () => {
        const sessions: SessionForUniformity[] = [
          { week_number: 1 }, { week_number: 1 },
          { week_number: 2 }, { week_number: 2 }, { week_number: 2 },
        ];
        const { detail } = validatePlanUniformity(sessions);
        expect(detail).toBe('Semana 1: 2 días, Semana 2: 3 días');
      });

      it('plan con una sola semana siempre puede exportarse', () => {
        const sessions: SessionForUniformity[] = [
          { week_number: 1 }, { week_number: 1 }, { week_number: 1 },
        ];
        expect(validatePlanUniformity(sessions).isUniform).toBe(true);
      });

      it('plan vacío (sin sesiones) puede exportarse', () => {
        expect(validatePlanUniformity([]).isUniform).toBe(true);
      });

      it('3 semanas con 2 iguales y 1 distinta → no uniforme', () => {
        const sessions: SessionForUniformity[] = [
          { week_number: 1 }, { week_number: 1 },
          { week_number: 2 }, { week_number: 2 },
          { week_number: 3 }, { week_number: 3 }, { week_number: 3 },
        ];
        const result = validatePlanUniformity(sessions);
        expect(result.isUniform).toBe(false);
        expect(result.detail).toContain('Semana 3');
      });

      it('duplicar hacia un alumno no valida la uniformidad (planes pueden ser desiguales)', () => {
        // Al copiar plan a alumno (targetStudentId presente), no se aplica la restricción
        const plan = { id: 5, name: 'Plan', student_id: 'student-a', sessions: [] };
        const result = simulateDuplicatePlan(plan, 'student-b');
        expect(result.is_template).toBe(false);
      });
    });
  });
});
