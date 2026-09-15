/**
 * Central, build-safe configuration helpers.
 *
 * The critical rule here: environment variables on hosting platforms
 * (Vercel, etc.) are frequently PRESENT but set to an EMPTY STRING "".
 * An empty string is NOT null/undefined, so `process.env.X ?? fallback`
 * does NOT apply the fallback — it returns "". Passing "" to `new URL()`
 * throws `ERR_INVALID_URL (input: '')`.
 *
 * `env()` below normalises empty/whitespace-only values to `undefined`
 * so `??` and `||` fallbacks behave as intended everywhere.
 */

/** Read an env var, treating empty / whitespace-only strings as unset. */
export function env(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

/** True when an optional env var is actually configured (non-empty). */
export function hasEnv(name: string): boolean {
  return env(name) !== undefined;
}

const DEFAULT_APP_URL = "http://localhost:3000";

/**
 * The public app URL, always a valid absolute URL string.
 * - Uses NEXT_PUBLIC_APP_URL when it is a valid absolute URL.
 * - Falls back to Vercel's system-provided host during preview/prod builds.
 * - Falls back to localhost for local/dev builds.
 * Never throws — safe to call in module scope (metadata, sitemap, robots).
 */
export function getAppUrl(): string {
  const explicit = env("NEXT_PUBLIC_APP_URL");
  if (explicit && isValidHttpUrl(explicit)) return stripTrailingSlash(explicit);

  // Vercel exposes the deployment host (without protocol) at build & runtime.
  const vercel = env("VERCEL_URL") ?? env("NEXT_PUBLIC_VERCEL_URL");
  if (vercel) {
    const candidate = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    if (isValidHttpUrl(candidate)) return stripTrailingSlash(candidate);
  }

  return DEFAULT_APP_URL;
}

/** A guaranteed-valid URL instance for Next.js `metadataBase`. */
export function getMetadataBase(): URL {
  // getAppUrl() only ever returns a validated absolute URL, so this is safe.
  return new URL(getAppUrl());
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
