import { getSupabaseServiceClient } from "@/lib/supabaseServer";

type MlRouteRow = {
  id?: string;
  name?: string | null;
  area?: string | null;
  date?: string | null;
  report_ids?: string[] | null;
  google_maps_url?: string | null;
  total_severity?: number | null;
  status?: string | null;
  stop_names?: string[] | null;
  area_id?: number | null;
};

/**
 * Upserts routes returned by the Hugging Face routing service into this app's Supabase.
 * Ensures routes appear in the admin UI even when the HF Space uses different Supabase env vars.
 */
export async function persistRoutesFromMlPayload(
  data: unknown,
): Promise<{ inserted: number; error: string | null }> {
  const payload = data as { routes?: MlRouteRow[] };
  const routes = Array.isArray(payload.routes) ? payload.routes : [];
  if (routes.length === 0) {
    return { inserted: 0, error: null };
  }

  const supabase = getSupabaseServiceClient();
  let inserted = 0;

  for (const raw of routes) {
    const name =
      (typeof raw.name === "string" && raw.name.trim() ? raw.name : null) ??
      (typeof raw.area === "string" && raw.area.trim() ? raw.area : null) ??
      "Route";

    const reportIds = Array.isArray(raw.report_ids)
      ? raw.report_ids.filter((x): x is string => typeof x === "string")
      : [];

    const row: Record<string, unknown> = {
      name: name.slice(0, 200),
      date: typeof raw.date === "string" ? raw.date : null,
      area_id: typeof raw.area_id === "number" ? raw.area_id : null,
      report_ids: reportIds,
      google_maps_url: typeof raw.google_maps_url === "string" ? raw.google_maps_url : null,
      total_severity: typeof raw.total_severity === "number" ? raw.total_severity : null,
      status: typeof raw.status === "string" ? raw.status : "pending",
    };

    if (Array.isArray(raw.stop_names)) {
      row.stop_names = raw.stop_names.filter((x): x is string => typeof x === "string");
    }

    if (typeof raw.id === "string" && raw.id.length > 0) {
      row.id = raw.id;
    }

    const op =
      typeof row.id === "string"
        ? await supabase.from("routes").upsert(row, { onConflict: "id" })
        : await supabase.from("routes").insert(row);

    if (op.error) {
      return { inserted, error: op.error.message };
    }

    inserted += 1;

    for (const rid of reportIds) {
      await supabase.from("reports").update({ status: "assigned" }).eq("id", rid);
    }
  }

  return { inserted, error: null };
}
