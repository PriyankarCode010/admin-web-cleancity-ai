import { NextResponse } from "next/server";
import { dbg, dbgErr } from "../../../../lib/debugLog";
import { getSupabaseServiceClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

// Properly type params
type RouteParams = {
  params: {
    id: string;
  };
};

// GET /api/routes/[id]
export async function GET(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = params;

    const supabase = getSupabaseServiceClient();

    const { data: route, error } = await supabase
      .from("routes")
      .select(`
        id,
        name,
        area_id,
        report_ids,
        stop_names,
        google_maps_url,
        status,
        date,
        worker_id,
        workers ( id, name )
      `)
      .eq("id", id)
      .maybeSingle(); // safer than single()

    if (error) {
      dbgErr("api/routes/[id]", "GET Supabase error", error);

      return NextResponse.json(
        { error: "Failed to fetch route" },
        { status: 500 }
      );
    }

    if (!route) {
      dbg("api/routes/[id]", "GET 404", { id });
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    dbg("api/routes/[id]", "GET 200", { id, name: route.name });

    return NextResponse.json(
      {
        id: route.id,
        name: route.name ?? `Route-${route.id.slice(0, 6)}`,
        zone: route.area_id,
        report_ids: route.report_ids ?? [],
        stop_names: route.stop_names ?? [],
        google_maps_url: route.google_maps_url,
        status: route.status ?? "pending",
        worker: route.workers?.[0]?.name ?? "Unassigned",
        worker_id: route.worker_id ?? null,
        date: route.date,
      },
      { status: 200 }
    );
  } catch (err) {
    dbgErr("api/routes/[id]", "GET unexpected", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
