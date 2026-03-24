import { NextResponse } from "next/server";
import { withCors } from "../../../../lib/cors";
import { dbg, dbgErr } from "../../../../lib/debugLog";
import { getSupabaseServiceClient, getUserFromRequest } from "../../../../lib/supabaseServer";

const CORS_METHODS = "GET, PATCH, DELETE, OPTIONS";

function json(body: unknown, status: number, origin: string | null) {
  return withCors(NextResponse.json(body, { status }), origin, CORS_METHODS);
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  dbg("api/bin-requests/[id]", "OPTIONS preflight", { origin });
  return withCors(new NextResponse(null, { status: 204 }), origin, CORS_METHODS);
}

// GET /api/bin-requests/:id
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    dbg("api/bin-requests/[id]", "GET", { id: params.id, origin });
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("bin_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      dbgErr("api/bin-requests/[id]", "GET Supabase error", error);
      return json({ error: "Failed to fetch bin request" }, 500, origin);
    }

    if (!data) {
      dbg("api/bin-requests/[id]", "GET not found", { id: params.id });
      return json({ error: "Not found" }, 404, origin);
    }

    dbg("api/bin-requests/[id]", "GET ok", { id: params.id });
    return json(data, 200, origin);
  } catch (err) {
    dbgErr("api/bin-requests/[id]", "GET unexpected", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}

// PATCH /api/bin-requests/:id
// Body: { status?: string }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    dbg("api/bin-requests/[id]", "PATCH start", { id: params.id, origin });
    const { user, error: authError } = await getUserFromRequest(req);
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    dbg("api/bin-requests/[id]", "PATCH auth", {
      userId: user?.id ?? null,
      role: (user?.user_metadata as { role?: string } | undefined)?.role ?? null,
      authError: authError ?? null,
      hasServiceRole,
    });

    const isAdminOrWorker =
      (user?.user_metadata?.role ?? "") === "admin" ||
      (user?.user_metadata?.role ?? "") === "worker" ||
      (!user && hasServiceRole);

    if (!user && !hasServiceRole) {
      dbg("api/bin-requests/[id]", "PATCH 401", { id: params.id });
      return json({ error: authError ?? "Unauthorized" }, 401, origin);
    }

    if (!isAdminOrWorker) {
      dbg("api/bin-requests/[id]", "PATCH 403 forbidden (not admin/worker)", { id: params.id });
      return json({ error: "Forbidden" }, 403, origin);
    }

    const body = (await req.json()) as { status?: string | null };
    const status = body?.status?.toLowerCase().trim();
    dbg("api/bin-requests/[id]", "PATCH body", { id: params.id, status });

    const validStatuses = ["requested", "approved", "in_progress", "installed"];

    if (!status || !validStatuses.includes(status)) {
      dbg("api/bin-requests/[id]", "PATCH 400 invalid status", { id: params.id, status });
      return json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        400,
        origin,
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data: existing, error: fetchError } = await supabase
      .from("bin_requests")
      .select("id, status")
      .eq("id", params.id)
      .maybeSingle();

    if (fetchError) {
      dbgErr("api/bin-requests/[id]", "PATCH Supabase fetch existing", fetchError);
      return json({ error: "Failed to update bin request" }, 500, origin);
    }

    if (!existing) {
      dbg("api/bin-requests/[id]", "PATCH 404 no row", { id: params.id });
      return json({ error: "Not found" }, 404, origin);
    }

    dbg("api/bin-requests/[id]", "PATCH existing row", {
      id: params.id,
      currentStatus: existing.status,
    });

    const role = (user?.user_metadata?.role ?? "").toString();
    if (role === "worker") {
      if (status !== "installed") {
        dbg("api/bin-requests/[id]", "PATCH worker forbidden non-installed", { id: params.id, status });
        return json({ error: "Workers may only mark bin requests as installed" }, 403, origin);
      }
      const current = (existing.status ?? "").toLowerCase();
      const canWorkerInstall = current === "approved" || current === "in_progress";
      if (!canWorkerInstall) {
        dbg("api/bin-requests/[id]", "PATCH worker bad prior status", { id: params.id, current });
        return json(
          {
            error:
              "Workers can mark installed only after admin approval (approved or in progress)",
          },
          400,
          origin,
        );
      }
    }

    const { data, error } = await supabase
      .from("bin_requests")
      .update({ status })
      .eq("id", params.id)
      .select()
      .maybeSingle();

    if (error) {
      dbgErr("api/bin-requests/[id]", "PATCH Supabase update error", error);
      return json({ error: "Failed to update bin request" }, 500, origin);
    }

    if (!data) {
      dbg("api/bin-requests/[id]", "PATCH update returned no row", { id: params.id });
      return json({ error: "Not found" }, 404, origin);
    }

    dbg("api/bin-requests/[id]", "PATCH 200 ok", { id: params.id, newStatus: status });
    return json(data, 200, origin);
  } catch (err) {
    dbgErr("api/bin-requests/[id]", "PATCH unexpected", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}

// DELETE /api/bin-requests/:id
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    dbg("api/bin-requests/[id]", "DELETE start", { id: params.id, origin });
    const { user, error: authError } = await getUserFromRequest(req);
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isAdminOrWorker =
      (user?.user_metadata?.role ?? "") === "admin" ||
      (user?.user_metadata?.role ?? "") === "worker" ||
      (!user && hasServiceRole);

    if (!user && !hasServiceRole) {
      dbg("api/bin-requests/[id]", "DELETE 401", { id: params.id });
      return json({ error: authError ?? "Unauthorized" }, 401, origin);
    }
    if (!isAdminOrWorker) {
      dbg("api/bin-requests/[id]", "DELETE 403", { id: params.id });
      return json({ error: "Forbidden" }, 403, origin);
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("bin_requests").delete().eq("id", params.id);

    if (error) {
      dbgErr("api/bin-requests/[id]", "DELETE Supabase error", error);
      if (error.code === "42501" || error.message?.includes("permission denied") || error.message?.includes("RLS")) {
        dbgErr("api/bin-requests/[id]", "DELETE RLS / permission — check SERVICE_ROLE_KEY", error);
        return json(
          {
            error:
              "Permission denied. Check RLS policies or SERVICE_ROLE_KEY configuration.",
          },
          403,
          origin,
        );
      }
      if (error.code === "PGRST116") {
        return json({ error: "Not found" }, 404, origin);
      }
      return json({ error: "Failed to delete bin request" }, 500, origin);
    }

    dbg("api/bin-requests/[id]", "DELETE 200 ok", { id: params.id });
    return json({ success: true }, 200, origin);
  } catch (err) {
    dbgErr("api/bin-requests/[id]", "DELETE unexpected", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}
