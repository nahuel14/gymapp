import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Autenticación', () => {
  // Garantiza contexto limpio en UI mode (en headless es no-op ya que los contextos son frescos)
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('login como coach redirige a /coach y muestra el panel', async ({ page }) => {
    await loginAs(page, 'coach');
    await expect(page).toHaveURL(/\/coach/);
    await expect(page.getByText('Panel de alumnos')).toBeVisible();
  });

  test('login como alumno redirige a /student', async ({ page }) => {
    await loginAs(page, 'student');
    await expect(page).toHaveURL(/\/student/);
  });

  test('credenciales incorrectas muestran mensaje de error', async ({ page }) => {
    await page.goto('/auth?view=login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[name="email"]', 'noexiste@beegym.test');
    await page.fill('input[name="password"]', 'contraseña-incorrecta-000');
    await page.click('button[type="submit"]');
    // El Server Action redirige a /auth?error=invalid — esperar que la URL cambie primero
    await page.waitForURL(/error=invalid/, { timeout: 15_000 });
    await expect(page.locator('.text-red-700')).toBeVisible();
  });

  test('acceso no autenticado a /coach redirige a /auth', async ({ page }) => {
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });

  test('acceso no autenticado a /student redirige a /auth', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });

  test('la página de login muestra los tabs Iniciar sesión / Crear cuenta', async ({ page }) => {
    await page.goto('/auth?view=login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Iniciar sesión')).toBeVisible();
    await expect(page.getByText('Crear cuenta')).toBeVisible();
  });

  test('el tab Crear cuenta muestra los campos de nombre y apellido', async ({ page }) => {
    await page.goto('/auth?view=signup');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('input[name="first_name"]')).toBeVisible();
    await expect(page.locator('input[name="last_name"]')).toBeVisible();
    await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
  });
});
