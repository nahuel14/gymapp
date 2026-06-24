import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const PLAN_NAME = `[E2E] Plan Test ${Date.now()}`;
let savedStudentId = '';

// ── beforeAll: obtener studentId y limpiar planes [E2E] residuales ─────────────

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    // Obtener el ID del alumno de test
    await loginAs(p, 'student');
    await p.waitForURL(/\/student/);
    const resp = await p.request.get('/api/user');
    const { user } = await resp.json();
    savedStudentId = user?.id ?? '';
    if (!savedStudentId) return;

    // Cambiar a coach y eliminar cualquier plan [E2E] que haya quedado de runs anteriores
    await p.context().clearCookies();
    await loginAs(p, 'coach');
    await p.goto(`/coach/student/${savedStudentId}`);
    await p.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const nextBtn = p
      .locator('span', { hasText: /Semana|Navegación/ })
      .locator('xpath=..')
      .locator('button')
      .last();

    // Recorrer hasta 12 semanas y borrar cualquier plan con prefijo [E2E]
    for (let w = 0; w < 12; w++) {
      const isE2ePlan = await p.locator('h2', { hasText: '[E2E]' })
        .isVisible({ timeout: 800 }).catch(() => false);
      if (isE2ePlan) {
        await p.getByRole('button', { name: 'Gestionar' }).click({ timeout: 5_000 });
        await p.locator('button:has-text("ELIMINAR PLAN")').click();
        await p.getByRole('button', { name: 'SÍ, ELIMINAR' }).click();
        await p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      }
      await nextBtn.click();
      await p.waitForTimeout(400);
    }
  } finally {
    await ctx.close();
  }
});

// ── Test principal ──────────────────────────────────────────────────────────────

test.describe('Flujo completo: Coach planifica → Alumno registra sesión', () => {

  test('flujo e2e: plan de 1 semana, sesión, ejercicio y registro del alumno', async ({ page }) => {

    // ── PASO 1: Coach navega al detalle del alumno de test ────────────────────
    await test.step('Coach: login y navegar al detalle del alumno', async () => {
      expect(savedStudentId).toBeTruthy();

      await loginAs(page, 'coach');
      await page.waitForURL(/\/coach/);
      await page.goto(`/coach/student/${savedStudentId}`);
      await expect(page).toHaveURL(new RegExp(`/coach/student/${savedStudentId}`));
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    });

    // ── PASO 2: Coach crea plan de 1 semana en blanco ─────────────────────────
    // Se avanza 2 semanas en el modal para evitar PLAN_COLLISION con planes activos.
    await test.step('Coach: crear plan de 1 semana en blanco', async () => {
      await page.getByRole('button', { name: 'Nuevo Plan' }).click();
      await expect(page.locator('h3:has-text("Nuevo Plan")')).toBeVisible({ timeout: 8_000 });

      // Nombre del plan (único por ejecución gracias a Date.now())
      await page.getByPlaceholder('Ej: Potencia Junio').fill(PLAN_NAME);

      // ── WeekNavigator: avanzar 2 semanas ──────────────────────────────────
      // La estructura del WeekNavigator es:
      //   div.flex.items-center.gap-2 (root)
      //     button ChevronLeft
      //     div.flex-1.rounded-xl.border-2.bg-zinc-900 (display, contiene el <p>)
      //       p "Lun. {date}"
      //     button ChevronRight  ← queremos ESTE
      //
      // Localizamos el div display (que contiene el párrafo "Lun.") y tomamos
      // el sibling button posterior = ChevronRight.
      const weekNavNext = page
        .locator('div.flex-1.rounded-xl')
        .filter({ has: page.locator('p:has-text("Lun.")') })
        .locator('xpath=following-sibling::button[last()]');

      await weekNavNext.click();
      await page.waitForTimeout(400);
      await weekNavNext.click();
      await page.waitForTimeout(400);

      // ── Stepper Duración: 4 → 1 semana ───────────────────────────────────
      // Estructura: span"4 semanas" → div.flex-1 → Stepper root → button.first()
      const durationMinus = page
        .locator('span:has-text("semana")')
        .locator('xpath=../..')
        .locator('button')
        .first();

      await durationMinus.click(); // 4 → 3
      await durationMinus.click(); // 3 → 2
      await durationMinus.click(); // 2 → 1

      // Crear el plan
      await page.getByRole('button', { name: 'CREAR PLAN' }).click();

      // Esperar a que el modal se cierre (la h3 desaparece cuando onClose() se ejecuta)
      await expect(page.locator('h3:has-text("Nuevo Plan")')).not.toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // Navegar semanas adelante hasta que el nombre del plan sea visible (máx. 6 clicks)
      // El plan name aparece en el header del calendario solo cuando la semana del plan
      // está siendo visualizada.
      const calendarNextBtn = page
        .locator('span', { hasText: /Semana|Navegación/ })
        .locator('xpath=..')
        .locator('button')
        .last();

      for (let i = 0; i < 6; i++) {
        if (await page.getByText(PLAN_NAME, { exact: true }).isVisible()) break;
        await calendarNextBtn.click();
        await page.waitForTimeout(400);
      }

      await expect(page.getByText(PLAN_NAME, { exact: true })).toBeVisible({ timeout: 8_000 });
    });

    // ── PASO 3: Coach inicia un día (crea sesión para el Lunes) ───────────────
    await test.step('Coach: iniciar día de entrenamiento (Lunes)', async () => {
      // Pill del Lunes — texto "L" + número de día (ej: "L13")
      await page.locator('button').filter({ hasText: /^L\s*\d/ }).first().click();

      // Estado vacío del día → "Iniciar día" button
      await expect(page.locator('button:has-text("Iniciar día")')).toBeVisible({ timeout: 8_000 });
      await page.locator('button:has-text("Iniciar día")').click();

      // Modal de confirmación → "Confirmar"
      await page.locator('button:has-text("Confirmar")').click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // La sesión fue creada: el botón "Ejercicio" aparece (solo cuando hay sesión activa)
      await expect(page.getByRole('button', { name: 'Ejercicio' })).toBeVisible({ timeout: 10_000 });
    });

    // ── PASO 4: Coach agrega un ejercicio a la sesión ─────────────────────────
    await test.step('Coach: agregar ejercicio a la sesión', async () => {
      // Botón "Ejercicio" (texto visible en viewport Desktop Chrome sm+)
      await page.getByRole('button', { name: 'Ejercicio' }).click();

      // Abrir dropdown y elegir el primer ejercicio disponible
      await page.locator('button:has-text("Buscar ejercicio...")').click();
      await page.locator('div.max-h-52 button').first().click();

      // Guardar
      await page.getByRole('button', { name: 'Guardar en Rutina' }).click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // El ejercicio debe aparecer en el grid del coach (no más "Sin ejercicios para este día")
      await expect(page.locator('text=Sin ejercicios para este día')).not.toBeVisible({ timeout: 10_000 });
    });

    // ── PASO 5: Alumno registra resultados de la sesión ───────────────────────
    await test.step('Alumno: login y registrar resultados', async () => {
      await page.context().clearCookies();
      await loginAs(page, 'student');
      await page.waitForURL(/\/student/);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // Navegar semanas adelante hasta encontrar el plan del test
      const studentNextBtn = page
        .locator('span', { hasText: /Semana|Navegación/ })
        .locator('xpath=..')
        .locator('button')
        .last();

      for (let i = 0; i < 6; i++) {
        if (await page.getByText(PLAN_NAME, { exact: true }).isVisible()) break;
        await studentNextBtn.click();
        await page.waitForTimeout(400);
      }

      await expect(page.getByText(PLAN_NAME, { exact: true })).toBeVisible({ timeout: 8_000 });

      // Pill del Lunes (texto "L" + número de día)
      await page.locator('button').filter({ hasText: /^L\s*\d/ }).first().click();

      // Expandir la tarjeta del ejercicio — el botón chevron (h-7 w-7)
      await page.locator('button.h-7.w-7').first().click({ timeout: 8_000 });

      // "Registrar Resultados" (botón verde, visible cuando no hay datos del alumno)
      await page.getByRole('button', { name: 'Registrar Resultados' }).click();

      // Rellenar RPE — campo obligatorio (el botón Guardar está deshabilitado sin él)
      await page.locator('input[placeholder="Del 1 al 10"]').fill('8');

      // Guardar resultados
      await page.getByRole('button', { name: 'Guardar Cambios' }).click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // Verificar guardado: "Registrar Resultados" ya no está visible
      await expect(
        page.getByRole('button', { name: 'Registrar Resultados' })
      ).not.toBeVisible({ timeout: 8_000 });
    });
  });

  // ── afterAll: eliminar el plan de test (cascadea sesiones + ejercicios + datos) ─
  test.afterAll(async ({ browser }) => {
    if (!savedStudentId) return;
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, 'coach');
      await p.goto(`/coach/student/${savedStudentId}`);
      await p.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      const nextBtn = p
        .locator('span', { hasText: /Semana|Navegación/ })
        .locator('xpath=..')
        .locator('button')
        .last();

      // Buscar específicamente nuestro plan por nombre (evita borrar planes de otros)
      let found = false;
      for (let w = 0; w < 10; w++) {
        const visible = await p.getByText(PLAN_NAME, { exact: true })
          .isVisible({ timeout: 800 }).catch(() => false);
        if (visible) { found = true; break; }
        await nextBtn.click();
        await p.waitForTimeout(400);
      }

      if (!found) return;

      await p.getByRole('button', { name: 'Gestionar' }).click({ timeout: 8_000 });
      await p.locator('button:has-text("ELIMINAR PLAN")').click();
      await p.getByRole('button', { name: 'SÍ, ELIMINAR' }).click();
      await p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    } finally {
      await ctx.close();
    }
  });
});
