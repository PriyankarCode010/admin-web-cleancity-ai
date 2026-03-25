import { NextResponse } from "next/server";
import { withCors } from "../../../lib/cors";
import { dbg, dbgErr } from "../../../lib/debugLog";
import { getSupabaseServiceClient, getUserFromRequest } from "../../../lib/supabaseServer";

// Force dynamic rendering - always fetch fresh data, no caching
export const dynamic = "force-dynamic";

const CORS_METHODS = "GET, POST, OPTIONS";

type BinRequestPayload = {
  latitude: number;
  longitude: number;
  address: string;
};

/** Accept numeric JSON or string coords from mobile clients */
function toCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Handle OPTIONS preflight requests
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, origin, CORS_METHODS);
}

// POST /api/bin-requests
// Used by the Expo citizen app. Requires a Supabase access token (Bearer).
export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    dbg("api/bin-requests", "POST start", { origin });
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      const response = NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
      return withCors(response, origin, CORS_METHODS);
    }

    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      dbg("api/bin-requests", "POST 401", { authError });
      const response = NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
      return withCors(response, origin, CORS_METHODS);
    }

    dbg("api/bin-requests", "POST authed", { userId: user.id });

    let body: Partial<BinRequestPayload>;
    try {
      body = (await req.json()) as Partial<BinRequestPayload>;
    } catch {
      const bad = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      return withCors(bad, origin, CORS_METHODS);
    }

    const { address } = body;
    const latitude = toCoord(body.latitude);
    const longitude = toCoord(body.longitude);

    const addressStr = typeof address === "string" ? address.trim() : "";
    if (latitude === null || longitude === null || !addressStr) {
      return withCors(
        NextResponse.json(
          { error: "Invalid payload. Expected { latitude: number, longitude: number, address: non-empty string }" },
          { status: 400 },
        ),
        origin,
        CORS_METHODS,
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return withCors(
        NextResponse.json(
          {
            error:
              "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.",
          },
          { status: 400 },
        ),
        origin,
        CORS_METHODS,
      );
    }

    if (addressStr.length > 512) {
      const response = NextResponse.json({ error: "Address is too long (max 512 characters)" }, { status: 400 });
      return withCors(response, origin, CORS_METHODS);
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("bin_requests")
      .insert({
        user_id: user.id,
        latitude,
        longitude,
        address: addressStr,
        status: "requested",
      })
      .select()
      .single();

    if (error) {
      dbgErr("api/bin-requests", "POST Supabase insert error", error);
      const response = NextResponse.json({ error: "Failed to create bin request" }, { status: 500 });
      return withCors(response, origin, CORS_METHODS);
    }

    dbg("api/bin-requests", "POST 201 created", { id: (data as { id?: string })?.id });
    const response = NextResponse.json(data, { status: 201 });
    return withCors(response, origin, CORS_METHODS);
  } catch (err) {
    dbgErr("api/bin-requests", "POST unexpected", err);
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return withCors(response, req.headers.get("origin"), CORS_METHODS);
  }
}

// GET /api/bin-requests
// Optional query params:
//   scope=all   -> admins see all; others still see just their own
//   limit       -> page size (default 50, max 200)
//   offset      -> offset for pagination (default 0)
export async function GET(req: Request) {
  const origin = req.headers.get("origin");

  try {
    dbg("api/bin-requests", "GET start", { origin, url: req.url });
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      dbg("api/bin-requests", "GET 401", { authError });
      const response = NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
      return withCors(response, origin, CORS_METHODS);
    }

    const supabase = getSupabaseServiceClient();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const role = (user.user_metadata?.role ?? "").toString();

    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    let limit = Number(limitParam ?? "50");
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    if (limit > 200) limit = 200;

    let offset = Number(offsetParam ?? "0");
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    let query = supabase.from("bin_requests").select("*").order("created_at", { ascending: false });

    const isAdminOrWorker = role === "admin" || role === "worker";
    if (!(isAdminOrWorker && scope === "all")) {
      query = query.eq("user_id", user.id);
    }

    // Supabase uses inclusive ranges.
    const { data, error } = await query.range(offset, offset + limit - 1);

    dbg("api/bin-requests", "GET query done", {
      role,
      scope,
      limit,
      offset,
      rowCount: Array.isArray(data) ? data.length : 0,
      error: error ? String(error.message) : null,
    });

    if (error) {
      dbgErr("api/bin-requests", "GET Supabase error", error);
      const response = NextResponse.json({ error: "Failed to fetch bin requests" }, { status: 500 });
      return withCors(response, origin, CORS_METHODS);
    }

    const response = NextResponse.json(data ?? [], { status: 200 });
    return withCors(response, origin, CORS_METHODS);
  } catch (err) {
    dbgErr("api/bin-requests", "GET unexpected", err);
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return withCors(response, req.headers.get("origin"), CORS_METHODS);
  }
}
