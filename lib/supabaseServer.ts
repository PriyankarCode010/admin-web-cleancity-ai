import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { dbgErr } from "./debugLog";

/* ============================================================
   ENV VARIABLES
============================================================ */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "❌ SUPABASE_URL is not set. Add it to your .env file."
  );
}

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "❌ SUPABASE_SERVICE_ROLE_KEY is required for API routes."
  );
}

/* ============================================================
   SERVICE ROLE CLIENT (BYPASSES RLS)
   Only used in API routes (server-side)
============================================================ */

let serviceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serviceClient;
}

/* ============================================================
   AUTHENTICATED USER TYPE
============================================================ */

export type AuthenticatedUser = User & {
  user_metadata: {
    role?: "admin" | "worker" | "citizen" | string;
    [key: string]: any;
  };
};

/* ============================================================
   GET USER FROM REQUEST (VALIDATES ACCESS TOKEN)
============================================================ */

export async function getUserFromRequest(
  req: Request
): Promise<{
  user: AuthenticatedUser | null;
  accessToken: string | null;
  error: string | null;
}> {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        user: null,
        accessToken: null,
        error: "Missing Authorization header",
      };
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return {
        user: null,
        accessToken: null,
        error: "Invalid access token",
      };
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      return {
        user: null,
        accessToken,
        error: error?.message || "Invalid or expired token",
      };
    }

    return {
      user: data.user as AuthenticatedUser,
      accessToken,
      error: null,
    };
  } catch (err) {
    dbgErr("getUserFromRequest", "Auth validation error", err);
    return {
      user: null,
      accessToken: null,
      error: "Auth validation failed",
    };
  }
}
