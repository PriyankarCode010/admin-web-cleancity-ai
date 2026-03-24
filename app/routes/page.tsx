import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { BrowserDebugLog } from "../../components/BrowserDebugLog";
import { revalidatePath } from "next/cache";
import { dbg, dbgErr } from "../../lib/debugLog";
import { getServerFetchBaseUrl } from "../../lib/serverFetchBase";

type RouteData = {
  id: string;
  date?: string;
  area_id?: number | null;
  report_ids?: string[];
  google_maps_url?: string | null;
  total_severity?: number;
  status?: string | null;
};

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  /* ================= FETCH ROUTES FROM NEXT API ================= */
  const base = getServerFetchBaseUrl();
  const routesUrl = `${base}/api/routes`;
  dbg("RoutesPage", "fetch list", { base, routesUrl });

  const res = await fetch(routesUrl, { cache: "no-store" });

  let routesData: RouteData[] = [];
  let errorMessage: string | null = null;

  dbg("RoutesPage", "fetch list result", { ok: res.ok, status: res.status });

  if (res.ok) {
    routesData = await res.json();
    dbg("RoutesPage", "routes loaded", { count: Array.isArray(routesData) ? routesData.length : 0 });
  } else {
    const errorData = await res.json().catch(() => ({}));
    errorMessage = errorData.error || "Failed to load routes";
    dbgErr("RoutesPage", "fetch list failed", { status: res.status, errorData });
  }

  /* ================= UI ================= */
  return (
    <AppShell>
      <BrowserDebugLog
        tag="RoutesPage"
        payload={{
          fetchBase: base,
          routesUrl,
          httpStatus: res.status,
          ok: res.ok,
          routeCount: Array.isArray(routesData) ? routesData.length : 0,
          errorMessage,
        }}
      />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Routes
            </h2>
            {!errorMessage && (
              <span className="text-sm text-slate-600">
                {routesData.length} total
              </span>
            )}
          </div>

          {/* ================= CREATE ROUTES BUTTON ================= */}
          <form
            action={async () => {
              "use server";

              const routingBase = process.env.NEXT_PUBLIC_ROUTING_SERVICE_URL?.replace(/\/+$/, "") ?? "";
              const createUrl = routingBase ? `${routingBase}/routes/create` : "";
              dbg("RoutesPage", "server action: create routes", { routingBase, createUrl });

              if (!createUrl) {
                dbgErr("RoutesPage", "NEXT_PUBLIC_ROUTING_SERVICE_URL missing; skip create fetch", {});
              } else {
                try {
                  const createRes = await fetch(createUrl, { method: "POST" });
                  dbg("RoutesPage", "create routes response", {
                    ok: createRes.ok,
                    status: createRes.status,
                  });
                } catch (e) {
                  dbgErr("RoutesPage", "create routes fetch threw", e);
                }
              }

              // 🔥 refresh this page after generation
              revalidatePath("/routes");
            }}
          >
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Routes
            </button>
          </form>
        </div>

        {/* ================= CONTENT ================= */}
        {errorMessage ? (
          <div className="px-5 py-8 text-center">
            <p className="text-red-600">{errorMessage}</p>
          </div>
        ) : routesData.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500">
            No routes found
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Route ID</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Stops</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {routesData.map((route) => (
                <tr
                  key={route.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    {route.id}
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    {route.area_id ?? "—"}
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    {route.report_ids?.length ?? 0}
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    {route.total_severity ?? 0}
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    {route.status ?? "pending"}
                  </td>

                  <td className="px-5 py-3 text-right space-x-2">
                    {route.google_maps_url && (
                      <a
                        href={route.google_maps_url}
                        target="_blank"
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Open Map
                      </a>
                    )}

                    <Link
                      href={`/routes/${route.id}`}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
