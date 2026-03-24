"use client";

import { useFormState, useFormStatus } from "react-dom";

import { createRoutesAction } from "./actions";
import { createRoutesInitialState } from "./createRoutesState";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create Routes"}
    </button>
  );
}

export function CreateRoutesForm() {
  const [state, formAction] = useFormState(
    createRoutesAction,
    createRoutesInitialState,
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction} className="inline">
        <SubmitButton />
      </form>
      {state.message ? (
        <p
          className={`max-w-md text-right text-xs leading-relaxed ${
            state.ok ? "text-slate-600" : "text-rose-700"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <p className="max-w-xs text-right text-[11px] text-slate-400">
        Server logs for this button appear in the terminal where you run{" "}
        <code className="rounded bg-slate-100 px-1">npm run dev</code>, not in
        the browser console.
      </p>
    </div>
  );
}
