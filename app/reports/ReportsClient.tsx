"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export type ReportItem = {
  id: string;
  image_url: string | null;
  description: string | null;
  severity: string | null;
  status: string | null;
  created_at: string | null;
  location?: string | null;
  attention?: boolean;
};

const EMPTY_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160" viewBox="0 0 400 160"><rect fill="#f1f5f9" width="400" height="160"/><text x="200" y="85" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="14">No image</text></svg>`
  );

export function ReportsClient({
  reports = [],
  loadError = null,
}: {
  reports?: ReportItem[];
  loadError?: string | null;
}) {
  const router = useRouter();

  const [rows, setRows] = useState<ReportItem[]>(reports);
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [severityDraft, setSeverityDraft] = useState("low");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);

  const processedIds = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showFeedbackToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedbackToast(message);
    toastTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }

  function dismissFeedbackToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setFeedbackToast(null);
  }

  useEffect(() => {
    setRows(reports ?? []);
    processedIds.current.clear();
  }, [reports]);

  useEffect(() => {
    if (!selected) return;
    const v = (selected.severity || "").toLowerCase();
    setSeverityDraft(["low", "medium", "high"].includes(v) ? v : "low");
  }, [selected]);

  useEffect(() => {
    if (!deleteTarget || deletingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, deletingId]);

  /* ================= DELETE ================= */
  const performDelete = async (id: string) => {
    if (processedIds.current.has(id) || deletingId === id) return;

    processedIds.current.add(id);
    setDeletingId(id);
    setError(null);

    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);

    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
      });

      if (res.status !== 200 && res.status !== 404) {
        throw new Error("Delete failed");
      }

      setDeleteTarget(null);
      showFeedbackToast("Report deleted.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Failed to delete report");
      router.refresh();
    } finally {
      processedIds.current.delete(id);
      setDeletingId(null);
    }
  };

  /* ================= SEVERITY ================= */
  const handleSaveSeverity = async () => {
    if (!selected || saving || processedIds.current.has(selected.id)) return;

    const reportId = selected.id;
    processedIds.current.add(reportId);
    setSaving(true);
    setError(null);

    const uiSeverity =
      severityDraft.charAt(0).toUpperCase() + severityDraft.slice(1);
    const savedLabel = uiSeverity;

    setRows((prev) =>
      prev.map((r) =>
        r.id === selected.id ? { ...r, severity: uiSeverity } : r
      )
    );

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ severity: severityDraft }),
      });

      if (!res.ok) throw new Error("Update failed");

      processedIds.current.delete(reportId);
      setSelected(null);
      showFeedbackToast(`Severity updated to ${savedLabel}.`);
      router.refresh();
    } catch (err) {
      console.error(err);
      processedIds.current.delete(reportId);
      setError("Failed to update severity");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  /* ================= RESOLVE ================= */
  const handleResolve = async () => {
    if (!selected || resolving || processedIds.current.has(selected.id)) return;

    processedIds.current.add(selected.id);
    setResolving(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${selected.id}/resolve`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Resolve failed");
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, status: "resolved" } : r
        )
      );

      setSelected(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Failed to resolve report");
    } finally {
      setResolving(false);
    }
  };

  const visibleRows = rows.filter((r) => (showAttentionOnly ? r.attention : true));

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Open submissions — excludes assigned routes and cleaned locations
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAttentionOnly}
              onChange={(e) => setShowAttentionOnly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Attention only
          </label>
        </div>

        {loadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p className="font-semibold">Couldn&apos;t load reports</p>
            <p className="mt-1 text-rose-700">{loadError}</p>
          </div>
        )}

        {!loadError && visibleRows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-16 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
              aria-hidden
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">No open reports</p>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              You&apos;re all caught up. New citizen reports will show up here when they arrive.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRows.map((r) => (
            <div key={r.id} className="border rounded-lg p-3">
                <img
                  src={r.image_url && r.image_url.length > 0 ? r.image_url : EMPTY_IMG}
                  alt=""
                  className="h-40 w-full object-cover rounded bg-slate-100"
                />

                <p className="font-semibold mt-2">{r.location}</p>

                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    {r.created_at?.slice(0, 10)} • {r.status}
                  </p>

                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100">
                    {r.severity || "Low"}
                  </span>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setSelected(r)}
                    className="flex-1 border rounded px-2 py-1 text-xs"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(r)}
                    disabled={deletingId === r.id}
                    className="bg-red-100 text-red-700 rounded px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-report-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
                aria-hidden
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <h3 id="delete-report-dialog-title" className="text-lg font-semibold text-slate-900">
                  Delete this report?
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This removes the report
                  {deleteTarget.location ? (
                    <>
                      {" "}
                      <span className="font-medium text-slate-800">{deleteTarget.location}</span>
                    </>
                  ) : null}{" "}
                  and its stored image. You can&apos;t undo this action.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!!deletingId}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === deleteTarget.id}
                onClick={() => void performDelete(deleteTarget.id)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? "Deleting…" : "Delete report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <p className="font-medium">{feedbackToast}</p>
          <button
            type="button"
            onClick={dismissFeedbackToast}
            className="shrink-0 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-lg space-y-3">
            <h3 className="font-bold">{selected.location}</h3>

            <select
              className="w-full border rounded"
              value={severityDraft}
              onChange={(e) => setSeverityDraft(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleSaveSeverity}
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded"
              >
                {saving ? "Saving…" : "Save severity"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="border px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
