import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Detalle del alumno (Coach)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'coach');
    await page.waitForURL(/\/coach/);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('clic en primer alumno navega a la página de detalle', async ({ page }) => {
    const firstStudent = page.locator('a[href^="/coach/student/"]').first();
    const hasStudents = await firstStudent.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasStudents) {
      test.skip();
      return;
    }
    await firstStudent.click();
    await expect(page).toHaveURL(/\/coach\/student\/.+/, { timeout: 15_000 });
  });

  test('la página de detalle muestra el toggle Plan / Progreso', async ({ page }) => {
    const firstStudent = page.locator('a[href^="/coach/student/"]').first();
    const hasStudents = await firstStudent.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasStudents) {
      test.skip();
      return;
    }
    await firstStudent.click();
    await page.waitForURL(/\/coach\/student\/.+/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page.getByRole('button', { name: 'Ver plan' })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: 'Ver progreso' })).toBeVisible({ timeout: 12_000 });
  });

  test('el botón Ver progreso cambia a la vista de progreso del alumno', async ({ page }) => {
    const firstStudent = page.locator('a[href^="/coach/student/"]').first();
    const hasStudents = await firstStudent.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasStudents) {
      test.skip();
      return;
    }
    await firstStudent.click();
    await page.waitForURL(/\/coach\/student\/.+/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.getByRole('button', { name: 'Ver progreso' }).click();
    // StudentProgressClient renderiza el contenedor principal
    await expect(page.locator('div.min-h-screen')).toBeVisible({ timeout: 12_000 });
    // Los tabs de progreso son accesibles
    const tabContainer = page.locator('div.rounded-xl.bg-zinc-900').first();
    await expect(tabContainer).toBeVisible({ timeout: 12_000 });
  });

  test('el link de volver al panel navega a /coach', async ({ page }) => {
    const firstStudent = page.locator('a[href^="/coach/student/"]').first();
    const hasStudents = await firstStudent.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasStudents) {
      test.skip();
      return;
    }
    await firstStudent.click();
    await page.waitForURL(/\/coach\/student\/.+/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.getByRole('link', { name: /volver/i }).or(page.locator('a[href="/coach"]').first()).click();
    await expect(page).toHaveURL(/\/coach$/, { timeout: 10_000 });
  });
});
