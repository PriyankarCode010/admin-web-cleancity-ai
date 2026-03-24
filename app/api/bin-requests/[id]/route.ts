import { NextResponse } from "next/server";
import { withCors } from "../../../../lib/cors";
import { getSupabaseServiceClient, getUserFromRequest } from "../../../../lib/supabaseServer";

const CORS_METHODS = "GET, PATCH, DELETE, OPTIONS";

function json(body: unknown, status: number, origin: string | null) {
  return withCors(NextResponse.json(body, { status }), origin, CORS_METHODS);
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return withCors(new NextResponse(null, { status: 204 }), origin, CORS_METHODS);
}

// GET /api/bin-requests/:id
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("bin_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("[bin-requests/:id:GET] Supabase error", error);
      return json({ error: "Failed to fetch bin request" }, 500, origin);
    }

    if (!data) {
      return json({ error: "Not found" }, 404, origin);
    }

    return json(data, 200, origin);
  } catch (err) {
    console.error("[bin-requests/:id:GET] Unexpected error", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}

// PATCH /api/bin-requests/:id
// Body: { status?: string }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isAdminOrWorker =
      (user?.user_metadata?.role ?? "") === "admin" ||
      (user?.user_metadata?.role ?? "") === "worker" ||
      (!user && hasServiceRole);

    if (!user && !hasServiceRole) {
      return json({ error: authError ?? "Unauthorized" }, 401, origin);
    }

    if (!isAdminOrWorker) {
      return json({ error: "Forbidden" }, 403, origin);
    }

    const body = (await req.json()) as { status?: string | null };
    const status = body?.status?.toLowerCase().trim();

    const validStatuses = ["requested", "approved", "in_progress", "installed"];

    if (!status || !validStatuses.includes(status)) {
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
      console.error("[bin-requests/:id:PATCH] Supabase fetch error", fetchError);
      return json({ error: "Failed to update bin request" }, 500, origin);
    }

    if (!existing) {
      return json({ error: "Not found" }, 404, origin);
    }

    const role = (user?.user_metadata?.role ?? "").toString();
    if (role === "worker") {
      if (status !== "installed") {
        return json({ error: "Workers may only mark bin requests as installed" }, 403, origin);
      }
      const current = (existing.status ?? "").toLowerCase();
      const canWorkerInstall = current === "approved" || current === "in_progress";
      if (!canWorkerInstall) {
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
      console.error("[bin-requests/:id:PATCH] Supabase error", error);
      return json({ error: "Failed to update bin request" }, 500, origin);
    }

    if (!data) {
      return json({ error: "Not found" }, 404, origin);
    }

    return json(data, 200, origin);
  } catch (err) {
    console.error("[bin-requests/:id:PATCH] Unexpected error", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}

// DELETE /api/bin-requests/:id
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const origin = req.headers.get("origin");
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isAdminOrWorker =
      (user?.user_metadata?.role ?? "") === "admin" ||
      (user?.user_metadata?.role ?? "") === "worker" ||
      (!user && hasServiceRole);

    if (!user && !hasServiceRole) {
      return json({ error: authError ?? "Unauthorized" }, 401, origin);
    }
    if (!isAdminOrWorker) {
      return json({ error: "Forbidden" }, 403, origin);
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("bin_requests").delete().eq("id", params.id);

    if (error) {
      console.error("[bin-requests/:id:DELETE] Supabase error deleting bin request", error);
      if (error.code === "42501" || error.message?.includes("permission denied") || error.message?.includes("RLS")) {
        console.error(
          "[bin-requests/:id:DELETE] RLS error - SERVICE_ROLE_KEY may not be configured correctly",
        );
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

    return json({ success: true }, 200, origin);
  } catch (err) {
    console.error("[bin-requests/:id:DELETE] Unexpected error", err);
    return json({ error: "Internal server error" }, 500, origin);
  }
}
