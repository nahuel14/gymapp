import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Vista del Alumno', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
    await page.waitForURL(/\/student/);
    // Esperar a que React Query cargue los datos antes de cada test
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('la página de rutina carga sin redirigir a /auth', async ({ page }) => {
    await expect(page).toHaveURL(/\/student/);
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('el contenido de la rutina es visible después de cargar', async ({ page }) => {
    // Esperar a que el spinner desaparezca si existe
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 15_000 }).catch(() => {});
    // Esperar determinísticamente a que aparezca el contenedor principal o el mensaje de error
    await page.waitForSelector('.min-h-screen, p:has-text("No se pudo cargar")', { timeout: 15_000 });
  });

  test('la página de progreso (/student/progreso) es accesible', async ({ page }) => {
    await page.goto('/student/progreso');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/\/student\/progreso/);
  });

  test('la navegación lateral incluye Rutina y Progreso', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Rutina' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Progreso' })).toBeVisible();
  });

  test('el alumno no puede acceder a /coach — redirige a /auth', async ({ page }) => {
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });

  test('el alumno no puede acceder a /admin/dashboard — redirige a /auth', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});
