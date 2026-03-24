"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";

export type BinRequestItem = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string | null;
  user_id: string | null;
};

export function BinRequestsClient({ binRequests = [] as BinRequestItem[] }: { binRequests?: BinRequestItem[] }) {
  const router = useRouter();
  const safeRequests = binRequests || [];
  const [rows, setRows] = useState<BinRequestItem[]>(safeRequests);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Sync local state with props when binRequests change (after router.refresh())
  useEffect(() => {
    setRows(safeRequests);
    // Clear processed IDs when fresh data arrives (new data means server has updated)
    setProcessedIds(new Set());
  }, [binRequests]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    // Prevent duplicate actions
    if (processedIds.has(id) || updatingId === id) {
      return;
    }

    setUpdatingId(id);
    setError(null);

    // Mark as processed immediately to prevent duplicate calls
    setProcessedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Optimistically update UI
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );

    try {
      const res = await fetch(`/api/bin-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        // If 404, item was deleted - remove from state
        if (res.status === 404) {
          setRows((prev) => prev.filter((r) => r.id !== id));
          router.refresh();
          return;
        }

        // Revert optimistic update on error
        setRows((prev) =>
          prev.map((r) => {
            const original = safeRequests.find((br) => br.id === r.id);
            return original ? { ...original } : r;
          })
        );
        setProcessedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setError(data.error || "Failed to update bin request");
        return;
      }

      // Refresh server data
      router.refresh();
    } catch (err) {
      console.error("[BinRequestsClient] Failed to update status", err);
      // Revert optimistic update on error
      setRows((prev) =>
        prev.map((r) => {
          const original = safeRequests.find((br) => br.id === r.id);
          return original ? { ...original } : r;
        })
      );
      setError("Unexpected error while updating status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    // Prevent duplicate actions - check before confirm dialog
    if (processedIds.has(id) || updatingId === id) {
      return;
    }

    if (!confirm("Are you sure you want to deny and delete this bin request? This action cannot be undone.")) {
      return;
    }

    // Double-check after confirm (user might have clicked multiple times)
    if (processedIds.has(id) || updatingId === id) {
      return;
    }

    setUpdatingId(id);
    setError(null);

    // Mark as processed immediately to prevent duplicate calls
    setProcessedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Optimistically remove from UI
    setRows((prev) => prev.filter((r) => r.id !== id));

    try {
      const res = await fetch(`/api/bin-requests/${id}`, {
        method: "DELETE",
      });

      // Treat 404 as success (item already deleted)
      if (res.status === 404) {
        // Item was already deleted - UI already updated, just refresh to sync
        router.refresh();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        // Revert optimistic update on error (except 404 which we treat as success)
        const original = safeRequests.find((br) => br.id === id);
        if (original) {
          setRows((prev) => [...prev, original].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          }));
        }
        setProcessedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setError(data.error || "Failed to delete bin request");
        return;
      }

      // Success - refresh server data
      router.refresh();
    } catch (err) {
      console.error("[BinRequestsClient] Failed to delete bin request", err);
      // Revert optimistic update on error
      const original = safeRequests.find((br) => br.id === id);
      if (original) {
        setRows((prev) => [...prev, original].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }));
      }
      setProcessedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError("Unexpected error while deleting bin request");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "requested":
        return "bg-amber-50 text-amber-700";
      case "approved":
      case "in_progress":
        return "bg-blue-50 text-blue-700";
      case "denied":
      case "rejected":
        return "bg-rose-50 text-rose-700";
      case "installed":
      case "completed":
      case "resolved":
        return "bg-emerald-50 text-emerald-700";
      default:
        return "bg-slate-50 text-slate-700";
    }
  };

  const filteredRows = rows.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status?.toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bin Requests</h2>
            <span className="text-sm text-slate-600">{filteredRows.length} records</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-700 font-semibold">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="installed">Installed</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Address</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((request) => (
                    <tr key={request.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                        {request.address}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {request.latitude !== null && request.longitude !== null
                          ? `${request.latitude.toFixed(4)}, ${request.longitude.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {request.created_at
                          ? new Date(request.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {request.status === "requested" && !processedIds.has(request.id) && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(request.id, "approved")}
                                disabled={updatingId === request.id || processedIds.has(request.id)}
                                className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {updatingId === request.id ? "Updating…" : "Approve"}
                              </button>
                              <button
                                onClick={() => handleDelete(request.id)}
                                disabled={updatingId === request.id || processedIds.has(request.id)}
                                className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {updatingId === request.id ? "Deleting…" : "Deny"}
                              </button>
                            </>
                          )}
                          {request.status === "approved" && !processedIds.has(request.id) && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(request.id, "in_progress")}
                                disabled={updatingId === request.id || processedIds.has(request.id)}
                                className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {updatingId === request.id ? "Updating…" : "Start"}
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(request.id, "installed")}
                                disabled={updatingId === request.id || processedIds.has(request.id)}
                                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {updatingId === request.id ? "Updating…" : "Mark installed"}
                              </button>
                            </>
                          )}
                          {request.status === "in_progress" && !processedIds.has(request.id) && (
                            <button
                              onClick={() => handleStatusUpdate(request.id, "installed")}
                              disabled={updatingId === request.id || processedIds.has(request.id)}
                              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {updatingId === request.id ? "Updating…" : "Mark installed"}
                            </button>
                          )}
                          {processedIds.has(request.id) && (
                            <span className="text-xs text-slate-500 italic">Processing...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      No bin requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

