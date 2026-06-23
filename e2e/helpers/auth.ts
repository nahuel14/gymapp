import { type Page } from '@playwright/test';

type Role = 'coach' | 'student' | 'admin';

const CREDS: Record<Role, { email: string; password: string }> = {
  coach: {
    email: process.env.TEST_COACH_EMAIL ?? '',
    password: process.env.TEST_COACH_PASSWORD ?? '',
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL ?? '',
    password: process.env.TEST_STUDENT_PASSWORD ?? '',
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? '',
    password: process.env.TEST_ADMIN_PASSWORD ?? '',
  },
};

/**
 * Navega a /auth, completa el formulario de login y espera que el Server Action
 * redirija al usuario fuera de /auth según su rol.
 *
 * Espera a que el DOM esté listo antes de interactuar (evita race conditions en UI mode)
 * y luego aguarda a que la red se estabilice después de la redirección.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const { email, password } = CREDS[role];

  // Limpia cookies antes de loguear para garantizar aislamiento en UI mode
  // (en modo headless los contextos ya son frescos — esto es un no-op seguro)
  await page.context().clearCookies();

  await page.goto('/auth?view=login');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Espera a que el Server Action complete la redirección (puede tardar más en UI mode)
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 });

  // Deja que React hidrate y React Query cargue datos iniciales
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
