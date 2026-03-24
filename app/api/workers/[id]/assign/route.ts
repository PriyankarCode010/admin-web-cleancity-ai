import { NextResponse } from "next/server";
import { getSupabaseServiceClient, getUserFromRequest } from "../../../../../lib/supabaseServer";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// POST /api/workers/:id/assign
// :id = workers.user_id (UUID)
// Body: { route_id: string, notes?: string }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    /* ---------- AUTH ---------- */
    const { user, error: authError } = await getUserFromRequest(req);
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!user && !hasServiceKey) {
      return NextResponse.json(
        { error: authError ?? "Unauthorized" },
        { status: 401 }
      );
    }

    let requesterRole = "";
    if (user) {
      requesterRole = (user.user_metadata?.role ?? "").toString();
      if (requesterRole !== "admin" && requesterRole !== "worker") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    /* ---------- BODY ---------- */
    let body: { route_id?: string; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { route_id } = body;
    if (!route_id || typeof route_id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid route_id" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    /* ---------- FIND WORKER (by user_id UUID) ---------- */
    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id, user_id, zone")
      .eq("user_id", params.id) // ✅ IMPORTANT: params.id is UUID
      .single();

    if (workerError || !worker) {
      return NextResponse.json(
        { error: "Worker not found" },
        { status: 404 }
      );
    }

    /* ---------- FIND ROUTE ---------- */
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("id, area_id, status, worker_id")
      .eq("id", route_id)
      .single();

    if (routeError || !route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    const routeStatus = (route.status ?? "").toString().toLowerCase();
    if (routeStatus === "completed") {
      return NextResponse.json(
        { error: "Cannot assign a completed route" },
        { status: 409 }
      );
    }

    const currentWorkerId = route.worker_id ? String(route.worker_id) : null;

    if (user && requesterRole === "worker") {
      if (params.id !== user.id) {
        return NextResponse.json(
          { error: "Workers can only assign routes to themselves" },
          { status: 403 }
        );
      }
      if (currentWorkerId && currentWorkerId !== user.id) {
        return NextResponse.json(
          { error: "Route already assigned to another worker" },
          { status: 409 }
        );
      }
    }

    /* ---------- ASSIGN OR REASSIGN (admins / service: any non-completed route) ---------- */
    const { data: updatedRoute, error: updateError } = await supabase
      .from("routes")
      .update({
        worker_id: worker.user_id,
        status: "assigned",
      })
      .eq("id", route_id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[workers/:id/assign] Failed to update route",
        updateError
      );
      return NextResponse.json(
        { error: "Failed to assign route" },
        { status: 500 }
      );
    }

    /* ---------- SUCCESS ---------- */
    return NextResponse.json(
      {
        ok: true,
        route: updatedRoute,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[workers/:id/assign] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
