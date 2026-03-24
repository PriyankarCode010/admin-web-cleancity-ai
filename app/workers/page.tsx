import { AppShell } from "../../components/AppShell";
import { WorkersClient, type WorkerRow } from "./WorkersClient";
import { getSupabaseServiceClient } from "../../lib/supabaseServer";

function isCleanedStatus(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  return s === "cleaned" || s === "resolved";
}

export default async function WorkersPage() {
  const supabase = getSupabaseServiceClient();

  const { data: workerRows, error } = await supabase
    .from("workers")
    .select("user_id, name, active, zone")
    .order("name", { ascending: true });

  if (error) {
    console.error("[WorkersPage] Failed to fetch workers", error);
  }

  const rows = Array.isArray(workerRows) ? workerRows : [];

  const workerIds = rows.map((w: any) => w.user_id as string).filter(Boolean);

  const cleanupByWorker = new Map<string, number>();
  for (const id of workerIds) {
    cleanupByWorker.set(id, 0);
  }

  if (workerIds.length > 0) {
    const { data: routeRows, error: routesError } = await supabase
      .from("routes")
      .select("worker_id, report_ids")
      .in("worker_id", workerIds);

    if (routesError) {
      console.error("[WorkersPage] Failed to fetch routes for cleanups", routesError);
    } else {
      const workerToReportIds = new Map<string, Set<string>>();
      for (const wid of workerIds) {
        workerToReportIds.set(wid, new Set());
      }

      for (const r of routeRows ?? []) {
        const wid = r.worker_id as string | null;
        if (!wid || !workerToReportIds.has(wid)) continue;
        const raw = r.report_ids;
        const ids = Array.isArray(raw) ? raw : [];
        const set = workerToReportIds.get(wid)!;
        for (const id of ids) {
          if (typeof id === "string" && id.length > 0) set.add(id);
        }
      }

      const allReportIds = new Set<string>();
      for (const s of workerToReportIds.values()) {
        for (const id of s) allReportIds.add(id);
      }

      const cleanedIds = new Set<string>();
      const idList = [...allReportIds];
      const chunk = 500;
      for (let i = 0; i < idList.length; i += chunk) {
        const slice = idList.slice(i, i + chunk);
        if (slice.length === 0) continue;
        const { data: reports, error: repErr } = await supabase
          .from("reports")
          .select("id, status")
          .in("id", slice);

        if (repErr) {
          console.error("[WorkersPage] Failed to fetch reports for cleanups", repErr);
          continue;
        }
        for (const rep of reports ?? []) {
          if (rep?.id && isCleanedStatus(rep.status as string)) {
            cleanedIds.add(rep.id as string);
          }
        }
      }

      for (const wid of workerIds) {
        const set = workerToReportIds.get(wid) ?? new Set();
        let n = 0;
        for (const rid of set) {
          if (cleanedIds.has(rid)) n += 1;
        }
        cleanupByWorker.set(wid, n);
      }
    }
  }

  const workers: WorkerRow[] = rows.map((w: any) => ({
    id: w.user_id,
    active: !!w.active,
    zone: w.zone ?? "Unknown",
    profiles: { full_name: w.name ?? "Worker" },
    totalCleanups: cleanupByWorker.get(w.user_id) ?? 0,
  }));

  return (
    <AppShell>
      <WorkersClient workers={workers} />
    </AppShell>
  );
}
