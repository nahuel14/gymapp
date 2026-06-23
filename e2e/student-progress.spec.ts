import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Progreso del Alumno', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
    await page.waitForURL(/\/student/);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.goto('/student/progreso');
    await page.waitForLoadState('domcontentloaded');
    // Esperar a que React Query y los gráficos dinámicos carguen
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('la página de progreso no redirige a /auth', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/\/student\/progreso/);
  });

  test('muestra el encabezado Mi Progreso', async ({ page }) => {
    await expect(page.getByText('Mi Progreso')).toBeVisible({ timeout: 12_000 });
  });

  test('los tabs Volumen, Fuerza y Asistencia son visibles', async ({ page }) => {
    // Usar getByRole para evitar colisiones con subtítulos del gráfico (strict mode)
    await expect(page.getByRole('button', { name: 'Volumen' })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: 'Fuerza' })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: 'Asistencia' })).toBeVisible({ timeout: 12_000 });
  });

  test('el toggle Semanas / Meses es visible', async ({ page }) => {
    await expect(page.getByText('Semanas')).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText('Meses')).toBeVisible({ timeout: 12_000 });
  });

  test('clic en tab Fuerza no rompe la página', async ({ page }) => {
    await page.getByText('Fuerza').click();
    // Esperar a que se estabilice (spinner desaparece o contenido renderiza)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/\/student\/progreso/);
  });

  test('clic en tab Asistencia no rompe la página', async ({ page }) => {
    await page.getByText('Asistencia').click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/\/student\/progreso/);
  });

  test('clic en Meses no rompe la página', async ({ page }) => {
    await page.getByText('Meses').click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL(/\/auth/);
    // El toggle cambia visualmente — el contenedor principal sigue en pantalla
    await expect(page.locator('div.min-h-screen')).toBeVisible({ timeout: 8_000 });
  });
});
