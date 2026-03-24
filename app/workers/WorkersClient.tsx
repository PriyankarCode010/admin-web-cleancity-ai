"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkerCard } from "../../components/WorkerCard";

export type WorkerRow = {
  id: string;
  active: boolean | null;
  zone?: string | null;
  profiles?: { full_name: string | null } | null;
  totalCleanups: number;
};

type RouteOption = {
  id: string;
  name: string;
  worker: string;
  worker_id: string | null;
  status: string;
};

export function WorkersClient({ workers = [] as WorkerRow[] }: { workers?: WorkerRow[] }) {
  const router = useRouter();
  const safeWorkers = workers || [];
  const [selected, setSelected] = useState<WorkerRow | null>(null);
  const [routeId, setRouteId] = useState("");
  const [notes, setNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableRoutes, setAvailableRoutes] = useState<RouteOption[]>([]);

  useEffect(() => {
    if (selected) {
      fetch("/api/routes?for_assignment=1")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableRoutes(
              data.map((r: any) => ({
                id: r.id,
                name: r.name || r.id,
                worker: typeof r.worker === "string" ? r.worker : "Unassigned",
                worker_id: r.worker_id ?? null,
                status: r.status ?? "pending",
              })),
            );
          } else {
            setAvailableRoutes([]);
          }
        })
        .catch(() => setAvailableRoutes([]));
    }
  }, [selected]);

  const selectedRoute = availableRoutes.find((r) => r.id === routeId);
  const isReassign =
    selectedRoute &&
    selectedRoute.worker_id &&
    selectedRoute.worker !== "Unassigned";

  const handleAssign = async () => {
    if (!selected || !routeId.trim()) {
      setError("Please select a route");
      return;
    }

    setAssigning(true);
    setError(null);

    try {
      const res = await fetch(`/api/workers/${selected.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route_id: routeId, notes: notes.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to assign route");
        return;
      }

      setSelected(null);
      setRouteId("");
      setNotes("");
      router.refresh();
    } catch (err) {
      console.error("[WorkersClient] Failed to assign route", err);
      setError("Unexpected error while assigning route");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safeWorkers.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={{
              id: worker.id,
              name: worker.profiles?.full_name || "Worker",
              zone: worker.zone || "Unknown",
              totalCleanups: worker.totalCleanups ?? 0,
              status: worker.active ? "Online" : "Offline",
            }}
            onAssign={() => setSelected(worker)}
          />
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Assign route</h3>
            <p className="text-sm text-slate-600 mt-1">
              Choose any open or in-progress route. If it already belongs to someone
              else, assigning here will move it to{" "}
              <span className="font-semibold">{selected.profiles?.full_name || "this worker"}</span>.
            </p>
            <div className="mt-4 space-y-3">
              <label className="text-sm font-semibold text-slate-700">Route</label>
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select a route</option>
                {availableRoutes.map((route) => {
                  const assigned =
                    route.worker_id && route.worker !== "Unassigned";
                  const suffix = assigned
                    ? ` — ${route.worker} (${route.status})`
                    : ` — unassigned (${route.status})`;
                  return (
                    <option key={route.id} value={route.id}>
                      {route.name}
                      {suffix}
                    </option>
                  );
                })}
              </select>
              {isReassign && (
                <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                  This route is currently assigned to{" "}
                  <span className="font-semibold">{selectedRoute?.worker}</span>. You
                  are about to reassign it.
                </p>
              )}
              <label className="text-sm font-semibold text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                rows={3}
                placeholder="Add dispatch instructions"
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelected(null);
                  setRouteId("");
                  setNotes("");
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !routeId.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-70"
              >
                {assigning
                  ? isReassign
                    ? "Reassigning…"
                    : "Assigning…"
                  : isReassign
                    ? "Reassign route"
                    : "Assign route"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
