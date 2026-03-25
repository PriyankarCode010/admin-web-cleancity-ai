import { NextResponse } from "next/server";

/** Fixed dev origins (Expo web, Metro on localhost, admin). */
const ALLOWED_PREFIXES = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://localhost:19000",
  "exp://localhost:8081",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/** Extra allowed origins from env: `CORS_ALLOWED_ORIGINS=https://a.com,https://b.com` */
function extraOriginsFromEnv(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}

/**
 * Expo / React Native on a physical device uses the machine LAN IP (e.g. 192.168.1.5:8081),
 * not "localhost". Without this, browser preflight gets no ACAO header and the request fails.
 */
function isPrivateLanHttpOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

/** e.g. exp://192.168.1.5:8081 */
function isExpoSchemeOrigin(origin: string): boolean {
  return /^exp:\/\/.+/i.test(origin);
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;

  if (ALLOWED_PREFIXES.some((p) => origin.startsWith(p))) return true;

  if (extraOriginsFromEnv().includes(origin)) return true;

  if (isPrivateLanHttpOrigin(origin)) return true;

  if (isExpoSchemeOrigin(origin)) return true;

  if (/^capacitor:\/\//i.test(origin)) return true;

  const vercel =
    process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "";
  if (vercel && origin.replace(/\/+$/, "") === `https://${vercel.replace(/\/+$/, "")}`) {
    return true;
  }

  return false;
}

/**
 * Headers for CORS (credentialed requests need a concrete Origin, not *).
 */
export function corsHeaders(origin: string | null, methods: string): Record<string, string> {
  if (!isOriginAllowed(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function withCors(response: NextResponse, origin: string | null, methods: string): NextResponse {
  const h = corsHeaders(origin, methods);
  for (const [k, v] of Object.entries(h)) {
    response.headers.set(k, v);
  }
  return response;
}
