"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CompleteRouteButton({
  routeId,
  status,
  workerId,
}: {
  routeId: string;
  status?: string | null;
  workerId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const normalized = (status ?? "").toLowerCase();
  const isAssigned = !!workerId || normalized === "assigned";
  const disabled = normalized === "completed" || !isAssigned;

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || isPending}
          onClick={() => {
            if (disabled) return;
            setError(null);
            setConfirmOpen(true);
          }}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Completing…" : "Complete"}
        </button>
        {error ? <p className="text-xs text-rose-600 max-w-xs">{error}</p> : null}
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            // Close when clicking on the overlay, not on the modal card.
            if (e.currentTarget === e.target) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-bold text-slate-900">
              Complete this route?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will mark the route as <span className="font-semibold">completed</span> and update the
              related reports. The route will be cleared for workers.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isPending}
                onClick={() => {
                  setConfirmOpen(false);
                  startTransition(async () => {
                    try {
                      const res = await fetch("/api/routes/complete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ routeId }),
                      });

                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        setError(data.error || "Failed to complete route");
                        return;
                      }

                      router.refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Unexpected error while completing"
                      );
                    }
                  });
                }}
              >
                {isPending ? "Completing…" : "Complete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

