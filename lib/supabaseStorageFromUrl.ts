/**
 * Parse a Supabase Storage object URL into bucket + path for the Storage API.
 * Supports public, signed, and authenticated object URLs from the same project.
 */
export function parseSupabaseStorageObjectUrl(
  imageUrl: string,
  supabaseOrigin: string,
): { bucket: string; path: string } | null {
  let u: URL;
  try {
    u = new URL(imageUrl.trim());
  } catch {
    return null;
  }

  let base: URL;
  try {
    base = new URL(supabaseOrigin.replace(/\/+$/, ""));
  } catch {
    return null;
  }

  if (u.origin !== base.origin) {
    return null;
  }

  const pathname = u.pathname;
  const m = pathname.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );
  if (!m) {
    return null;
  }

  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  if (!bucket || !path) {
    return null;
  }

  return { bucket, path };
}

export function getSupabaseOriginFromEnv(): string | null {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw.replace(/\/+$/, "")).origin;
  } catch {
    return null;
  }
}
