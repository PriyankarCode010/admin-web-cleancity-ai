import { ReportsClient, type ReportItem } from "./ReportsClient";
import { dbg, dbgErr } from "@/lib/debugLog";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReportsPage() {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, image_url, description, severity, status, created_at, latitude, longitude, address, attention"
    )
    .neq("status", "assigned")
    .neq("status", "cleaned")
    .order("created_at", { ascending: false });

  if (error) {
    dbgErr("ReportsPage", "Failed to fetch reports", error);
  } else {
    dbg("ReportsPage", "fetched reports", { count: data?.length ?? 0 });
  }

  const reports: ReportItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    image_url: (r.image_url as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    severity:
      typeof r.severity === "string"
        ? r.severity.charAt(0).toUpperCase() +
          r.severity.slice(1).toLowerCase()
        : "Low",
    status: (r.status as string | null) ?? "new",
    created_at: (r.created_at as string | null) ?? null,
    location: (() => {
      const addr =
        typeof r.address === "string" ? r.address.trim() : "";
      if (addr) return addr;
      if (r.latitude != null && r.longitude != null) {
        return `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`;
      }
      return "Unknown location";
    })(),
    attention: !!r.attention,
  }));

  return (
    <ReportsClient reports={reports} loadError={error?.message ?? null} />
  );
}

