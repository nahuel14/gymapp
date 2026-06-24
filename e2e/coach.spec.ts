import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Dashboard del Coach', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'coach');
    await page.waitForURL(/\/coach/);
    // Esperar a que React Query cargue los datos antes de cada test
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('el panel de alumnos carga con el título correcto', async ({ page }) => {
    await expect(page.getByText('Panel de alumnos')).toBeVisible();
  });

  test('muestra la lista de alumnos o el estado vacío', async ({ page }) => {
    const firstStudent = page.locator('a[href^="/coach/student/"]').first();
    const emptyState = page.getByText('No tienes alumnos asignados.');
    await expect(firstStudent.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

test('la navegación lateral incluye Plantillas y Ejercicios', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Plantillas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ejercicios' })).toBeVisible();
  });
});
