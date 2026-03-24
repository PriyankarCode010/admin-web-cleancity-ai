"use client";

import { Worker } from "../lib/mockWorkers";

export function WorkerCard({ worker, onAssign }: { worker: Worker; onAssign: () => void }) {
  const online = worker.status === "Online";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900">{worker.name}</p>
          <p className="text-sm text-slate-600">Zone {worker.zone}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {worker.status}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        Total cleanups:{" "}
        <span className="font-semibold text-slate-900">{worker.totalCleanups}</span>
        <span className="block text-xs font-normal text-slate-500 mt-0.5">
          Resolved spots on routes assigned to this worker
        </span>
      </p>
      <button
        onClick={onAssign}
        className="inline-flex justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Assign Route
      </button>
    </div>
  );
}




