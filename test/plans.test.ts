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
