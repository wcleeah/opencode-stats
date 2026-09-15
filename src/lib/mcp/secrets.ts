/**
 * Railway / .env values are often wrapped in quotes or prefixed with `Bearer `.
 * Sending those bytes as-is makes vendor APIs return 401.
 */
export function normalizeSecret(value: string | undefined | null): string | null {
  if (value == null) return null;
  let secret = value.trim();
  if (!secret) return null;

  if (
    (secret.startsWith('"') && secret.endsWith('"') && secret.length >= 2) ||
    (secret.startsWith("'") && secret.endsWith("'") && secret.length >= 2)
  ) {
    secret = secret.slice(1, -1).trim();
  }

  if (/^bearer\s+/i.test(secret)) {
    secret = secret.replace(/^bearer\s+/i, '').trim();
  }

  return secret || null;
}
