import { headers } from "next/headers";

import { dbg } from "./debugLog";

/**
 * Absolute base URL for server-side `fetch()` to this app's own routes.
 * - Local: defaults to http://127.0.0.1:3000
 * - Vercel: uses VERCEL_URL (set automatically) or request Host / x-forwarded-* headers
 * - Override: set NEXT_PUBLIC_API_BASE_URL (e.g. https://your-domain.com) for all environments
 */
export function getServerFetchBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (fromEnv) {
    dbg("serverFetchBase", "using NEXT_PUBLIC_API_BASE_URL", { base: fromEnv });
    return fromEnv;
  }

  if (process.env.VERCEL_URL) {
    const base = `https://${process.env.VERCEL_URL}`;
    dbg("serverFetchBase", "using VERCEL_URL", { base, VERCEL_ENV: process.env.VERCEL_ENV });
    return base;
  }

  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? "https";
      const base = `${proto}://${host}`;
      dbg("serverFetchBase", "using request headers", { base, host });
      return base;
    }
  } catch {
    /* headers() unavailable outside a request */
  }

  dbg("serverFetchBase", "fallback localhost (no env, no headers)", {});
  return "http://127.0.0.1:3000";
}
