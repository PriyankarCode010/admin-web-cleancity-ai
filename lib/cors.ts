import { NextResponse } from "next/server";

/** Origins allowed for Expo / web dev and local admin. */
const ALLOWED_PREFIXES = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:19000",
  "exp://localhost:8081",
  "http://localhost:3000",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_PREFIXES.some((p) => origin.startsWith(p));
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
