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

  const normalized = (status ?? "").toLowerCase();
  const isAssigned = !!workerId || normalized === "assigned";
  const disabled = normalized === "completed" || !isAssigned;

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          if (disabled) return;
          const ok = window.confirm(
            "Mark this route as completed and update the reports? This will clear the route for workers."
          );
          if (!ok) return;

          setError(null);
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
                e instanceof Error ? e.message : "Unexpected error while completing"
              );
            }
          });
        }}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Completing…" : "Complete"}
      </button>
      {error ? (
        <p className="text-xs text-rose-600 max-w-xs">{error}</p>
      ) : null}
    </div>
  );
}

