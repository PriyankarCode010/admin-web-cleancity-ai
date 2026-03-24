"use client";

import { useEffect } from "react";

const disabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === "0";

type Props = {
  tag: string;
  /** JSON-serializable snapshot from the server (shown in DevTools → Console). */
  payload: Record<string, unknown>;
};

/**
 * Renders nothing. On hydrate, logs to the **browser** console so you can debug
 * server-rendered pages without only reading the terminal.
 */
export function BrowserDebugLog({ tag, payload }: Props) {
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    if (disabled) return;
    const prefix = `[CleanCity:${tag}:browser]`;
    console.log(prefix, "server snapshot", JSON.parse(payloadKey) as Record<string, unknown>);
  }, [tag, payloadKey]);

  return null;
}
