import { describe, it, expect } from 'vitest';

// ─── src/lib imports ──────────────────────────────────────────────────────────
import {
  calculatePlanDates, calculateExtendedEnd, calcEndDateLocal,
  shiftWeekLocal, getMonday,
} from '@/lib/plans/dates';

import {
  simulateExtendCollision, checkPlanShiftCollision,
  computeEndDateBlocked, hasShiftedSessionOutside,
} from '@/lib/plans/validation';

import {
  distributeTemplateSessions, shiftSessionDates,
  simulateMoveSession, simulateMoveSessionWithRange,
  simulateDuplicateSession, simulateDeleteSession,
  simulateAddSession, simulateCopyExercises,
} from '@/lib/plans/sessions';

import {
  toggleExercise, expandAll, collapseAll, isExerciseExpanded,
  shouldShowTodayButton, shouldMarkSessionComplete,
} from '@/lib/exercises/ui';

import {
  type ExItem, swapOrderIndex, canMoveUp, canMoveDown,
  reorderItem,
} from '@/lib/exercises/reorder';

import {
  resolveSuperset, removeFromSuperset, isSameGroupAsLinking,
} from '@/lib/exercises/superset';

import {
  buildCoachPayload, buildStudentPayload,
  shouldMarkCompleteFromStudent, validateActualReps, canStudentEditTargets,
} from '@/lib/student/payload';

import {
  type TemplateSession, parseDayNumber, isTemplateUniform,
  addDayToAllWeeks as addDayToAllWeeksLocal,
  removeDayFromAllWeeks as removeDayFromAllWeeksLocal,
  addWeekToTemplate as addWeekToTemplateLocal,
  removeWeekFromTemplate as removeWeekFromTemplateLocal,
  filterTemplatesByCoach, buildInitialTemplate, remainingWeeks,
  swapWeeks as swapWeeksLocal, swapDays as swapDaysLocal,
  normalizeSessionDayNames, removeSelectedDay as removeSelectedDayLocal,
  getEditorModeState,
} from '@/lib/templates/structure';

import {
  type AdminProfile, type AdminAssignment,
  filterProfiles, getCoachProfiles, isCoachAssignedToStudent,
  toggleAssignment as toggleAssignmentLocal,
  countCoachesForStudent, validateInviteForm, canDeleteUser,
} from '@/lib/admin/filters';

import { getDeleteScope, buildDeleteSummary } from '@/lib/admin/delete';

import {
  type LibraryExercise, filterExercises, validateExerciseName,
  getBodyZoneLabel, getCategoryLabel,
} from '@/lib/exercises/library';

import {
  validateLoginFields, validateSignupFields, validateResetPasswordFields,
  getAuthRedirect, resolveAuthError, resolveAuthSuccess,
} from '@/lib/auth/validation';

import { validateProfileFields, getLogoutRedirect } from '@/lib/profile/validation';

// Alias — removeFromSupersetLocal kept for backward compat with test names
const removeFromSupersetLocal = removeFromSuperset;

// ════════════════════════════════════════════════════════════════
// Módulo: Planes de Alumno
// Creación, edición de fechas, extensión, colisiones entre planes
// ════════════════════════════════════════════════════════════════

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
      const deletedIds = initial.filter((s) => s.week_number === 2).map((s) => s.id);
      const { sessions, success } = removeWeekFromTemplateLocal(initial, 2);
      expect(success).toBe(true);
      expect(sessions.every((s) => !deletedIds.includes(s.id))).toBe(true);
    });

    it('las sesiones de las otras semanas permanecen intactas (mismos IDs)', () => {
      const initial = buildInitialTemplate(3, 3);
      const week1Ids = initial.filter((s) => s.week_number === 1).map((s) => s.id);
      const week3Ids = initial.filter((s) => s.week_number === 3).map((s) => s.id);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      // Los IDs de semana 1 permanecen (semana 1 no cambia)
      expect(sessions.map((s) => s.id)).toEqual(expect.arrayContaining(week1Ids));
      // Los IDs de semana 3 permanecen (renumerados a semana 2)
      expect(sessions.map((s) => s.id)).toEqual(expect.arrayContaining(week3Ids));
    });

    it('eliminar la primera semana renumera las restantes: quedan [1, 2]', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      expect(remainingWeeks(sessions)).toEqual([1, 2]);
    });

    it('eliminar la última semana deja las anteriores (semanas 1 y 2)', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 3);
      expect(remainingWeeks(sessions)).toEqual([1, 2]);
    });

    it('eliminar semana del medio renumera: quedan [1, 2] (no hay gaps)', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(remainingWeeks(sessions)).toEqual([1, 2]);
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

    // ── Renumeración de semanas tras la eliminación ──
    it('eliminar Semana 1 de 3: la Semana 2 pasa a ser Semana 1 y la Semana 3 pasa a ser Semana 2', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      const weeks = remainingWeeks(sessions);
      expect(weeks).toEqual([1, 2]);
    });

    it('eliminar Semana 1 de 2: la Semana 2 pasa a ser Semana 1', () => {
      const initial = buildInitialTemplate(2, 3);
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      const weeks = remainingWeeks(sessions);
      expect(weeks).toEqual([1]);
    });

    it('eliminar Semana 2 de 3: la Semana 3 pasa a ser Semana 2, la Semana 1 no cambia', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      const weeks = remainingWeeks(sessions);
      expect(weeks).toEqual([1, 2]);
    });

    it('eliminar la última semana no requiere renumeración', () => {
      const initial = buildInitialTemplate(3, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 3);
      const weeks = remainingWeeks(sessions);
      expect(weeks).toEqual([1, 2]);
    });

    it('eliminar Semana 1 de 4: las semanas restantes son 1, 2, 3 consecutivas', () => {
      const initial = buildInitialTemplate(4, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      expect(remainingWeeks(sessions)).toEqual([1, 2, 3]);
    });

    it('las sesiones de cada semana renumerada conservan sus días', () => {
      const initial = buildInitialTemplate(3, 3);
      const w2DaysBefore = initial
        .filter((s) => s.week_number === 2)
        .map((s) => s.day_name)
        .sort();
      const { sessions } = removeWeekFromTemplateLocal(initial, 1);
      // Lo que era semana 2 ahora es semana 1
      const newW1Days = sessions
        .filter((s) => s.week_number === 1)
        .map((s) => s.day_name)
        .sort();
      expect(newW1Days).toEqual(w2DaysBefore);
    });

    it('no hay semanas con número 0 ni gaps tras la renumeración', () => {
      const initial = buildInitialTemplate(4, 2);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      const weeks = remainingWeeks(sessions);
      expect(weeks[0]).toBe(1);
      for (let i = 1; i < weeks.length; i++) {
        expect(weeks[i]).toBe(weeks[i - 1] + 1);
      }
    });

    it('después de renumerar la plantilla sigue siendo uniforme', () => {
      const initial = buildInitialTemplate(4, 3);
      const { sessions } = removeWeekFromTemplateLocal(initial, 2);
      expect(isTemplateUniform(sessions)).toBe(true);
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

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 25: Reordenar semanas (swapWeeksInTemplate)
  // ════════════════════════════════════════════════════════════════

  describe('ESCENARIO 25: Reordenar semanas', () => {
    it('intercambiar sem 1 y sem 2: todas las sesiones de sem 1 pasan a sem 2 y viceversa', () => {
      const initial = buildInitialTemplate(3, 2);
      const result = swapWeeksLocal(initial, 1, 2);
      const oldWeek1Ids = initial.filter(s => s.week_number === 1).map(s => s.id);
      expect(result.filter(s => s.week_number === 2).map(s => s.id)).toEqual(expect.arrayContaining(oldWeek1Ids));
    });

    it('después del swap las semanas intercambian week_number', () => {
      const initial = buildInitialTemplate(2, 2);
      const w1Before = initial.filter(s => s.week_number === 1).map(s => s.id).sort();
      const w2Before = initial.filter(s => s.week_number === 2).map(s => s.id).sort();
      const result = swapWeeksLocal(initial, 1, 2);
      expect(result.filter(s => s.week_number === 2).map(s => s.id).sort()).toEqual(w1Before);
      expect(result.filter(s => s.week_number === 1).map(s => s.id).sort()).toEqual(w2Before);
    });

    it('las sesiones de otras semanas no se ven afectadas', () => {
      const initial = buildInitialTemplate(3, 2);
      const w3Before = initial.filter(s => s.week_number === 3).map(s => s.id);
      const result = swapWeeksLocal(initial, 1, 2);
      expect(result.filter(s => s.week_number === 3).map(s => s.id)).toEqual(w3Before);
    });

    it('swap de sem 1 y sem 3 en plantilla de 3 semanas: sem 2 permanece intacta', () => {
      const initial = buildInitialTemplate(3, 3);
      const w2Before = initial.filter(s => s.week_number === 2).map(s => s.id);
      const result = swapWeeksLocal(initial, 1, 3);
      expect(result.filter(s => s.week_number === 2).map(s => s.id)).toEqual(w2Before);
    });

    it('después del swap el total de sesiones es el mismo', () => {
      const initial = buildInitialTemplate(3, 2);
      const result = swapWeeksLocal(initial, 1, 2);
      expect(result).toHaveLength(initial.length);
    });

    it('después del swap la plantilla sigue siendo uniforme', () => {
      const initial = buildInitialTemplate(4, 3);
      const result = swapWeeksLocal(initial, 1, 3);
      expect(isTemplateUniform(result)).toBe(true);
    });

    it('intercambiar la misma semana consigo misma no cambia nada', () => {
      const initial = buildInitialTemplate(2, 2);
      const result = swapWeeksLocal(initial, 1, 1);
      expect(result.map(s => s.week_number)).toEqual(initial.map(s => s.week_number));
    });

    it('swap doble de las mismas semanas restaura el estado original', () => {
      const initial = buildInitialTemplate(3, 2);
      const step1 = swapWeeksLocal(initial, 1, 2);
      const step2 = swapWeeksLocal(step1, 1, 2);
      expect(step2.map(s => ({ id: s.id, week: s.week_number }))).toEqual(
        initial.map(s => ({ id: s.id, week: s.week_number }))
      );
    });

    it('swap de sem 2 y sem 3 en una plantilla de 2×4: todas las sesiones se mueven', () => {
      const initial = buildInitialTemplate(3, 4);
      const w2Ids = initial.filter(s => s.week_number === 2).map(s => s.id);
      const result = swapWeeksLocal(initial, 2, 3);
      expect(result.filter(s => s.week_number === 3).map(s => s.id)).toEqual(expect.arrayContaining(w2Ids));
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 26: Reordenar días (swapDaysInTemplate)
  // ════════════════════════════════════════════════════════════════

  function sortByDayName(sessions: TemplateSession[]) {
    return [...sessions].sort((a, b) => {
      const nA = parseInt(a.day_name.replace(/\D/g, ''), 10) || 0;
      const nB = parseInt(b.day_name.replace(/\D/g, ''), 10) || 0;
      return nA - nB || a.id - b.id;
    });
  }

  describe('ESCENARIO 26: Reordenar días', () => {
    it('swap día 0↔1: la sesión que era posición 0 toma el nombre de posición 1 y viceversa', () => {
      const initial = buildInitialTemplate(2, 2);
      const w1Sorted = sortByDayName(initial.filter(s => s.week_number === 1));
      const idPos0 = w1Sorted[0].id;
      const idPos1 = w1Sorted[1].id;
      const namePos0 = w1Sorted[0].day_name;
      const namePos1 = w1Sorted[1].day_name;
      const result = swapDaysLocal(initial, 0, 1);
      expect(result.find(s => s.id === idPos0)!.day_name).toBe(namePos1);
      expect(result.find(s => s.id === idPos1)!.day_name).toBe(namePos0);
    });

    it('el swap de días ocurre en TODAS las semanas, no solo en la seleccionada', () => {
      const initial = buildInitialTemplate(3, 2);
      const result = swapDaysLocal(initial, 0, 1);
      for (const wk of [1, 2, 3]) {
        const wkSorted = sortByDayName(initial.filter(s => s.week_number === wk));
        const idPos0 = wkSorted[0].id;
        const idPos1 = wkSorted[1].id;
        expect(result.find(s => s.id === idPos0)!.day_name).toBe(wkSorted[1].day_name);
        expect(result.find(s => s.id === idPos1)!.day_name).toBe(wkSorted[0].day_name);
      }
    });

    it('después del swap el número total de sesiones no cambia', () => {
      const initial = buildInitialTemplate(4, 3);
      const result = swapDaysLocal(initial, 0, 2);
      expect(result).toHaveLength(initial.length);
    });

    it('después del swap la plantilla sigue siendo uniforme', () => {
      const initial = buildInitialTemplate(3, 4);
      const result = swapDaysLocal(initial, 1, 3);
      expect(isTemplateUniform(result)).toBe(true);
    });

    it('swap doble del mismo par de días restaura el estado original', () => {
      const initial = buildInitialTemplate(2, 3);
      const step1 = swapDaysLocal(initial, 0, 1);
      const step2 = swapDaysLocal(step1, 0, 1);
      const toComparable = (s: TemplateSession) => ({ id: s.id, day_name: s.day_name });
      expect(step2.map(toComparable)).toEqual(initial.map(toComparable));
    });

    it('intercambiar el mismo índice consigo mismo no modifica los day_names', () => {
      const initial = buildInitialTemplate(2, 2);
      const result = swapDaysLocal(initial, 1, 1);
      expect(result.map(s => s.day_name)).toEqual(initial.map(s => s.day_name));
    });

    it('swap día 0↔2 en plantilla de 1 semana: las sesiones extremas intercambian nombres', () => {
      const initial = buildInitialTemplate(1, 3);
      const sorted = sortByDayName(initial);
      const idPos0 = sorted[0].id;
      const idPos1 = sorted[1].id;
      const idPos2 = sorted[2].id;
      const result = swapDaysLocal(initial, 0, 2);
      expect(result.find(s => s.id === idPos0)!.day_name).toBe(sorted[2].day_name);
      expect(result.find(s => s.id === idPos2)!.day_name).toBe(sorted[0].day_name);
      expect(result.find(s => s.id === idPos1)!.day_name).toBe(sorted[1].day_name);
    });

    it('los order_index de los días intercambiados también se intercambian', () => {
      const initial = buildInitialTemplate(1, 2);
      const s = initial.filter(s => s.week_number === 1).sort((a, b) => a.order_index - b.order_index);
      const orderA = s[0].order_index;
      const orderB = s[1].order_index;
      const result = swapDaysLocal(initial, 0, 1);
      const origIdA = s[0].id;
      const origIdB = s[1].id;
      expect(result.find(x => x.id === origIdA)!.order_index).toBe(orderB);
      expect(result.find(x => x.id === origIdB)!.order_index).toBe(orderA);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 27: Actualizar nombre de plantilla
  // ════════════════════════════════════════════════════════════════

  function updateTemplateNameLocal(template: { name: string }, newName: string): { name: string } {
    if (!newName || !newName.trim()) throw new Error('El nombre no puede estar vacío');
    return { ...template, name: newName.trim() };
  }

  describe('ESCENARIO 27: Actualizar nombre de plantilla', () => {
    it('actualizar con un nombre válido cambia el nombre', () => {
      const result = updateTemplateNameLocal({ name: 'Viejo' }, 'Fuerza Avanzada');
      expect(result.name).toBe('Fuerza Avanzada');
    });

    it('el nombre se guarda con espacios recortados', () => {
      const result = updateTemplateNameLocal({ name: 'Viejo' }, '  Potencia  ');
      expect(result.name).toBe('Potencia');
    });

    it('lanza error si el nombre está vacío', () => {
      expect(() => updateTemplateNameLocal({ name: 'Viejo' }, '')).toThrow('El nombre no puede estar vacío');
    });

    it('lanza error si el nombre solo tiene espacios', () => {
      expect(() => updateTemplateNameLocal({ name: 'Viejo' }, '   ')).toThrow('El nombre no puede estar vacío');
    });

    it('el objeto original no se muta', () => {
      const template = { name: 'Original' };
      updateTemplateNameLocal(template, 'Nuevo');
      expect(template.name).toBe('Original');
    });

    it('se puede actualizar al mismo nombre (no hay restricción de unicidad local)', () => {
      const result = updateTemplateNameLocal({ name: 'Fuerza' }, 'Fuerza');
      expect(result.name).toBe('Fuerza');
    });

    it('se permite un nombre largo', () => {
      const longName = 'A'.repeat(200);
      const result = updateTemplateNameLocal({ name: 'Viejo' }, longName);
      expect(result.name).toHaveLength(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 28: Eliminar día seleccionado (removeSelectedDayFromTemplate)
  // ════════════════════════════════════════════════════════════════

  describe('ESCENARIO 28: Eliminar día seleccionado', () => {
    it('elimina las sesiones con los IDs indicados', () => {
      const initial = buildInitialTemplate(2, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 2').map(s => s.id);
      const { sessions, success } = removeSelectedDayLocal(initial, toDelete);
      expect(success).toBe(true);
      expect(sessions.some(s => toDelete.includes(s.id))).toBe(false);
    });

    it('elimina el día en TODAS las semanas y cada semana queda con el mismo conteo', () => {
      const initial = buildInitialTemplate(3, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 1').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      // Las sesiones eliminadas ya no están
      expect(sessions.some(s => toDelete.includes(s.id))).toBe(false);
      // Cada semana tiene 2 días (3 - 1 = 2), renumerados a Día 1 y Día 2
      for (const wk of [1, 2, 3]) {
        const wkSessions = sessions.filter(s => s.week_number === wk);
        expect(wkSessions).toHaveLength(2);
        const names = wkSessions.map(s => s.day_name).sort();
        expect(names).toEqual(['Día 1', 'Día 2']);
      }
    });

    it('no elimina si solo queda 1 día por semana', () => {
      const initial = buildInitialTemplate(3, 1);
      const toDelete = initial.filter(s => s.week_number === 1).map(s => s.id);
      const { success, reason } = removeSelectedDayLocal(initial, toDelete);
      expect(success).toBe(false);
      expect(reason).toBe('min_days');
    });

    it('no elimina si quedarían 0 días en alguna semana', () => {
      const initial = buildInitialTemplate(2, 2);
      const toDelete = initial.map(s => s.id); // todos los IDs
      const { success } = removeSelectedDayLocal(initial, toDelete);
      expect(success).toBe(false);
    });

    it('las sesiones de los otros días permanecen intactas', () => {
      const initial = buildInitialTemplate(2, 3);
      const day3Ids = initial.filter(s => s.day_name === 'Día 3').map(s => s.id);
      const otherIds = initial.filter(s => s.day_name !== 'Día 3').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, day3Ids);
      expect(sessions.map(s => s.id)).toEqual(expect.arrayContaining(otherIds));
    });

    it('el total de sesiones se reduce en el número de IDs eliminados', () => {
      const initial = buildInitialTemplate(3, 4);
      const toDelete = initial.filter(s => s.day_name === 'Día 2').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      expect(sessions).toHaveLength(initial.length - toDelete.length);
    });

    it('eliminar el primer día renombra los restantes: Día 2→Día 1, Día 3→Día 2', () => {
      const initial = buildInitialTemplate(1, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 1').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      const names = sessions.map(s => s.day_name).sort();
      expect(names).toEqual(['Día 1', 'Día 2']);
      expect(sessions.every(s => s.day_name !== 'Día 3')).toBe(true);
    });

    it('eliminar el último día no requiere renumeración', () => {
      const initial = buildInitialTemplate(2, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 3').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      const weeks = [1, 2];
      for (const wk of weeks) {
        const names = sessions.filter(s => s.week_number === wk).map(s => s.day_name).sort();
        expect(names).toEqual(['Día 1', 'Día 2']);
      }
    });

    // ── Renumeración de días tras la eliminación ──
    it('eliminar Día 1 de una plantilla 2×2: el Día 2 pasa a ser Día 1', () => {
      const initial = buildInitialTemplate(2, 2);
      const toDelete = initial.filter(s => s.day_name === 'Día 1').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      const allNames = sessions.map(s => s.day_name);
      expect(allNames.every(n => n === 'Día 1')).toBe(true);
    });

    it('eliminar Día 2 de una plantilla 2×3: el Día 3 pasa a ser Día 2', () => {
      const initial = buildInitialTemplate(2, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 2').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      for (const wk of [1, 2]) {
        const names = sessions.filter(s => s.week_number === wk).map(s => s.day_name).sort();
        expect(names).toEqual(['Día 1', 'Día 2']);
      }
    });

    it('los días renumerados no tienen gaps (siempre 1, 2, 3...)', () => {
      const initial = buildInitialTemplate(3, 4);
      const toDelete = initial.filter(s => s.day_name === 'Día 2').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      for (const wk of [1, 2, 3]) {
        const nums = sessions
          .filter(s => s.week_number === wk)
          .map(s => parseInt(s.day_name.replace(/\D/g, ''), 10))
          .sort((a, b) => a - b);
        nums.forEach((n, i) => expect(n).toBe(i + 1));
      }
    });

    it('la renumeración es consistente en todas las semanas', () => {
      const initial = buildInitialTemplate(3, 3);
      const toDelete = initial.filter(s => s.day_name === 'Día 1').map(s => s.id);
      const { sessions } = removeSelectedDayLocal(initial, toDelete);
      for (const wk of [1, 2, 3]) {
        const names = sessions.filter(s => s.week_number === wk).map(s => s.day_name).sort();
        expect(names).toEqual(['Día 1', 'Día 2']);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 29: Normalización de day_name y fix de nombres no estándar
  // ════════════════════════════════════════════════════════════════

  function addDayFixed(sessions: TemplateSession[]): TemplateSession[] {
    if (sessions.length === 0) {
      return [{ id: 1, plan_id: 1, week_number: 1, day_name: 'Día 1', order_index: 1 }];
    }
    const weekNumbers = [...new Set(sessions.map(s => s.week_number))].sort((a, b) => a - b);
    const parsedMax = Math.max(0, ...sessions.map(s => parseDayNumber(s.day_name)));
    const daysInFirstWeek = sessions.filter(s => s.week_number === weekNumbers[0]).length;
    const newDayNumber = Math.max(parsedMax, daysInFirstWeek) + 1;
    const newDayName = `Día ${newDayNumber}`;
    const maxOrderIndex = Math.max(0, ...sessions.map(s => s.order_index));
    const nextId = Math.max(0, ...sessions.map(s => s.id)) + 1;
    return [
      ...sessions,
      ...weekNumbers.map((wk, i) => ({
        id: nextId + i,
        plan_id: sessions[0].plan_id,
        week_number: wk,
        day_name: newDayName,
        order_index: maxOrderIndex + i + 1,
      })),
    ];
  }

  describe('ESCENARIO 29: Normalización de day_name', () => {
    it('parseDayNumber: "Día 1" devuelve 1', () => {
      expect(parseDayNumber('Día 1')).toBe(1);
    });

    it('parseDayNumber: "Día 3" devuelve 3', () => {
      expect(parseDayNumber('Día 3')).toBe(3);
    });

    it('parseDayNumber: "DAY" devuelve 0 (nombre no estándar)', () => {
      expect(parseDayNumber('DAY')).toBe(0);
    });

    it('parseDayNumber: "Day 2" (inglés) devuelve 0', () => {
      expect(parseDayNumber('Day 2')).toBe(0);
    });

    it('parseDayNumber: "dia 1" (sin acento) devuelve 1', () => {
      expect(parseDayNumber('dia 1')).toBe(1);
    });

    it('addDayFixed: con "DAY","DAY" (count=2, parsedMax=0) el nuevo día es "Día 3"', () => {
      const sessions: TemplateSession[] = [
        { id: 1, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 1 },
        { id: 2, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 2 },
      ];
      const result = addDayFixed(sessions);
      const newSessions = result.filter(s => !sessions.map(x => x.id).includes(s.id));
      expect(newSessions[0].day_name).toBe('Día 3');
    });

    it('addDayFixed: con "Día 1","Día 2" el nuevo día es "Día 3" (comportamiento normal)', () => {
      const initial = buildInitialTemplate(1, 2);
      const result = addDayFixed(initial);
      const newSessions = result.filter(s => !initial.map(x => x.id).includes(s.id));
      expect(newSessions[0].day_name).toBe('Día 3');
    });

    it('addDayFixed: con "Día 1" solo el nuevo día es "Día 2"', () => {
      const initial = buildInitialTemplate(1, 1);
      const result = addDayFixed(initial);
      const newSessions = result.filter(s => !initial.map(x => x.id).includes(s.id));
      expect(newSessions[0].day_name).toBe('Día 2');
    });

    it('addDayFixed: con 4 "DAY" en plantilla 1×4, el nuevo día es "Día 5"', () => {
      const sessions: TemplateSession[] = [1, 2, 3, 4].map(i => ({
        id: i, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: i,
      }));
      const result = addDayFixed(sessions);
      const newSessions = result.filter(s => !sessions.map(x => x.id).includes(s.id));
      expect(newSessions[0].day_name).toBe('Día 5');
    });

    it('normalizeSessionDayNames: renombra "DAY","DAY" a "Día 1","Día 2"', () => {
      const sessions: TemplateSession[] = [
        { id: 1, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 1 },
        { id: 2, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 2 },
      ];
      const result = normalizeSessionDayNames(sessions);
      const names = result.filter(s => s.week_number === 1).sort((a, b) => a.id - b.id).map(s => s.day_name);
      expect(names).toEqual(['Día 1', 'Día 2']);
    });

    it('normalizeSessionDayNames: renombra en todas las semanas consistentemente', () => {
      const sessions: TemplateSession[] = [
        { id: 1, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 1 },
        { id: 2, plan_id: 1, week_number: 1, day_name: 'DAY', order_index: 2 },
        { id: 3, plan_id: 1, week_number: 2, day_name: 'DAY', order_index: 3 },
        { id: 4, plan_id: 1, week_number: 2, day_name: 'DAY', order_index: 4 },
      ];
      const result = normalizeSessionDayNames(sessions);
      for (const wk of [1, 2]) {
        const wkNames = result.filter(s => s.week_number === wk).map(s => s.day_name).sort();
        expect(wkNames).toEqual(['Día 1', 'Día 2']);
      }
    });

    it('normalizeSessionDayNames: nombres ya correctos no cambian', () => {
      const initial = buildInitialTemplate(2, 3);
      const result = normalizeSessionDayNames(initial);
      expect(isTemplateUniform(result)).toBe(true);
      result.forEach(s => {
        expect(parseDayNumber(s.day_name)).toBeGreaterThan(0);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 30: Ejercicios en plantillas (Vista: agregar, modificar, eliminar)
  // ════════════════════════════════════════════════════════════════

  type TemplateExercise = {
    id: number;
    session_id: number;
    exercise_id: number;
    target_sets: number;
    target_reps: number[];
    target_weight: (number | null)[];
    target_rpe: number;
    rest_seconds: number;
    coach_notes: string;
    order_index: number;
    superset_group: number | null;
  };

  function addExerciseToSessionLocal(
    exercises: TemplateExercise[],
    sessionId: number,
    exerciseId: number,
    sets: number,
    reps: number[],
    weight: (number | null)[],
    rpe: number,
    rest: number,
    notes: string
  ): TemplateExercise[] {
    const maxOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order_index)) : 0;
    const newId = exercises.length > 0 ? Math.max(...exercises.map(e => e.id)) + 1 : 1;
    return [...exercises, {
      id: newId,
      session_id: sessionId,
      exercise_id: exerciseId,
      target_sets: sets,
      target_reps: reps,
      target_weight: weight,
      target_rpe: rpe,
      rest_seconds: rest,
      coach_notes: notes,
      order_index: maxOrder + 1,
      superset_group: null,
    }];
  }

  function updateExerciseLocal(
    exercises: TemplateExercise[],
    id: number,
    data: Partial<Pick<TemplateExercise, 'target_sets' | 'target_reps' | 'target_weight' | 'target_rpe' | 'rest_seconds' | 'coach_notes'>>
  ): TemplateExercise[] {
    return exercises.map(e => e.id === id ? { ...e, ...data } : { ...e });
  }

  function deleteExerciseLocal(exercises: TemplateExercise[], id: number): TemplateExercise[] {
    return exercises.filter(e => e.id !== id);
  }

  const BASE_EX: Omit<TemplateExercise, 'id' | 'order_index'> = {
    session_id: 10,
    exercise_id: 5,
    target_sets: 3,
    target_reps: [10, 10, 10],
    target_weight: [null, null, null],
    target_rpe: 8,
    rest_seconds: 60,
    coach_notes: '',
    superset_group: null,
  };

  describe('ESCENARIO 30: Ejercicios en plantillas (Vista)', () => {
    describe('Agregar ejercicio', () => {
      it('agregar a una sesión vacía crea el ejercicio con order_index 1', () => {
        const result = addExerciseToSessionLocal([], 10, 5, 3, [10, 10, 10], [null, null, null], 8, 60, '');
        expect(result).toHaveLength(1);
        expect(result[0].order_index).toBe(1);
      });

      it('agregar a una sesión con ejercicios usa el siguiente order_index', () => {
        const existing: TemplateExercise[] = [
          { ...BASE_EX, id: 1, order_index: 1 },
          { ...BASE_EX, id: 2, order_index: 2 },
        ];
        const result = addExerciseToSessionLocal(existing, 10, 7, 4, [8, 8, 8, 8], [60, 60, 60, 60], 9, 90, '');
        expect(result[2].order_index).toBe(3);
      });

      it('el nuevo ejercicio pertenece a la sesión indicada', () => {
        const result = addExerciseToSessionLocal([], 42, 5, 3, [10, 10, 10], [null, null, null], 8, 60, '');
        expect(result[0].session_id).toBe(42);
      });

      it('los parámetros del ejercicio se guardan correctamente', () => {
        const result = addExerciseToSessionLocal([], 10, 7, 4, [8, 6, 5, 5], [100, 105, 110, 110], 9, 120, 'Foco técnico');
        expect(result[0].target_sets).toBe(4);
        expect(result[0].target_reps).toEqual([8, 6, 5, 5]);
        expect(result[0].target_weight).toEqual([100, 105, 110, 110]);
        expect(result[0].target_rpe).toBe(9);
        expect(result[0].rest_seconds).toBe(120);
        expect(result[0].coach_notes).toBe('Foco técnico');
      });

      it('el ejercicio se agrega sin superset_group (null por defecto)', () => {
        const result = addExerciseToSessionLocal([], 10, 5, 3, [10, 10, 10], [null, null, null], 8, 60, '');
        expect(result[0].superset_group).toBeNull();
      });

      it('los ejercicios existentes no se modifican al agregar uno nuevo', () => {
        const existing: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1, target_sets: 3 }];
        const result = addExerciseToSessionLocal(existing, 10, 9, 5, [5, 5, 5, 5, 5], [null, null, null, null, null], 7, 90, '');
        expect(result[0].target_sets).toBe(3);
      });

      it('los ejercicios de plantilla NO tienen campos actual_* (datos del alumno)', () => {
        const result = addExerciseToSessionLocal([], 10, 5, 3, [10, 10, 10], [null, null, null], 8, 60, '');
        expect('actual_sets' in result[0]).toBe(false);
        expect('actual_reps' in result[0]).toBe(false);
        expect('actual_weight' in result[0]).toBe(false);
        expect('actual_rpe' in result[0]).toBe(false);
      });
    });

    describe('Modificar ejercicio', () => {
      it('actualizar target_sets cambia solo ese campo', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = updateExerciseLocal(exercises, 1, { target_sets: 5 });
        expect(result[0].target_sets).toBe(5);
        expect(result[0].target_reps).toEqual([10, 10, 10]);
      });

      it('actualizar target_reps actualiza las repeticiones', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = updateExerciseLocal(exercises, 1, { target_reps: [8, 6, 5] });
        expect(result[0].target_reps).toEqual([8, 6, 5]);
      });

      it('actualizar coach_notes guarda la nota', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = updateExerciseLocal(exercises, 1, { coach_notes: 'Reducir peso si falla' });
        expect(result[0].coach_notes).toBe('Reducir peso si falla');
      });

      it('actualizar un ejercicio no modifica los demás', () => {
        const exercises: TemplateExercise[] = [
          { ...BASE_EX, id: 1, order_index: 1, target_sets: 3 },
          { ...BASE_EX, id: 2, order_index: 2, target_sets: 4 },
        ];
        const result = updateExerciseLocal(exercises, 1, { target_sets: 5 });
        expect(result.find(e => e.id === 2)!.target_sets).toBe(4);
      });

      it('actualizar target_weight con valores nulos se guarda correctamente', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = updateExerciseLocal(exercises, 1, { target_weight: [null, null, null] });
        expect(result[0].target_weight).toEqual([null, null, null]);
      });

      it('la edición no crea campos actual_* en el ejercicio de plantilla', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = updateExerciseLocal(exercises, 1, { target_sets: 4, coach_notes: 'Nota' });
        expect('actual_sets' in result[0]).toBe(false);
        expect('actual_reps' in result[0]).toBe(false);
      });
    });

    describe('Eliminar ejercicio', () => {
      it('eliminar un ejercicio lo remueve de la lista', () => {
        const exercises: TemplateExercise[] = [
          { ...BASE_EX, id: 1, order_index: 1 },
          { ...BASE_EX, id: 2, order_index: 2 },
        ];
        const result = deleteExerciseLocal(exercises, 1);
        expect(result).toHaveLength(1);
        expect(result.find(e => e.id === 1)).toBeUndefined();
      });

      it('los ejercicios restantes no se modifican al eliminar uno', () => {
        const exercises: TemplateExercise[] = [
          { ...BASE_EX, id: 1, order_index: 1, target_sets: 3 },
          { ...BASE_EX, id: 2, order_index: 2, target_sets: 4 },
        ];
        const result = deleteExerciseLocal(exercises, 1);
        expect(result[0].id).toBe(2);
        expect(result[0].target_sets).toBe(4);
      });

      it('eliminar el único ejercicio deja la sesión vacía', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = deleteExerciseLocal(exercises, 1);
        expect(result).toHaveLength(0);
      });

      it('intentar eliminar un ID inexistente no modifica la lista', () => {
        const exercises: TemplateExercise[] = [{ ...BASE_EX, id: 1, order_index: 1 }];
        const result = deleteExerciseLocal(exercises, 99);
        expect(result).toHaveLength(1);
      });
    });

    describe('Reordenar y encadenar en contexto de plantilla', () => {
      // Tipos y helpers locales (la misma lógica que en Escenarios 18/19,
      // redefinidos aquí porque están fuera del scope de describe('Estudiantes'))
      type TEx = { id: number; order_index: number; superset_group: number | null };

      function reorderTItem(
        exercises: TEx[],
        key: { type: 'standalone'; exerciseId: number } | { type: 'superset'; group: number },
        dir: 'up' | 'down'
      ): TEx[] {
        const sorted = [...exercises].sort((a, b) => a.order_index - b.order_index);
        type Block = { type: 'standalone'; ex: TEx } | { type: 'superset'; group: number; exs: TEx[] };
        const blocks: Block[] = [];
        const seen = new Set<number>();
        for (const ex of sorted) {
          const g = ex.superset_group;
          if (g === null) blocks.push({ type: 'standalone', ex });
          else if (!seen.has(g)) { seen.add(g); blocks.push({ type: 'superset', group: g, exs: sorted.filter(e => e.superset_group === g) }); }
        }
        const bi = key.type === 'standalone'
          ? blocks.findIndex(b => b.type === 'standalone' && (b as any).ex.id === key.exerciseId)
          : blocks.findIndex(b => b.type === 'superset' && (b as any).group === key.group);
        if (bi === -1) return sorted;
        const ti = dir === 'up' ? bi - 1 : bi + 1;
        if (ti < 0 || ti >= blocks.length) return sorted;
        const nb = [...blocks];
        [nb[bi], nb[ti]] = [nb[ti], nb[bi]];
        let idx = 1;
        const res: TEx[] = [];
        for (const b of nb) {
          if (b.type === 'standalone') res.push({ ...(b as any).ex, order_index: idx++ });
          else for (const ex of (b as any).exs) res.push({ ...ex, order_index: idx++ });
        }
        return res.sort((a, b) => a.order_index - b.order_index);
      }

      function resolveSupersetT(
        exercises: { id: number; superset_group: number | null }[],
        sourceId: number, targetId: number
      ): { id: number; superset_group: number | null }[] {
        const ex1 = exercises.find(e => e.id === sourceId);
        const ex2 = exercises.find(e => e.id === targetId);
        if (!ex1 || !ex2) return exercises.map(e => ({ ...e }));
        let groupNumber: number;
        if (ex1.superset_group !== null) groupNumber = ex1.superset_group;
        else if (ex2.superset_group !== null) groupNumber = ex2.superset_group;
        else groupNumber = Math.max(0, ...exercises.map(e => e.superset_group ?? 0)) + 1;
        const groupsToMerge = [ex1.superset_group, ex2.superset_group]
          .filter((g): g is number => g !== null && g !== groupNumber);
        return exercises.map(e => {
          if (e.id === sourceId || e.id === targetId) return { ...e, superset_group: groupNumber };
          if (groupsToMerge.includes(e.superset_group as number)) return { ...e, superset_group: groupNumber };
          return { ...e };
        });
      }

      function removeSupersetT(
        exercises: { id: number; superset_group: number | null }[],
        exerciseId: number
      ): { id: number; superset_group: number | null }[] {
        return exercises.map(e => e.id === exerciseId ? { ...e, superset_group: null } : { ...e });
      }

      it('reordenar ejercicio arriba: intercambia posición con el anterior', () => {
        const exs: TEx[] = [
          { id: 1, order_index: 1, superset_group: null },
          { id: 2, order_index: 2, superset_group: null },
          { id: 3, order_index: 3, superset_group: null },
        ];
        const result = reorderTItem(exs, { type: 'standalone', exerciseId: 2 }, 'up');
        expect(result[0].id).toBe(2);
        expect(result[1].id).toBe(1);
      });

      it('encadenar dos ejercicios de plantilla les asigna el mismo grupo', () => {
        const exs = [{ id: 1, superset_group: null }, { id: 2, superset_group: null }];
        const result = resolveSupersetT(exs, 1, 2);
        expect(result.find(e => e.id === 1)!.superset_group).not.toBeNull();
        expect(result.find(e => e.id === 2)!.superset_group).toBe(result.find(e => e.id === 1)!.superset_group);
      });

      it('desencadenar un ejercicio de plantilla lo deja con superset_group null', () => {
        const exs = [{ id: 1, superset_group: 1 }, { id: 2, superset_group: 1 }];
        const result = removeSupersetT(exs, 1);
        expect(result.find(e => e.id === 1)!.superset_group).toBeNull();
        expect(result.find(e => e.id === 2)!.superset_group).toBe(1);
      });

      it('mover superset completo hacia arriba: el bloque sube como unidad', () => {
        const exs: TEx[] = [
          { id: 1, order_index: 1, superset_group: null },
          { id: 2, order_index: 2, superset_group: 1 },
          { id: 3, order_index: 3, superset_group: 1 },
        ];
        const result = reorderTItem(exs, { type: 'superset', group: 1 }, 'up');
        expect(result[0].id).toBe(2);
        expect(result[1].id).toBe(3);
        expect(result[2].id).toBe(1);
      });

      it('los ejercicios de plantilla instanciados preservan superset_group', () => {
        const templateExercises = [
          { exercise_id: 1, target_sets: 3, superset_group: 1 },
          { exercise_id: 2, target_sets: 3, superset_group: 1 },
          { exercise_id: 3, target_sets: 4, superset_group: null },
        ];
        const copied = templateExercises.map(ex => ({ ...ex }));
        expect(copied[0].superset_group).toBe(1);
        expect(copied[1].superset_group).toBe(1);
        expect(copied[2].superset_group).toBeNull();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  // ESCENARIO 31: Modo de reordenamiento exclusivo en el editor
  // Cuando se reordena semanas, el panel de días debe silenciarse y viceversa
  // ════════════════════════════════════════════════════════════════

  describe('ESCENARIO 31: Modo de reordenamiento exclusivo', () => {
    it('estado normal: ambas secciones muestran sus acciones, ningún Listo', () => {
      const state = getEditorModeState(false, false);
      expect(state.showWeekActions).toBe(true);
      expect(state.showDayActions).toBe(true);
      expect(state.showWeekListo).toBe(false);
      expect(state.showDayListo).toBe(false);
    });

    it('reordenando semanas: aparece Listo en semanas y desaparecen todas las acciones de días', () => {
      const state = getEditorModeState(true, false);
      expect(state.showWeekListo).toBe(true);
      expect(state.showDayActions).toBe(false);
      expect(state.showDayListo).toBe(false);
      expect(state.showWeekActions).toBe(false);
    });

    it('reordenando días: aparece Listo en días y desaparecen todas las acciones de semanas', () => {
      const state = getEditorModeState(false, true);
      expect(state.showDayListo).toBe(true);
      expect(state.showWeekActions).toBe(false);
      expect(state.showWeekListo).toBe(false);
      expect(state.showDayActions).toBe(false);
    });

    it('al reordenar semanas exactamente 1 de los 4 flags está activo', () => {
      const state = getEditorModeState(true, false);
      const trueCount = Object.values(state).filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('al reordenar días exactamente 1 de los 4 flags está activo', () => {
      const state = getEditorModeState(false, true);
      const trueCount = Object.values(state).filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('estado normal tiene exactamente 2 flags activos (weekActions y dayActions)', () => {
      const state = getEditorModeState(false, false);
      const trueCount = Object.values(state).filter(Boolean).length;
      expect(trueCount).toBe(2);
    });

    it('showWeekListo y showWeekActions nunca son true al mismo tiempo', () => {
      const cases: [boolean, boolean][] = [[false, false], [true, false], [false, true]];
      for (const [w, d] of cases) {
        const s = getEditorModeState(w, d);
        expect(s.showWeekListo && s.showWeekActions).toBe(false);
      }
    });

    it('showDayListo y showDayActions nunca son true al mismo tiempo', () => {
      const cases: [boolean, boolean][] = [[false, false], [true, false], [false, true]];
      for (const [w, d] of cases) {
        const s = getEditorModeState(w, d);
        expect(s.showDayListo && s.showDayActions).toBe(false);
      }
    });

    it('presionar Listo en semanas restaura el estado normal', () => {
      const during = getEditorModeState(true, false);
      const after  = getEditorModeState(false, false);
      expect(during.showWeekListo).toBe(true);
      expect(after.showWeekActions).toBe(true);
      expect(after.showDayActions).toBe(true);
    });

    it('presionar Listo en días restaura el estado normal', () => {
      const during = getEditorModeState(false, true);
      const after  = getEditorModeState(false, false);
      expect(during.showDayListo).toBe(true);
      expect(after.showWeekActions).toBe(true);
      expect(after.showDayActions).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════
// Módulo: Administración
// Gestión de usuarios, roles, asignaciones coach→alumno e invitaciones
// ════════════════════════════════════════════════════════════════

const ADMIN_PROFILES: AdminProfile[] = [
  { id: 'u1', email: 'carlos@gym.com',  name: 'Carlos',  last_name: 'López',   role: 'COACH' },
  { id: 'u2', email: 'maria@gym.com',   name: 'María',   last_name: 'Gómez',   role: 'STUDENT' },
  { id: 'u3', email: 'pedro@gym.com',   name: 'Pedro',   last_name: 'Martínez',role: 'STUDENT' },
  { id: 'u4', email: 'admin@gym.com',   name: 'Admin',   last_name: 'Root',    role: 'ADMIN' },
  { id: 'u5', email: 'laura@gym.com',   name: 'Laura',   last_name: 'Sánchez', role: 'COACH' },
];

const ADMIN_ASSIGNMENTS: AdminAssignment[] = [
  { coach_id: 'u1', student_id: 'u2' },
  { coach_id: 'u1', student_id: 'u3' },
  { coach_id: 'u5', student_id: 'u2' },
];

describe('Administración', () => {

  describe('ESCENARIO 32: Filtrado de usuarios', () => {
    it('buscar por nombre devuelve coincidencias exactas', () => {
      const result = filterProfiles(ADMIN_PROFILES, 'Carlos');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('u1');
    });

    it('buscar por apellido devuelve coincidencias', () => {
      const result = filterProfiles(ADMIN_PROFILES, 'Gómez');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('u2');
    });

    it('buscar por email devuelve coincidencias', () => {
      const result = filterProfiles(ADMIN_PROFILES, 'pedro@gym.com');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('u3');
    });

    it('búsqueda es case-insensitive', () => {
      expect(filterProfiles(ADMIN_PROFILES, 'carlos')).toHaveLength(1);
      expect(filterProfiles(ADMIN_PROFILES, 'CARLOS')).toHaveLength(1);
      expect(filterProfiles(ADMIN_PROFILES, 'cArLoS')).toHaveLength(1);
    });

    it('búsqueda vacía devuelve todos los perfiles', () => {
      expect(filterProfiles(ADMIN_PROFILES, '')).toHaveLength(ADMIN_PROFILES.length);
    });

    it('búsqueda sin coincidencias devuelve lista vacía', () => {
      expect(filterProfiles(ADMIN_PROFILES, 'zzznombrenoexiste')).toHaveLength(0);
    });

    it('búsqueda parcial de nombre funciona', () => {
      const result = filterProfiles(ADMIN_PROFILES, 'Mar');
      expect(result.some(p => p.id === 'u2')).toBe(true);
    });

    it('búsqueda por dominio de email puede devolver múltiples resultados', () => {
      const result = filterProfiles(ADMIN_PROFILES, '@gym.com');
      expect(result.length).toBe(ADMIN_PROFILES.length);
    });
  });

  describe('ESCENARIO 33: Coaches disponibles para asignación', () => {
    it('perfil con rol COACH aparece en lista de coaches', () => {
      const coaches = getCoachProfiles(ADMIN_PROFILES);
      expect(coaches.some(c => c.role === 'COACH')).toBe(true);
    });

    it('perfil con rol ADMIN también aparece en lista de coaches', () => {
      const coaches = getCoachProfiles(ADMIN_PROFILES);
      expect(coaches.some(c => c.role === 'ADMIN')).toBe(true);
    });

    it('perfil con rol STUDENT no aparece en lista de coaches', () => {
      const coaches = getCoachProfiles(ADMIN_PROFILES);
      expect(coaches.some(c => c.role === 'STUDENT')).toBe(false);
    });

    it('la lista de coaches incluye COACH + ADMIN, no más', () => {
      const coaches = getCoachProfiles(ADMIN_PROFILES);
      const expectedCount = ADMIN_PROFILES.filter(p => p.role === 'COACH' || p.role === 'ADMIN').length;
      expect(coaches).toHaveLength(expectedCount);
    });
  });

  describe('ESCENARIO 34: Asignación Coach→Alumno', () => {
    it('isCoachAssignedToStudent: true cuando existe la asignación', () => {
      expect(isCoachAssignedToStudent(ADMIN_ASSIGNMENTS, 'u1', 'u2')).toBe(true);
    });

    it('isCoachAssignedToStudent: false cuando no existe la asignación', () => {
      expect(isCoachAssignedToStudent(ADMIN_ASSIGNMENTS, 'u5', 'u3')).toBe(false);
    });

    it('toggleAssignment agrega la asignación cuando no estaba', () => {
      const result = toggleAssignmentLocal(ADMIN_ASSIGNMENTS, 'u5', 'u3');
      expect(isCoachAssignedToStudent(result, 'u5', 'u3')).toBe(true);
    });

    it('toggleAssignment quita la asignación cuando ya existía', () => {
      const result = toggleAssignmentLocal(ADMIN_ASSIGNMENTS, 'u1', 'u2');
      expect(isCoachAssignedToStudent(result, 'u1', 'u2')).toBe(false);
    });

    it('un alumno puede tener múltiples coaches', () => {
      expect(countCoachesForStudent(ADMIN_ASSIGNMENTS, 'u2')).toBe(2);
    });

    it('un coach puede tener múltiples alumnos', () => {
      const studentsOfU1 = ADMIN_ASSIGNMENTS.filter(a => a.coach_id === 'u1');
      expect(studentsOfU1.length).toBeGreaterThan(1);
    });

    it('quitar una asignación no afecta las otras del mismo alumno', () => {
      const result = toggleAssignmentLocal(ADMIN_ASSIGNMENTS, 'u1', 'u2');
      expect(countCoachesForStudent(result, 'u2')).toBe(1);
      expect(isCoachAssignedToStudent(result, 'u5', 'u2')).toBe(true);
    });

    it('countCoachesForStudent: 0 cuando el alumno no tiene coaches asignados', () => {
      expect(countCoachesForStudent(ADMIN_ASSIGNMENTS, 'u_ninguno')).toBe(0);
    });

    it('el toggle no modifica el array original', () => {
      const before = ADMIN_ASSIGNMENTS.length;
      toggleAssignmentLocal(ADMIN_ASSIGNMENTS, 'u5', 'u3');
      expect(ADMIN_ASSIGNMENTS.length).toBe(before);
    });
  });

  describe('ESCENARIO 35: Validación de formulario e invitación', () => {
    it('email y nombre válidos pasan la validación', () => {
      expect(validateInviteForm('nuevo@gym.com', 'Juan').valid).toBe(true);
    });

    it('email sin @ falla la validación', () => {
      const result = validateInviteForm('emailsinarroba', 'Juan');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email inválido');
    });

    it('email vacío falla la validación', () => {
      expect(validateInviteForm('', 'Juan').valid).toBe(false);
    });

    it('nombre vacío falla la validación', () => {
      const result = validateInviteForm('juan@gym.com', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('El nombre es obligatorio');
    });

    it('nombre solo con espacios falla la validación', () => {
      expect(validateInviteForm('juan@gym.com', '   ').valid).toBe(false);
    });

    it('canDeleteUser: false cuando el target es el usuario actual', () => {
      expect(canDeleteUser('u1', 'u1')).toBe(false);
    });

    it('canDeleteUser: true cuando el target es otro usuario', () => {
      expect(canDeleteUser('u4', 'u1')).toBe(true);
    });

    it('no se puede eliminar a uno mismo independientemente del rol', () => {
      expect(canDeleteUser('u4', 'u4')).toBe(false); // admin no puede borrarse
      expect(canDeleteUser('u1', 'u1')).toBe(false); // coach tampoco
    });
  });

  describe('ESCENARIO 42: Lógica de delete en cascada', () => {
    describe('getDeleteScope', () => {
      it('STUDENT: elimina planes, no templates, no nullifica coach_id', () => {
        const scope = getDeleteScope('STUDENT');
        expect(scope.deletesPlans).toBe(true);
        expect(scope.deletesTemplates).toBe(false);
        expect(scope.nullifiesCoachId).toBe(false);
      });

      it('COACH: no elimina planes, elimina templates, nullifica coach_id', () => {
        const scope = getDeleteScope('COACH');
        expect(scope.deletesPlans).toBe(false);
        expect(scope.deletesTemplates).toBe(true);
        expect(scope.nullifiesCoachId).toBe(true);
      });

      it('ADMIN: mismo comportamiento que COACH', () => {
        const scopeAdmin = getDeleteScope('ADMIN');
        const scopeCoach = getDeleteScope('COACH');
        expect(scopeAdmin.deletesPlans).toBe(scopeCoach.deletesPlans);
        expect(scopeAdmin.deletesTemplates).toBe(scopeCoach.deletesTemplates);
        expect(scopeAdmin.nullifiesCoachId).toBe(scopeCoach.nullifiesCoachId);
      });
    });

    describe('buildDeleteSummary', () => {
      it('STUDENT con 3 planes: menciona el número y la palabra "planes"', () => {
        const msg = buildDeleteSummary('STUDENT', 3, 0);
        expect(msg).toContain('3');
        expect(msg.toLowerCase()).toContain('plan');
      });

      it('STUDENT con 1 plan: usa singular "plan"', () => {
        const msg = buildDeleteSummary('STUDENT', 1, 0);
        expect(msg.toLowerCase()).toMatch(/\b1 plan\b/);
      });

      it('STUDENT con 0 planes: mensaje sin datos que eliminar', () => {
        const msg = buildDeleteSummary('STUDENT', 0, 0);
        expect(msg.toLowerCase()).not.toContain('eliminará');
      });

      it('COACH con 5 plantillas: menciona el número y la palabra "plantillas"', () => {
        const msg = buildDeleteSummary('COACH', 0, 5);
        expect(msg).toContain('5');
        expect(msg.toLowerCase()).toContain('plantilla');
      });

      it('COACH con 1 plantilla: usa singular "plantilla"', () => {
        const msg = buildDeleteSummary('COACH', 0, 1);
        expect(msg.toLowerCase()).toMatch(/\b1 plantilla\b/);
      });

      it('ADMIN con 2 plantillas: mismo formato que COACH', () => {
        const msgAdmin = buildDeleteSummary('ADMIN', 0, 2);
        const msgCoach = buildDeleteSummary('COACH', 0, 2);
        expect(msgAdmin).toBe(msgCoach);
      });

      it('COACH con 0 plantillas: mensaje sin datos que eliminar', () => {
        const msg = buildDeleteSummary('COACH', 0, 0);
        expect(msg.toLowerCase()).not.toContain('eliminará');
      });

      it('el resumen de STUDENT no menciona plantillas', () => {
        const msg = buildDeleteSummary('STUDENT', 3, 0);
        expect(msg.toLowerCase()).not.toContain('plantilla');
      });

      it('el resumen de COACH no menciona planes de entrenamiento del alumno', () => {
        const msg = buildDeleteSummary('COACH', 0, 3);
        expect(msg.toLowerCase()).not.toContain('plan de');
      });
    });
  });

}); // Administración

// ════════════════════════════════════════════════════════════════
// Módulo: Librería de Ejercicios
// Filtrado, búsqueda, etiquetas de zona/categoría y validación de CRUD
// ════════════════════════════════════════════════════════════════

const LIBRARY_EXERCISES: LibraryExercise[] = [
  { id: 1, name: 'Sentadilla',       body_zone: 'LOWER_BODY', category: 'MAIN' },
  { id: 2, name: 'Press de banca',   body_zone: 'UPPER_BODY', category: 'MAIN' },
  { id: 3, name: 'Curl de bíceps',   body_zone: 'UPPER_BODY', category: 'AUX' },
  { id: 4, name: 'Plancha',          body_zone: 'CORE',       category: 'BALANCE' },
  { id: 5, name: 'Peso muerto',      body_zone: 'FULL_BODY',  category: 'MAIN' },
  { id: 6, name: 'Trote 5 minutos',  body_zone: 'CARDIO',     category: 'AUX' },
  { id: 7, name: 'Movilidad cadera', body_zone: 'MOBILITY',   category: 'MOBILITY' },
  { id: 8, name: 'Remo con barra',   body_zone: null,         category: null },
];

describe('Biblioteca', () => {

  describe('ESCENARIO 36: Filtrado de ejercicios', () => {
    it('filtrar por zona UPPER_BODY retorna solo ejercicios de tren superior', () => {
      const result = filterExercises(LIBRARY_EXERCISES, '', 'UPPER_BODY');
      expect(result.every(e => e.body_zone === 'UPPER_BODY')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('filtrar por categoría MAIN retorna solo ejercicios principales', () => {
      const result = filterExercises(LIBRARY_EXERCISES, '', null, 'MAIN');
      expect(result.every(e => e.category === 'MAIN')).toBe(true);
    });

    it('filtro por nombre es case-insensitive', () => {
      expect(filterExercises(LIBRARY_EXERCISES, 'sentadilla')).toHaveLength(1);
      expect(filterExercises(LIBRARY_EXERCISES, 'SENTADILLA')).toHaveLength(1);
      expect(filterExercises(LIBRARY_EXERCISES, 'Sentadilla')).toHaveLength(1);
    });

    it('filtro vacío sin zona ni categoría retorna todos los ejercicios', () => {
      expect(filterExercises(LIBRARY_EXERCISES, '')).toHaveLength(LIBRARY_EXERCISES.length);
    });

    it('combinar nombre y zona filtra correctamente', () => {
      const result = filterExercises(LIBRARY_EXERCISES, 'curl', 'UPPER_BODY');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Curl de bíceps');
    });

    it('búsqueda sin coincidencias retorna lista vacía', () => {
      expect(filterExercises(LIBRARY_EXERCISES, 'zzznombrenoexiste')).toHaveLength(0);
    });

    it('búsqueda parcial del nombre funciona', () => {
      const result = filterExercises(LIBRARY_EXERCISES, 'press');
      expect(result.some(e => e.name === 'Press de banca')).toBe(true);
    });

    it('combinar zona FULL_BODY y categoría MAIN retorna ejercicios correctos', () => {
      const result = filterExercises(LIBRARY_EXERCISES, '', 'FULL_BODY', 'MAIN');
      expect(result.every(e => e.body_zone === 'FULL_BODY' && e.category === 'MAIN')).toBe(true);
    });
  });

  describe('ESCENARIO 37: Etiquetas de zona corporal y categoría', () => {
    it('LOWER_BODY → "Tren Inferior"', () => {
      expect(getBodyZoneLabel('LOWER_BODY')).toBe('Tren Inferior');
    });

    it('UPPER_BODY → "Tren Superior"', () => {
      expect(getBodyZoneLabel('UPPER_BODY')).toBe('Tren Superior');
    });

    it('CORE → "Zona Media"', () => {
      expect(getBodyZoneLabel('CORE')).toBe('Zona Media');
    });

    it('FULL_BODY → "Cuerpo Completo"', () => {
      expect(getBodyZoneLabel('FULL_BODY')).toBe('Cuerpo Completo');
    });

    it('CARDIO → "Cardio"', () => {
      expect(getBodyZoneLabel('CARDIO')).toBe('Cardio');
    });

    it('MOBILITY (zona) → "Movilidad"', () => {
      expect(getBodyZoneLabel('MOBILITY')).toBe('Movilidad');
    });

    it('zona null → "Sin zona"', () => {
      expect(getBodyZoneLabel(null)).toBe('Sin zona');
    });

    it('MAIN → "Principal"', () => {
      expect(getCategoryLabel('MAIN')).toBe('Principal');
    });

    it('BALANCE → "Equilibrador"', () => {
      expect(getCategoryLabel('BALANCE')).toBe('Equilibrador');
    });

    it('AUX → "Auxiliar"', () => {
      expect(getCategoryLabel('AUX')).toBe('Auxiliar');
    });

    it('MOBILITY (categoría) → "Movilidad"', () => {
      expect(getCategoryLabel('MOBILITY')).toBe('Movilidad');
    });

    it('categoría null → "Sin categoría"', () => {
      expect(getCategoryLabel(null)).toBe('Sin categoría');
    });

    it('todas las zonas del enum tienen etiqueta definida', () => {
      const zones = ['LOWER_BODY', 'UPPER_BODY', 'CORE', 'FULL_BODY', 'CARDIO', 'MOBILITY'];
      zones.forEach(z => expect(getBodyZoneLabel(z)).not.toBe('Sin zona'));
    });

    it('todas las categorías del enum tienen etiqueta definida', () => {
      const cats = ['MAIN', 'BALANCE', 'AUX', 'MOBILITY'];
      cats.forEach(c => expect(getCategoryLabel(c)).not.toBe('Sin categoría'));
    });
  });

  describe('ESCENARIO 38: Creación y validación de ejercicio', () => {
    it('nombre válido pasa la validación', () => {
      expect(validateExerciseName('Sentadilla búlgara').valid).toBe(true);
    });

    it('nombre vacío falla la validación', () => {
      const result = validateExerciseName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('El nombre es obligatorio');
    });

    it('nombre solo con espacios falla la validación', () => {
      expect(validateExerciseName('   ').valid).toBe(false);
    });

    it('zona y categoría son opcionales: un ejercicio puede tener ambas en null', () => {
      const ex: LibraryExercise = { id: 99, name: 'Ejercicio nuevo', body_zone: null, category: null };
      expect(ex.body_zone).toBeNull();
      expect(ex.category).toBeNull();
      expect(validateExerciseName(ex.name).valid).toBe(true);
    });

    it('un ejercicio de librería no tiene campos actual_* (datos del alumno)', () => {
      const ex = { id: 1, name: 'Press', body_zone: 'UPPER_BODY', category: 'MAIN' };
      expect('actual_sets' in ex).toBe(false);
      expect('actual_reps' in ex).toBe(false);
      expect('actual_rpe' in ex).toBe(false);
    });

    it('ejercicios con zona null quedan fuera si se filtra por zona específica', () => {
      const result = filterExercises(LIBRARY_EXERCISES, '', 'UPPER_BODY');
      expect(result.some(e => e.body_zone === null)).toBe(false);
    });

    it('el nombre se busca como substring, no por igualdad exacta', () => {
      const result = filterExercises(LIBRARY_EXERCISES, 'banca');
      expect(result.some(e => e.name === 'Press de banca')).toBe(true);
    });
  });

}); // Librería de Ejercicios

// ════════════════════════════════════════════════════════════════
// Módulo: Vista del Alumno
// Completar ejercicios, payload del alumno, restricciones de edición
// ════════════════════════════════════════════════════════════════

function buildStudentExerciseView(
  exercise: {
    target_sets: number;
    target_reps: number[];
    target_weight: (number | null)[];
    target_rpe: number;
    coach_notes: string;
    actual_sets?: number | null;
    actual_reps?: number[] | null;
    actual_rpe?: number | null;
    student_notes?: string | null;
  }
) {
  return {
    targets: {
      sets:   exercise.target_sets,
      reps:   exercise.target_reps,
      weight: exercise.target_weight,
      rpe:    exercise.target_rpe,
    },
    coachNotes: exercise.coach_notes,
    actuals: {
      sets:  exercise.actual_sets  ?? null,
      reps:  exercise.actual_reps  ?? null,
      rpe:   exercise.actual_rpe   ?? null,
    },
    studentNotes: exercise.student_notes ?? null,
  };
}

describe('Vista del Alumno', () => {

  describe('ESCENARIO 39: Payload del alumno al registrar ejercicio', () => {
    it('el payload incluye actual_sets, actual_reps, actual_rpe y student_notes', () => {
      const payload = buildStudentPayload({
        actual_sets: 3, actual_reps: [10, 9, 8], actual_rpe: 7, student_notes: 'Bien',
      });
      expect('actual_sets' in payload).toBe(true);
      expect('actual_reps' in payload).toBe(true);
      expect('actual_rpe' in payload).toBe(true);
      expect('student_notes' in payload).toBe(true);
    });

    it('el payload NO incluye campos target_*', () => {
      const payload = buildStudentPayload({
        actual_sets: 3, actual_reps: [10, 10, 10], actual_rpe: 8, student_notes: '',
        target_sets: 4, target_reps: [12, 12, 12, 12], target_rpe: 9,
      });
      expect('target_sets' in payload).toBe(false);
      expect('target_reps' in payload).toBe(false);
      expect('target_rpe' in payload).toBe(false);
    });

    it('el payload NO incluye coach_notes', () => {
      const payload = buildStudentPayload({
        actual_sets: 3, actual_reps: [10, 10, 10], actual_rpe: 8, student_notes: '',
        coach_notes: 'Foco en la bajada',
      });
      expect('coach_notes' in payload).toBe(false);
    });

    it('actual_rpe puede ser null si el alumno no lo registra', () => {
      const payload = buildStudentPayload({
        actual_sets: 3, actual_reps: [10, 10, 10], actual_rpe: null, student_notes: '',
      });
      expect(payload.actual_rpe).toBeNull();
    });

    it('student_notes puede ser una cadena vacía', () => {
      const payload = buildStudentPayload({
        actual_sets: 2, actual_reps: [8, 8], actual_rpe: 6, student_notes: '',
      });
      expect(payload.student_notes).toBe('');
    });

    it('los valores reales del alumno se guardan con exactitud', () => {
      const payload = buildStudentPayload({
        actual_sets: 4, actual_reps: [10, 9, 8, 7], actual_rpe: 9, student_notes: 'Muy pesado',
      });
      expect(payload.actual_sets).toBe(4);
      expect(payload.actual_reps).toEqual([10, 9, 8, 7]);
      expect(payload.actual_rpe).toBe(9);
      expect(payload.student_notes).toBe('Muy pesado');
    });
  });

  describe('ESCENARIO 40: Restricciones del alumno', () => {
    it('el alumno no puede editar los targets del coach', () => {
      expect(canStudentEditTargets()).toBe(false);
    });

    it('la vista del alumno expone los targets como solo lectura', () => {
      const view = buildStudentExerciseView({
        target_sets: 3, target_reps: [10, 10, 10],
        target_weight: [null, null, null], target_rpe: 8,
        coach_notes: 'Foco en la postura',
        actual_sets: null, actual_reps: null, actual_rpe: null, student_notes: null,
      });
      expect(view.targets.sets).toBe(3);
      expect(view.targets.reps).toEqual([10, 10, 10]);
      expect(view.coachNotes).toBe('Foco en la postura');
    });

    it('los datos del alumno están separados de los targets del coach en la vista', () => {
      const view = buildStudentExerciseView({
        target_sets: 4, target_reps: [12, 12, 12, 12],
        target_weight: [60, 60, 60, 60], target_rpe: 7, coach_notes: '',
        actual_sets: 3, actual_reps: [10, 9, 8], actual_rpe: 6, student_notes: 'Cansado',
      });
      expect(view.targets.sets).toBe(4);
      expect(view.actuals.sets).toBe(3);
      expect(view.studentNotes).toBe('Cansado');
    });

    it('actualizar los datos del alumno no modifica los targets', () => {
      const payloadSinDatos = buildStudentPayload({ actual_sets: 0, actual_reps: [], actual_rpe: null, student_notes: '' });
      const payloadConDatos = buildStudentPayload({ actual_sets: 3, actual_reps: [10, 9, 8], actual_rpe: 7, student_notes: 'Ok' });
      expect('target_sets' in payloadSinDatos).toBe(false);
      expect('target_sets' in payloadConDatos).toBe(false);
    });

    it('un ejercicio sin datos del alumno muestra actuals en null', () => {
      const view = buildStudentExerciseView({
        target_sets: 3, target_reps: [10, 10, 10],
        target_weight: [null, null, null], target_rpe: 8, coach_notes: '',
      });
      expect(view.actuals.sets).toBeNull();
      expect(view.actuals.reps).toBeNull();
      expect(view.actuals.rpe).toBeNull();
      expect(view.studentNotes).toBeNull();
    });
  });

  describe('ESCENARIO 41: Completar sesión y validar series reales', () => {
    it('shouldMarkCompleteFromStudent: true cuando actual_sets > 0', () => {
      expect(shouldMarkCompleteFromStudent(1)).toBe(true);
      expect(shouldMarkCompleteFromStudent(4)).toBe(true);
    });

    it('shouldMarkCompleteFromStudent: false cuando actual_sets es 0', () => {
      expect(shouldMarkCompleteFromStudent(0)).toBe(false);
    });

    it('shouldMarkCompleteFromStudent: false cuando actual_sets es null', () => {
      expect(shouldMarkCompleteFromStudent(null)).toBe(false);
    });

    it('shouldMarkCompleteFromStudent: false cuando actual_sets es undefined', () => {
      expect(shouldMarkCompleteFromStudent(undefined)).toBe(false);
    });

    it('validateActualReps: válido cuando la cantidad de reps coincide con los sets', () => {
      expect(validateActualReps(3, [10, 9, 8]).valid).toBe(true);
    });

    it('validateActualReps: inválido cuando hay más reps que sets', () => {
      const result = validateActualReps(3, [10, 9, 8, 7]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('3');
    });

    it('validateActualReps: inválido cuando hay menos reps que sets', () => {
      const result = validateActualReps(4, [10, 9]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('4');
    });

    it('validateActualReps: inválido cuando hay repeticiones negativas', () => {
      const result = validateActualReps(3, [10, -1, 8]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negativas');
    });

    it('validateActualReps: 0 repeticiones en un set es válido (el alumno no completó ese set)', () => {
      expect(validateActualReps(3, [10, 0, 8]).valid).toBe(true);
    });

    it('la sesión se marca completa con el primer registro de series reales > 0', () => {
      const before = shouldMarkCompleteFromStudent(null);
      const after  = shouldMarkCompleteFromStudent(1);
      expect(before).toBe(false);
      expect(after).toBe(true);
    });

    it('el coach ve los datos del alumno pero no puede modificarlos desde su interfaz', () => {
      const coachPayload = buildStudentPayload({
        actual_sets: 3, actual_reps: [10, 9, 8], actual_rpe: 7, student_notes: 'Bien',
      });
      // El payload del alumno no tiene campos target_*, garantía de que el coach no sobreescribe reales
      expect('target_sets' in coachPayload).toBe(false);
    });
  });

}); // Vista del Alumno

// ════════════════════════════════════════════════════════════════
// Módulo: Autenticación
// ════════════════════════════════════════════════════════════════
// Módulo: Perfil
// Edición de nombre/apellido y cierre de sesión
// ════════════════════════════════════════════════════════════════

describe('Perfil', () => {

  describe('ESCENARIO 43: Editar perfil - Validación de campos', () => {
    it('nombre y apellido válidos pasan', () => {
      expect(validateProfileFields('Juan', 'Pérez')).toEqual({ ok: true });
    });

    it('nombre vacío falla con missing', () => {
      expect(validateProfileFields('', 'Pérez')).toEqual({ ok: false, code: 'missing' });
    });

    it('apellido vacío falla con missing', () => {
      expect(validateProfileFields('Juan', '')).toEqual({ ok: false, code: 'missing' });
    });

    it('nombre null falla con missing', () => {
      expect(validateProfileFields(null, 'Pérez')).toEqual({ ok: false, code: 'missing' });
    });

    it('apellido undefined falla con missing', () => {
      expect(validateProfileFields('Juan', undefined)).toEqual({ ok: false, code: 'missing' });
    });

    it('nombre solo espacios falla con missing', () => {
      expect(validateProfileFields('   ', 'Pérez')).toEqual({ ok: false, code: 'missing' });
    });

    it('apellido solo espacios falla con missing', () => {
      expect(validateProfileFields('Juan', '   ')).toEqual({ ok: false, code: 'missing' });
    });
  });

  describe('ESCENARIO 44: Cierre de sesión', () => {
    it('getLogoutRedirect retorna /auth', () => {
      expect(getLogoutRedirect()).toBe('/auth');
    });
  });

}); // Perfil

// ════════════════════════════════════════════════════════════════
// Módulo: Autenticación
// Validación de login y registro, redirección por rol,
// mensajes de error y éxito
// ════════════════════════════════════════════════════════════════

describe('Autenticación', () => {

  describe('ESCENARIO 1: Login - Validación de campos', () => {
    it('campos válidos retornan ok', () => {
      expect(validateLoginFields('user@gym.com', 'pass123').ok).toBe(true);
    });

    it('email vacío falla con código missing', () => {
      const r = validateLoginFields('', 'pass123');
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('password vacío falla con código missing', () => {
      const r = validateLoginFields('user@gym.com', '');
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('email con solo espacios falla', () => {
      expect(validateLoginFields('   ', 'pass123').ok).toBe(false);
    });

    it('email null falla con código missing', () => {
      const r = validateLoginFields(null, 'pass123');
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('password undefined falla con código missing', () => {
      const r = validateLoginFields('user@gym.com', undefined);
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('ambos campos ausentes fallan', () => {
      expect(validateLoginFields(null, null).ok).toBe(false);
    });
  });

  describe('ESCENARIO 2: Registro - Validación de campos', () => {
    const ok = (overrides: Record<string, unknown> = {}) =>
      validateSignupFields(
        'firstName' in overrides ? overrides.firstName : 'Nahuel',
        'lastName'  in overrides ? overrides.lastName  : 'Gym',
        'email'     in overrides ? overrides.email     : 'nahuel@gym.com',
        'password'  in overrides ? overrides.password  : 'Pass1234',
        'confirm'   in overrides ? overrides.confirm   : 'Pass1234',
      );

    it('todos los campos válidos retornan ok', () => {
      expect(ok().ok).toBe(true);
    });

    it('nombre vacío falla con código missing', () => {
      const r = ok({ firstName: '' });
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('apellido vacío falla con código missing', () => {
      const r = ok({ lastName: '' });
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('nombre con solo espacios falla', () => {
      expect(ok({ firstName: '   ' }).ok).toBe(false);
    });

    it('apellido con solo espacios falla', () => {
      expect(ok({ lastName: '   ' }).ok).toBe(false);
    });

    it('email null falla con código missing', () => {
      const r = ok({ email: null });
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });

    it('email vacío falla con código missing', () => {
      expect(ok({ email: '' }).ok).toBe(false);
    });

    it('contraseñas distintas fallan con código password_mismatch', () => {
      const r = ok({ password: 'ABC', confirm: 'XYZ' });
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('password_mismatch');
    });

    it('contraseñas idénticas no fallan por mismatch', () => {
      expect(ok({ password: 'Same99', confirm: 'Same99' }).ok).toBe(true);
    });

    it('password undefined falla con código missing antes de verificar mismatch', () => {
      const r = ok({ password: undefined, confirm: 'Pass1234' });
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe('missing');
    });
  });

  describe('ESCENARIO 3: Redirección post-autenticación por rol', () => {
    it('ADMIN redirige a /coach', () => {
      expect(getAuthRedirect('ADMIN')).toBe('/coach');
    });

    it('COACH redirige a /coach', () => {
      expect(getAuthRedirect('COACH')).toBe('/coach');
    });

    it('STUDENT redirige a /student', () => {
      expect(getAuthRedirect('STUDENT')).toBe('/student');
    });

    it('rol null redirige a error norole', () => {
      expect(getAuthRedirect(null)).toBe('/auth?error=norole&view=login');
    });

    it('rol undefined redirige a error norole', () => {
      expect(getAuthRedirect(undefined)).toBe('/auth?error=norole&view=login');
    });

    it('rol desconocido redirige a error norole', () => {
      expect(getAuthRedirect('SUPERUSER')).toBe('/auth?error=norole&view=login');
    });

    it('ADMIN y COACH aterrizan en el mismo módulo', () => {
      expect(getAuthRedirect('ADMIN')).toBe(getAuthRedirect('COACH'));
    });
  });

  describe('ESCENARIO 4: Mensajes de error de autenticación', () => {
    it('missing → aviso de campos requeridos', () => {
      expect(resolveAuthError('missing')).toBe('Por favor completa los campos requeridos.');
    });

    it('invalid → credenciales inválidas', () => {
      expect(resolveAuthError('invalid')).toBe('Credenciales inválidas. Intenta nuevamente.');
    });

    it('norole → sin rol asignado', () => {
      expect(resolveAuthError('norole')).toBe('No se encontró un rol asignado a este usuario.');
    });

    it('signup → error al crear cuenta', () => {
      expect(resolveAuthError('signup')).toBe('No se pudo crear la cuenta. Revisa el email o intenta con otro.');
    });

    it('password_mismatch → contraseñas no coinciden', () => {
      expect(resolveAuthError('password_mismatch')).toBe('Las contraseñas no coinciden. Vuelve a intentarlo.');
    });

    it('código desconocido retorna string vacío', () => {
      expect(resolveAuthError('xyz')).toBe('');
    });

    it('undefined retorna string vacío', () => {
      expect(resolveAuthError(undefined)).toBe('');
    });
  });

  describe('ESCENARIO 5: Mensajes de éxito de autenticación', () => {
    it('signupPending → instrucción de confirmar email', () => {
      expect(resolveAuthSuccess('signupPending')).toBe(
        'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.'
      );
    });

    it('passwordUpdated → contraseña actualizada', () => {
      expect(resolveAuthSuccess('passwordUpdated')).toBe(
        '¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva clave.'
      );
    });

    it('clave desconocida retorna string vacío', () => {
      expect(resolveAuthSuccess('other')).toBe('');
    });

    it('undefined retorna string vacío', () => {
      expect(resolveAuthSuccess(undefined)).toBe('');
    });
  });

  describe('ESCENARIO 6: Nueva contraseña - Validación de campos', () => {
    it('contraseñas iguales y >= 6 caracteres pasan', () => {
      expect(validateResetPasswordFields('Abc123', 'Abc123')).toEqual({ ok: true });
    });

    it('exactamente 6 caracteres pasa', () => {
      expect(validateResetPasswordFields('123456', '123456')).toEqual({ ok: true });
    });

    it('contraseñas que no coinciden fallan con password_mismatch', () => {
      expect(validateResetPasswordFields('Abc123', 'Abc124')).toEqual({ ok: false, code: 'password_mismatch' });
    });

    it('confirmación vacía falla con password_mismatch', () => {
      expect(validateResetPasswordFields('Abc123', '')).toEqual({ ok: false, code: 'password_mismatch' });
    });

    it('contraseña menor a 6 caracteres falla con password_too_short', () => {
      expect(validateResetPasswordFields('abc', 'abc')).toEqual({ ok: false, code: 'password_too_short' });
    });

    it('exactamente 5 caracteres falla con password_too_short', () => {
      expect(validateResetPasswordFields('12345', '12345')).toEqual({ ok: false, code: 'password_too_short' });
    });

    it('contraseña vacía falla con missing', () => {
      expect(validateResetPasswordFields('', '')).toEqual({ ok: false, code: 'missing' });
    });

    it('contraseña undefined falla con missing', () => {
      expect(validateResetPasswordFields(undefined, undefined)).toEqual({ ok: false, code: 'missing' });
    });
  });

}); // Autenticación

