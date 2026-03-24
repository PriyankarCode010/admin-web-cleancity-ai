"use server";

import { revalidatePath } from "next/cache";

import { dbg, dbgErr } from "@/lib/debugLog";
import { persistRoutesFromMlPayload } from "@/lib/persistMlRoutes";

import type { CreateRoutesState } from "./createRoutesState";

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.info("[CleanCity:routes/create]", ...args);
  }
}

export async function createRoutesAction(
  _prev: CreateRoutesState,
  _formData: FormData,
): Promise<CreateRoutesState> {
  devLog("server action invoked (logs appear in the terminal running next dev, not in the browser)");

  const routingBase =
    process.env.NEXT_PUBLIC_ROUTING_SERVICE_URL?.replace(/\/+$/, "") ?? "";
  const createUrl = routingBase ? `${routingBase}/routes/create` : "";

  dbg("RoutesPage", "server action: create routes", { routingBase, createUrl });

  if (!createUrl) {
    const msg =
      "NEXT_PUBLIC_ROUTING_SERVICE_URL is not set; cannot call the routing service.";
    devLog("aborted:", msg);
    dbgErr("RoutesPage", "NEXT_PUBLIC_ROUTING_SERVICE_URL missing; skip create fetch", {});
    return { ok: false, message: msg };
  }

  try {
    devLog("POST", createUrl);
    const createRes = await fetch(createUrl, { method: "POST" });
    const status = createRes.status;
    const ok = createRes.ok;
    devLog("response", { ok, status, statusText: createRes.statusText });
    dbg("RoutesPage", "create routes response", { ok, status });

    const rawText = await createRes.text();
    let body: unknown = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }

    if (!ok) {
      const snippet = rawText.slice(0, 200);
      devLog("response body (first 200 chars)", snippet || "(empty)");
      revalidatePath("/routes");
      return {
        ok: false,
        message: `Routing service returned HTTP ${status}. ${snippet ? `Body: ${snippet}` : "Empty body."}`,
      };
    }

    const fromMl =
      body &&
      typeof body === "object" &&
      "routes_created" in body &&
      typeof (body as { routes_created: unknown }).routes_created === "number"
        ? (body as { routes_created: number; routes?: unknown[] }).routes_created
        : null;

    const persist = await persistRoutesFromMlPayload(body);
    if (persist.error) {
      dbgErr("RoutesPage", "persist ML routes to Supabase failed", persist.error);
      devLog("Supabase persist error", persist.error);
      revalidatePath("/routes");
      return {
        ok: false,
        message: `Routing service OK (HTTP ${status}) but saving routes failed: ${persist.error}`,
      };
    }

    revalidatePath("/routes");

    const createdSummary =
      fromMl !== null ? `${fromMl} route(s) from service` : "OK from service";
    const saved =
      persist.inserted > 0
        ? `Saved ${persist.inserted} route(s) to Supabase.`
        : "No route rows in the response to save—deploy the updated ML service that returns a `routes` array, or check for pending reports to cluster.";

    return {
      ok: true,
      message: `${createdSummary}. ${saved}`,
    };
  } catch (e) {
    devLog("fetch threw", e);
    dbgErr("RoutesPage", "create routes fetch threw", e);
    revalidatePath("/routes");
    return {
      ok: false,
      message: `Request failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

