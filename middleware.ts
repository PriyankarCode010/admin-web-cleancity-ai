import { NextResponse, type NextRequest } from "next/server";
import { dbg } from "./lib/debugLog";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/_next",
  "/favicon.ico",
  "/api/auth",
  "/auth",
  "/dashboard",
  "/dashboard/settings",
  "/dashboard/settings/profile",
  "/dashboard/settings/profile/edit",
  "/dashboard/settings/profile/edit/save",
];

// For now, no server-side auth; everything is handled client-side.
export async function middleware(req: NextRequest) {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  dbg("middleware", "pass through (frontend-only auth)", {
    method: req.method,
    path: req.nextUrl.pathname,
    isPublic,
  });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
