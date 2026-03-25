import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { dbg, dbgErr } from "@/lib/debugLog";
import { getServerFetchBaseUrl } from "@/lib/serverFetchBase";

type RouteDetails = {
  id: string;
  name: string;
  zone: number | null;
  stop_names?: string[];
  google_maps_url: string;
  status: string;
};

export default async function RouteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const base = getServerFetchBaseUrl();
  const detailUrl = `${base}/api/routes/${params.id}`;
  dbg("RouteDetailPage", "fetch detail", { base, id: params.id, detailUrl });

  const res = await fetch(detailUrl, { cache: "no-store" });

  dbg("RouteDetailPage", "fetch detail result", { id: params.id, ok: res.ok, status: res.status });

  if (!res.ok) {
    dbgErr("RouteDetailPage", "route not found or error", { id: params.id, status: res.status });
    return (
      <AppShell>
        <div className="rounded-xl border bg-white p-6">
          <p>Route not found</p>
          <Link href="/routes">Back</Link>
        </div>
      </AppShell>
    );
  }

  const route: RouteDetails = await res.json();

  /* Convert Google Maps URL → Embed URL */
  const focusLocation =
  route.stop_names && route.stop_names.length > 0
    ? route.stop_names[0]
    : "India";

  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    focusLocation
  )}&z=14&output=embed`;


  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAP SECTION */}
        <div className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{route.name}</h2>
              <p className="text-sm text-slate-600">
                Zone {route.zone ?? "N/A"} • {(route.stop_names ?? []).length} checkpoints
              </p>
            </div>

            <a
              href={route.google_maps_url}
              target="_blank"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Open in Maps
            </a>

          </div>

          {/* ALWAYS SHOW MAP */}
          <div className="h-[360px] rounded-lg overflow-hidden border">
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              className="border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />


          </div>
        </div>

        {/* STOPS / CHECKPOINTS */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Checkpoints</h3>

          {(route.stop_names ?? []).length === 0 ? (
            <p className="text-slate-500 text-sm text-center">
              No checkpoints defined
            </p>
          ) : (
            <div className="space-y-3">
              {(route.stop_names ?? []).map((name, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 border rounded-lg p-3"
                >
                  <div className="h-6 w-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">
                      Visit checkpoint {index + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
