/**
 * Central debug logging. Search logs for `[CleanCity:`.
 *
 * - **Server** (RSC, Route Handlers, `getServerFetchBaseUrl`, etc.): logs go to the
 *   **terminal** / Vercel function logs — not the browser.
 * - **Client** (`"use client"` components): `dbg()` runs in the **browser** DevTools console.
 * - To mirror a **server page** into the browser, pass a snapshot via `<BrowserDebugLog />`
 *   from `components/BrowserDebugLog.tsx`.
 *
 * Disable verbose logs: `NEXT_PUBLIC_DEBUG_LOGS=0` (does not affect `dbgErr`).
 */
const disabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === "0";

export function dbg(tag: string, message: string, meta?: Record<string, unknown>) {
  if (disabled) return;
  const where = typeof window !== "undefined" ? "browser" : "server";
  const prefix = `[CleanCity:${tag}:${where}]`;
  if (meta && Object.keys(meta).length > 0) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}

export function dbgErr(tag: string, message: string, err: unknown) {
  console.error(`[CleanCity:${tag}]`, message, err);
}
