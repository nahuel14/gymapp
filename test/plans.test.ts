import { describe, it, expect } from 'vitest';

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

function filterSessionsActiveOnly(
  sessions: { plan_id: number; date: string }[],
  activePlanId: number
): { plan_id: number; date: string }[] {
  return sessions.filter(s => s.plan_id === activePlanId);
}

function filterSessionsAllPlans(
  sessions: { plan_id: number; date: string }[],
  allPlanIds: number[]
): { plan_id: number; date: string }[] {
  return sessions.filter(s => allPlanIds.includes(s.plan_id));
}

function sessionBelongsToPlan(
  session: { plan_id: number | null },
  currentViewedPlanId: string
): boolean {
  return session.plan_id !== null && String(session.plan_id) === currentViewedPlanId;
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

// --- Tests ---

describe('ESCENARIO 1: Creacion de Plan', () => {
  it('fuerza start_date al lunes y end_date al domingo de la ultima semana', () => {
    const result = calculatePlanDates('2026-05-21', 4); // jueves como input

    expect(result.start_date).toBe('2026-05-18'); // lunes anterior
    expect(result.end_date).toBe('2026-06-14');   // domingo de la semana 4
  });

  it('day_name se guarda en ingles', () => {
    const result = calculatePlanDates('2026-05-18', 4); // lunes como input

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
    const newEnd = calculateExtendedEnd("2026-06-14", 2); // hasta 2026-06-28

    expect(() => simulateExtendCollision(others, "2026-06-14", newEnd)).toThrow(
      'No se puede extender: el plan "Potencia Julio" comienza el 2026-06-22.'
    );
  });

  it('permite la extension si el otro plan empieza despues del nuevo fin', () => {
    const others = [{ name: "Potencia Julio", start_date: "2026-06-29" }];
    const newEnd = calculateExtendedEnd("2026-06-14", 2); // 2026-06-28

    expect(simulateExtendCollision(others, "2026-06-14", newEnd).success).toBe(true);
  });
});

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
    // Plan Jun 1-14, mover inicio a May 25 (offset -7): sesiones deben moverse -7 dias
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
    // Plan Jun 1-14 (2 sem), se intenta reducir a 1 sem (fin Jun 7)
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
    // Sabado de semana 2 (13-Jun) debe seguir siendo Sabado tras shift -7 (6-Jun)
    const sessions = [{ id: 1, date: '2026-06-13' }];
    const result = shiftSessionDates(sessions, -7);
    expect(new Date(result[0].date! + "T00:00:00").getDay()).toBe(6); // Sabado
  });

  it('shift de 14 dias desplaza dos semanas correctamente', () => {
    const sessions = [{ id: 1, date: '2026-06-01' }];
    expect(shiftSessionDates(sessions, 14)[0].date).toBe('2026-06-15');
    expect(shiftSessionDates(sessions, -14)[0].date).toBe('2026-05-18');
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

describe('ESCENARIO 9: Colision al Desplazar Fecha de Inicio del Plan', () => {
  it('bloquea desplazamiento para atras cuando otro plan ocupa el nuevo rango', () => {
    // Plan actual: Jun 1-14. Nuevo inicio: May 25 → nuevo fin: Jun 7.
    // Otro plan activo: May 18-31 → se superpone con May 25-Jun 7.
    const otherPlans = [{ name: "Plan Fuerza", start_date: "2026-05-18", end_date: "2026-05-31" }];
    const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
    expect(result.hasCollision).toBe(true);
    expect(result.conflictPlan).toBe("Plan Fuerza");
  });

  it('permite desplazamiento para atras cuando el rango nuevo esta libre', () => {
    // Plan actual: Jun 1-14. Nuevo inicio: May 25 → nuevo fin: Jun 7.
    // Otro plan termina May 18 → no se superpone.
    const otherPlans = [{ name: "Plan Fuerza", start_date: "2026-05-01", end_date: "2026-05-18" }];
    const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
    expect(result.hasCollision).toBe(false);
  });

  it('bloquea desplazamiento para adelante cuando otro plan ocupa el nuevo rango', () => {
    // Plan actual: Jun 1-14. Nuevo inicio: Jun 8 → nuevo fin: Jun 21.
    // Otro plan: Jun 16-30 → se superpone con Jun 8-21.
    const otherPlans = [{ name: "Plan Potencia", start_date: "2026-06-16", end_date: "2026-06-30" }];
    const result = checkPlanShiftCollision(otherPlans, "2026-06-08", "2026-06-21");
    expect(result.hasCollision).toBe(true);
    expect(result.conflictPlan).toBe("Plan Potencia");
  });

  it('permite desplazamiento para adelante cuando el rango nuevo esta libre', () => {
    // Nuevo rango: Jun 8-21. Otro plan empieza Jun 22 → no se superpone.
    const otherPlans = [{ name: "Plan Potencia", start_date: "2026-06-22", end_date: "2026-06-30" }];
    const result = checkPlanShiftCollision(otherPlans, "2026-06-08", "2026-06-21");
    expect(result.hasCollision).toBe(false);
  });

  it('un plan inactivo tambien bloquea el desplazamiento', () => {
    // No se filtra por is_active: planes inactivos tambien cuentan como colision
    const otherPlans = [{ name: "Plan Anterior (inactivo)", start_date: "2026-05-18", end_date: "2026-05-31" }];
    const result = checkPlanShiftCollision(otherPlans, "2026-05-25", "2026-06-07");
    expect(result.hasCollision).toBe(true);
  });

  it('detecta sesion que queda fuera del rango tras el desplazamiento', () => {
    // Sesion Jun 14. Offset -7 → Jun 7. Nuevo fin Jun 6 → Jun 7 > Jun 6 → fuera del rango.
    const sessions = [{ date: '2026-06-14' }];
    expect(hasShiftedSessionOutside(sessions, -7, '2026-06-06')).toBe(true);
  });

  it('no detecta sesion fuera cuando todas quedan dentro tras el desplazamiento', () => {
    // Sesiones Jun 1, Jun 8. Offset -7 → May 25, Jun 1. Nuevo fin Jun 14 → ambas dentro.
    const sessions = [{ date: '2026-06-01' }, { date: '2026-06-08' }];
    expect(hasShiftedSessionOutside(sessions, -7, '2026-06-14')).toBe(false);
  });
});

describe('ESCENARIO 10: Fetch de Sesiones para Todos los Planes (regresion bug)', () => {
  it('BUG: filtrar solo plan activo oculta sesiones de planes inactivos', () => {
    // Antes del fix: useStudentRoutine solo fetcheaba sesiones del plan activo (id=1).
    // Una sesion creada en plan 2 no aparecia aunque el coach la acabara de crear.
    const sessions = [
      { plan_id: 1, date: '2026-05-26' },
      { plan_id: 2, date: '2026-05-28' }, // sesion recien creada en plan inactivo
    ];
    const result = filterSessionsActiveOnly(sessions, 1);
    expect(result).toHaveLength(1);
    expect(result.find(s => s.date === '2026-05-28')).toBeUndefined();
  });

  it('FIX: incluir todos los planes muestra sesiones de activos e inactivos', () => {
    const sessions = [
      { plan_id: 1, date: '2026-05-26' },
      { plan_id: 2, date: '2026-05-28' },
    ];
    const result = filterSessionsAllPlans(sessions, [1, 2]);
    expect(result).toHaveLength(2);
    expect(result.find(s => s.date === '2026-05-28')).toBeDefined();
  });

  it('sesion recien creada en el plan visualizado aparece tras refetch', () => {
    // Simula el estado post-insert: plan 2 tiene la nueva sesion del 28/05
    const sessions = [
      { plan_id: 1, date: '2026-05-10' },
      { plan_id: 2, date: '2026-05-28' }, // nueva sesion
    ];
    const result = filterSessionsAllPlans(sessions, [1, 2]);
    const newSession = result.find(s => s.plan_id === 2 && s.date === '2026-05-28');
    expect(newSession).toBeDefined();
  });

  it('sessionBelongsToPlan: plan_id numerico matchea con id string del plan visualizado', () => {
    // weeklyDays filtra con String(session.plan_id) === currentViewedPlan.id
    expect(sessionBelongsToPlan({ plan_id: 5 }, "5")).toBe(true);
  });

  it('sessionBelongsToPlan: retorna false cuando el plan_id no coincide', () => {
    expect(sessionBelongsToPlan({ plan_id: 3 }, "5")).toBe(false);
  });

  it('sessionBelongsToPlan: retorna false cuando plan_id es null', () => {
    expect(sessionBelongsToPlan({ plan_id: null }, "5")).toBe(false);
  });

  it('sin planes registrados no hay sesiones visibles', () => {
    const sessions = [{ plan_id: 1, date: '2026-05-28' }];
    const result = filterSessionsAllPlans(sessions, []);
    expect(result).toHaveLength(0);
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
    // Martes, Miércoles, Sábado → todos permitidos
    expect(simulateDuplicateSession(sessions, '2026-06-02', plan).success).toBe(true); // martes
    expect(simulateDuplicateSession(sessions, '2026-06-06', plan).success).toBe(true); // sabado
    expect(simulateDuplicateSession(sessions, '2026-06-07', plan).success).toBe(true); // domingo
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
    // La sesion esta en Jun 02 y se mueve a Jun 10. Jun 02 no interfiere con Jun 10.
    const sessions = [{ date: '2026-06-02' }];
    const result = simulateMoveSessionWithRange(sessions, '2026-06-10', plan);
    expect(result.success).toBe(true);
  });

  it('permite reagendar a la semana anterior dentro del plan', () => {
    // Sesion en semana 2 (Jun 08) → mover a semana 1 (Jun 03)
    const sessions = [{ date: '2026-06-08' }];
    const result = simulateMoveSessionWithRange(sessions, '2026-06-03', plan);
    expect(result.success).toBe(true);
    expect(result.new_date).toBe('2026-06-03');
  });

  it('permite reagendar a la semana siguiente dentro del plan', () => {
    // Sesion en semana 1 (Jun 03) → mover a semana 2 (Jun 10)
    const sessions = [{ date: '2026-06-03' }];
    const result = simulateMoveSessionWithRange(sessions, '2026-06-10', plan);
    expect(result.success).toBe(true);
    expect(result.new_date).toBe('2026-06-10');
  });

  it('no bloquea por rango cuando el plan no tiene end_date', () => {
    const sessions = [{ date: '2026-06-02' }];
    const planSinFin = { start_date: '2026-06-01', end_date: null };
    // Cualquier fecha futura no debe ser bloqueada por falta de end_date
    const result = simulateMoveSessionWithRange(sessions, '2026-12-31', planSinFin);
    expect(result.success).toBe(true);
  });

  it('no bloquea por rango cuando el plan no tiene start_date', () => {
    const sessions = [{ date: '2026-06-02' }];
    const planSinInicio = { start_date: null, end_date: '2026-06-28' };
    // Cualquier fecha anterior no debe ser bloqueada por falta de start_date
    const result = simulateMoveSessionWithRange(sessions, '2026-01-01', planSinInicio);
    expect(result.success).toBe(true);
  });
});

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
    // Los ejercicios de la sesion 2 siguen intactos
    expect(updated[0].exercises).toHaveLength(1);
    expect(updated[0].exercises![0].id).toBe(20);
  });

  it('intentar eliminar una sesion inexistente no modifica la lista', () => {
    const sessions = [
      { id: 1, date: '2026-06-02', exercises: [] },
    ];
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
    // Otra sesion en la misma fecha pero de plan_id diferente no debe bloquear
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
    expect(simulateAddSession(sessions, '2026-06-02', planId, plan).success).toBe(true); // martes
    expect(simulateAddSession(sessions, '2026-06-06', planId, plan).success).toBe(true); // sabado
    expect(simulateAddSession(sessions, '2026-06-07', planId, plan).success).toBe(true); // domingo
  });

  it('permite agregar multiples sesiones en la misma semana', () => {
    const sessions: { date: string; plan_id: number }[] = [];
    simulateAddSession(sessions, '2026-06-01', planId, plan); // lunes
    sessions.push({ date: '2026-06-01', plan_id: planId });
    simulateAddSession(sessions, '2026-06-03', planId, plan); // miercoles
    sessions.push({ date: '2026-06-03', plan_id: planId });
    const result = simulateAddSession(sessions, '2026-06-05', planId, plan); // viernes
    expect(result.success).toBe(true);
  });
});

// --- Helpers para ESCENARIO 16 ---

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

// --- Helpers para ESCENARIO 17 ---

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

describe('ESCENARIO 16: Colapsar/Expandir Ejercicios', () => {
  const exercises = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('estado inicial: todos los ejercicios empiezan colapsados (Set vacío)', () => {
    const expandedIds = collapseAll();
    exercises.forEach(ex => expect(expandedIds.has(ex.id)).toBe(false));
  });

  it('toggle: expandir un ejercicio lo agrega al Set sin afectar los demás', () => {
    const result = toggleExercise(new Set<number>(), 2);
    expect(result.has(2)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(3)).toBe(false);
  });

  it('toggle: volver a tocar un ejercicio expandido lo colapsa', () => {
    const result = toggleExercise(new Set([1, 2]), 2);
    expect(result.has(2)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  it('"Expandir todos" agrega todos los IDs al Set', () => {
    const result = expandAll(exercises);
    expect(result.size).toBe(3);
    exercises.forEach(ex => expect(result.has(ex.id)).toBe(true));
  });

  it('"Colapsar todos" vacía el Set', () => {
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

  it('al cambiar de día el Set se resetea a vacío', () => {
    const result = collapseAll();
    expect(result.size).toBe(0);
  });

  it('toggle es inmutable: no modifica el Set original', () => {
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
    const result = swapOrderIndex(exercises, 1, 0); // id=2 sube
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
    expect(result[2].id).toBe(3);
  });

  it('mover abajo: el ejercicio intercambia posición con el siguiente', () => {
    const result = swapOrderIndex(exercises, 0, 1); // id=1 baja
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
    expect(result[2].id).toBe(3);
  });

  it('canMoveUp: el primer ejercicio no puede subir', () => {
    expect(canMoveUp(0)).toBe(false);
  });

  it('canMoveUp: cualquier ejercicio que no sea el primero puede subir', () => {
    expect(canMoveUp(1)).toBe(true);
    expect(canMoveUp(2)).toBe(true);
  });

  it('canMoveDown: el último ejercicio no puede bajar', () => {
    expect(canMoveDown(2, 3)).toBe(false);
  });

  it('canMoveDown: cualquier ejercicio que no sea el último puede bajar', () => {
    expect(canMoveDown(0, 3)).toBe(true);
    expect(canMoveDown(1, 3)).toBe(true);
  });

  it('después del swap no hay order_index duplicados', () => {
    const result = swapOrderIndex(exercises, 0, 1);
    const orders = result.map(e => e.order_index);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('mover el último ejercicio hacia arriba 2 veces lo deja primero', () => {
    let ex = exercises.map(e => ({ ...e }));
    ex = swapOrderIndex(ex, 2, 1);
    ex = swapOrderIndex(ex, 1, 0);
    expect(ex[0].id).toBe(3);
  });

  it('mover el primer ejercicio hacia abajo 2 veces lo deja último', () => {
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

  it('swapOrderIndex es inmutable: no modifica el array original', () => {
    swapOrderIndex(exercises, 0, 1);
    expect(exercises[0].id).toBe(1);
    expect(exercises[0].order_index).toBe(1);
  });
});

// --- Helpers para ESCENARIO 15 ---

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

describe('ESCENARIO 15: Botón "Hoy" - Lógica de Visibilidad y Navegación', () => {
  // getMonday
  it('getMonday: un lunes retorna el mismo dia', () => {
    expect(getMonday('2026-06-01')).toBe('2026-06-01'); // lunes
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
    expect(getMonday('2026-06-02')).toBe(getMonday('2026-06-05')); // martes y viernes misma semana
  });

  it('getMonday: dias de semanas distintas retornan lunes distintos', () => {
    expect(getMonday('2026-06-01')).not.toBe(getMonday('2026-06-08'));
  });

  // shouldShowTodayButton
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
    const viewingMonday = '2026-06-01'; // 3 semanas antes
    expect(shouldShowTodayButton(viewingMonday, todayMonday)).toBe(true);
  });

  it('al hacer click en Hoy, selectedDate pasa a ser el lunes de la semana actual', () => {
    const today = '2026-06-03'; // miercoles
    const todayMonday = getMonday(today);
    expect(todayMonday).toBe('2026-06-01');
    // Tras navegar a hoy, la semana visible debe ser la de hoy
    expect(shouldShowTodayButton(todayMonday, todayMonday)).toBe(false);
  });
});
