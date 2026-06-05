type AuthOk = { ok: true };
type AuthError = { ok: false; code: 'missing' | 'password_mismatch' | 'password_too_short' };

export type LoginValidationResult = AuthOk | AuthError;
export type SignupValidationResult = AuthOk | AuthError;

export function validateLoginFields(
  email: unknown,
  password: unknown,
): LoginValidationResult {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim().length === 0 ||
    password.trim().length === 0
  ) {
    return { ok: false, code: 'missing' };
  }
  return { ok: true };
}

export function validateSignupFields(
  firstName: unknown,
  lastName: unknown,
  email: unknown,
  password: unknown,
  confirmPassword: unknown,
): SignupValidationResult {
  if (
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0
  ) {
    return { ok: false, code: 'missing' };
  }
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof confirmPassword !== 'string' ||
    email.trim().length === 0
  ) {
    return { ok: false, code: 'missing' };
  }
  if (password !== confirmPassword) {
    return { ok: false, code: 'password_mismatch' };
  }
  return { ok: true };
}

export function getAuthRedirect(role: string | null | undefined): string {
  if (role === 'ADMIN' || role === 'COACH') return '/coach';
  if (role === 'STUDENT') return '/student';
  return '/auth?error=norole&view=login';
}

export function resolveAuthError(errorKey: string | undefined): string {
  switch (errorKey) {
    case 'missing':          return 'Por favor completa los campos requeridos.';
    case 'invalid':          return 'Credenciales inválidas. Intenta nuevamente.';
    case 'norole':           return 'No se encontró un rol asignado a este usuario.';
    case 'signup':           return 'No se pudo crear la cuenta. Revisa el email o intenta con otro.';
    case 'password_mismatch':return 'Las contraseñas no coinciden. Vuelve a intentarlo.';
    default:                 return '';
  }
}

export type ResetPasswordValidationResult = AuthOk | AuthError;

export function validateResetPasswordFields(
  password: unknown,
  confirmPassword: unknown,
): ResetPasswordValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, code: 'missing' };
  }
  if (password !== confirmPassword) {
    return { ok: false, code: 'password_mismatch' };
  }
  if (password.length < 6) {
    return { ok: false, code: 'password_too_short' };
  }
  return { ok: true };
}

export function resolveAuthSuccess(successKey: string | undefined): string {
  switch (successKey) {
    case 'signupPending':   return 'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';
    case 'passwordUpdated': return '¡Contraseña actualizada! Ya puedes iniciar sesión con tu nueva clave.';
    default:                return '';
  }
}
