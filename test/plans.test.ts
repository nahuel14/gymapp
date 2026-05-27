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
