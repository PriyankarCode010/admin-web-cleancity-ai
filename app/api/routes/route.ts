import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServiceClient();
    const url = new URL(req.url);
    const forAssignment =
      url.searchParams.get("for_assignment") === "1" ||
      url.searchParams.get("for_assignment") === "true";

    let query = supabase
      .from("routes")
      .select(`
        id,
        name,
        area_id,
        report_ids,
        worker_id,
        status,
        date,
        workers ( id, name )
      `)
      .order("created_at", { ascending: false });

    if (forAssignment) {
      query = query.neq("status", "completed");
    }

    const { data: routes, error } = await query;

    if (error) {
      console.error("[routes:GET] Supabase error", error);

      if (
        error.code === "PGRST205" ||
        error.message?.includes("Could not find the table")
      ) {
        return NextResponse.json(
          { error: "Routes table not created yet. Please create the routes table in Supabase." },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
    }

    const formattedRoutes = (routes ?? []).map((route) => ({
      id: route.id,
      name: route.name ?? `Route-${route.id.slice(0, 6)}`,
      zone: route.area_id ?? null,
      stops: route.report_ids?.length ?? 0,
      worker: route.workers?.[0]?.name ?? "Unassigned",
      worker_id: route.worker_id ?? null,
      status: route.status ?? "pending",
    }));

    return NextResponse.json(formattedRoutes, { status: 200 });
  } catch (err) {
    console.error("[routes:GET] Unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}