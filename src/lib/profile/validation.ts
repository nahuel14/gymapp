type ProfileOk = { ok: true };
type ProfileError = { ok: false; code: 'missing' };

export type ProfileValidationResult = ProfileOk | ProfileError;

export function validateProfileFields(
  name: unknown,
  lastName: unknown,
): ProfileValidationResult {
  if (
    typeof name !== 'string' || name.trim().length === 0 ||
    typeof lastName !== 'string' || lastName.trim().length === 0
  ) {
    return { ok: false, code: 'missing' };
  }
  return { ok: true };
}

export function getLogoutRedirect(): string {
  return '/auth';
}
