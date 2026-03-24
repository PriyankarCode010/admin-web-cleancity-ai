import { AppShell } from "../../components/AppShell";
import { OverviewCard } from "../../components/OverviewCard";
import { getSupabaseServiceClient } from "../../lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportRow = {
  id: string;
  status: string | null;
  severity: string | null;
  created_at: string | null;
};

export default async function DashboardPage() {
  const supabase = getSupabaseServiceClient();

  // ---------- METRICS ----------
  const [
    { count: totalReports },
    { count: cleaned },
    { count: pending },
    { count: workerCount },
    { count: totalBinRequests },
    { count: pendingBinRequests },
  ] = await Promise.all([
    supabase.from("reports").select("*", { head: true, count: "exact" }),
    supabase.from("reports").select("id", { head: true, count: "exact" }).eq("status", "cleaned"),
    supabase.from("reports").select("id", { head: true, count: "exact" }).eq("status", "pending"),
    supabase.from("workers").select("id", { head: true, count: "exact" }),
    supabase.from("bin_requests").select("id", { head: true, count: "exact" }),
    supabase.from("bin_requests").select("id", { head: true, count: "exact" }).eq("status", "requested"),
  ]);

  // ---------- RECENT REPORTS (LAST 30 DAYS) ----------
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: recentReports, error } = await supabase
    .from("reports")
    .select("id, created_at, severity, status")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true});

  if (error) {
    console.error("[DashboardPage] recentReports error", error);
  }

  const reports: ReportRow[] = Array.isArray(recentReports)
    ? (recentReports as ReportRow[])
    : [];

  // ---------- LINE CHART (LAST 7 DAYS) ----------
  const dayCounts: { label: string; count: number }[] = [];
const today = new Date();

for (let i = 6; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(today.getDate() - i);

  const count = reports.filter(
    (r) =>
      r.created_at &&
      new Date(r.created_at).toDateString() === d.toDateString()
  ).length;

  dayCounts.push({
    label: d.toLocaleDateString("en-US", { weekday: "short" }),
    count,
  });
}

const maxLine = Math.max(...dayCounts.map((d) => d.count), 1);

const linePoints = dayCounts
  .map(
    (d, i) =>
      `${(i / (dayCounts.length - 1 || 1)) * 100},${
        90 - (d.count / maxLine) * 80
      }`
  )
  .join(" ");

  // ---------- SEVERITY MIX ----------
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

const maxBar = Math.max(...bars.map((b) => b.score), 1);

  console.log("[DashboardPage] severity bars", bars);

  // ---------- BIN REQUESTS ----------
  const { data: recentBinRequests, error: binRequestsError } = await supabase
    .from("bin_requests")
    .select("id, address, latitude, longitude, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (binRequestsError) {
    console.error("[DashboardPage] binRequests error", binRequestsError);
  }

  // ---------- METRIC CARDS ----------
  const metrics = [
    { label: "Total Reports", value: totalReports ?? 0 },
    { label: "Cleaned Locations", value: cleaned ?? 0 },
    { label: "Pending Locations", value: pending ?? 0 },
    { label: "Worker Count", value: workerCount ?? 0 },
    { label: "Bin Requests", value: totalBinRequests ?? 0 },
    { label: "Pending Bin Requests", value: pendingBinRequests ?? 0 },
  ];

  return (
    <AppShell>
      {/* ===== METRICS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <OverviewCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      {/* ===== CHARTS ===== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---- REPORTS OVER TIME ---- */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Reports Over Time
            </h2>
            <span className="text-xs text-slate-500">Last 7 days</span>
          </div>

          <div className="h-64">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <polyline
                fill="none"
                stroke="#4F46E5"
                strokeWidth="2"
                points={linePoints}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* ---- SEVERITY MIX ---- */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Severity Mix
            </h2>
            <span className="text-xs text-slate-500">
              Higher = more reports
            </span>
          </div>

          <div className="h-64 flex items-end gap-4">
            {bars.map((b) => {
              const color =
                b.zone === "high"
                  ? "bg-red-600"
                  : b.zone === "medium"
                  ? "bg-yellow-500"
                  : "bg-indigo-600";

              return (
                <div
                  key={b.zone}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="w-full h-40 rounded-lg bg-slate-100 flex items-end">
                    <div
                      className={`w-full rounded-lg ${color} transition-all`}
                      style={{
                        height: `${Math.max((b.score / maxBar) * 100,12)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 text-center">
                    {b.zone}
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {b.score}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== RECENT BIN REQUESTS ===== */}
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
  ? `${br.latitude.toFixed(4)}, ${br.longitude.toFixed(4)}`
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
