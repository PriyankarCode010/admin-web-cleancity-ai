import { AppShell } from "@/components/AppShell";
import { BrowserDebugLog } from "@/components/BrowserDebugLog";
import { DashboardCharts } from "@/components/DashboardCharts";
import { OverviewCard } from "@/components/OverviewCard";
import { dbg, dbgErr } from "@/lib/debugLog";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportRow = {
  id: string;
  status: string | null;
  severity: string | null;
  created_at: string | null;
};

async function safeCount(
  promise: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await promise;
  if (error) {
    dbgErr("DashboardPage", "count query error", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Normalize to UTC calendar day YYYY-MM-DD */
function reportDayKey(r: ReportRow): string | null {
  const raw = r.created_at ?? null;
  if (!raw) return null;
  const t = Date.parse(typeof raw === "string" ? raw : String(raw));
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Load reports for charts when the 30-day filtered query is empty but the table still has rows,
 * or when the primary query fails. Skipped when totalReports is 0 so an empty DB stays empty.
 */
async function fetchReportsChartFallback(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  since: Date,
  reason: "query_error" | "window_empty",
): Promise<ReportRow[]> {
  const { data: fallback, error: fbErr } = await supabase
    .from("reports")
    .select("id, created_at, severity, status")
    .order("created_at", { ascending: false })
    .limit(500);

  if (fbErr) {
    dbgErr("DashboardPage", "reports chart fallback error", fbErr);
    return [];
  }

  if (!Array.isArray(fallback) || fallback.length === 0) {
    return [];
  }

  const cutoff = since.getTime();
  const filtered = (fallback as ReportRow[]).filter((r) => {
    const raw = r.created_at;
    if (!raw) return false;
    const t = Date.parse(String(raw));
    return !Number.isNaN(t) && t >= cutoff;
  });

  const rows =
    filtered.length > 0 ? filtered : (fallback as ReportRow[]).slice(0, 200);
  dbg("DashboardPage", "reports chart fallback applied", {
    reason,
    filteredLen: filtered.length,
    finalReportsLen: rows.length,
  });
  return rows;
}

export default async function DashboardPage() {
  dbg("DashboardPage", "render start", { nodeEnv: process.env.NODE_ENV });
  const supabase = getSupabaseServiceClient();

  const [
    totalReports,
    cleaned,
    pending,
    workerCount,
    totalBinRequests,
    pendingBinRequests,
  ] = await Promise.all([
    safeCount(
      supabase.from("reports").select("*", { head: true, count: "exact" })
    ),
    safeCount(
      supabase
        .from("reports")
        .select("id", { head: true, count: "exact" })
        .eq("status", "cleaned")
    ),
    safeCount(
      supabase
        .from("reports")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending")
    ),
    safeCount(
      supabase.from("workers").select("id", { head: true, count: "exact" })
    ),
    safeCount(
      supabase.from("bin_requests").select("id", { head: true, count: "exact" })
    ),
    safeCount(
      supabase
        .from("bin_requests")
        .select("id", { head: true, count: "exact" })
        .eq("status", "requested")
    ),
  ]);

  dbg("DashboardPage", "metrics counts", {
    totalReports,
    cleaned,
    pending,
    workerCount,
    totalBinRequests,
    pendingBinRequests,
  });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const { data: recentReports, error: reportsError } = await supabase
    .from("reports")
    .select("id, created_at, severity, status")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (reportsError) {
    dbgErr("DashboardPage", "recentReports primary query error", reportsError);
  }

  let reports: ReportRow[] = Array.isArray(recentReports)
    ? (recentReports as ReportRow[])
    : [];

  // Empty DB → empty charts. If the table has rows but none in the 30-day window (or primary
  // query failed), pull a bounded fallback so severity mix / buckets aren’t all stuck at zero.
  if (reportsError) {
    reports = await fetchReportsChartFallback(supabase, since, "query_error");
  } else if (reports.length === 0 && totalReports > 0) {
    reports = await fetchReportsChartFallback(supabase, since, "window_empty");
  }

  dbg("DashboardPage", "reports for charts", { count: reports.length, since: since.toISOString() });

  const dayCounts: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = reports.filter((r) => reportDayKey(r) === key).length;
    dayCounts.push({
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      count,
    });
  }

  const severityCounts: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  reports.forEach((r) => {
    const key = (r.severity ?? "low").toLowerCase();
    if (severityCounts[key] !== undefined) {
      severityCounts[key]++;
    }
  });

  const bars = Object.entries(severityCounts).map(([zone, score]) => ({
    zone,
    score,
  }));

  dbg("DashboardPage", "chart series", { dayCounts, severityCounts });

  const { data: recentBinRequests, error: binRequestsError } = await supabase
    .from("bin_requests")
    .select("id, address, latitude, longitude, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (binRequestsError) {
    dbgErr("DashboardPage", "recentBinRequests error", binRequestsError);
  }

  dbg("DashboardPage", "recent bin requests row count", {
    n: Array.isArray(recentBinRequests) ? recentBinRequests.length : 0,
  });

  const metrics = [
    { label: "Total Reports", value: totalReports },
    { label: "Cleaned Locations", value: cleaned },
    { label: "Pending Locations", value: pending },
    { label: "Worker Count", value: workerCount },
    { label: "Bin Requests", value: totalBinRequests },
    { label: "Pending Bin Requests", value: pendingBinRequests },
  ];

  dbg("DashboardPage", "render complete");

  return (
    <AppShell>
      <BrowserDebugLog
        tag="DashboardPage"
        payload={{
          totalReports,
          cleaned,
          pending,
          workerCount,
          totalBinRequests,
          pendingBinRequests,
          reportsError: reportsError?.message ?? null,
          reportsCount: reports.length,
          sinceUtc: since.toISOString(),
          dayCounts,
          severityCounts,
          binRequestsError: binRequestsError?.message ?? null,
          recentBinRequestsShown: Array.isArray(recentBinRequests) ? recentBinRequests.length : 0,
        }}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <OverviewCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <DashboardCharts dayCounts={dayCounts} bars={bars} />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Recent Bin Requests</h2>
          <span className="text-sm text-slate-600">
            {Array.isArray(recentBinRequests) ? recentBinRequests.length : 0} shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(recentBinRequests) && recentBinRequests.length > 0 ? (
                recentBinRequests.map((br: any) => (
                  <tr key={br.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {br.address || "Unknown address"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {br.latitude !== null && br.longitude !== null
                        ? `${Number(br.latitude).toFixed(4)}, ${Number(br.longitude).toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          br.status === "requested"
                            ? "bg-amber-50 text-amber-700"
                            : br.status === "approved"
                              ? "bg-slate-100 text-slate-700"
                              : br.status === "in_progress"
                                ? "bg-blue-50 text-blue-700"
                                : br.status === "installed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        {br.status || "requested"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {br.created_at
                        ? new Date(br.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                    No bin requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
