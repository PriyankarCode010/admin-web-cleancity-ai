import { BrowserDebugLog } from "@/components/BrowserDebugLog";
import { BinRequestsClient, type BinRequestItem } from "./BinRequestsClient";
import { dbg, dbgErr } from "@/lib/debugLog";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BinRequestsPage() {
  dbg("BinRequestsPage", "render start");
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("bin_requests")
    .select("id, latitude, longitude, address, status, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    dbgErr("BinRequestsPage", "supabase select error", error);
  }

  const rows = Array.isArray(data) ? data : [];
  dbg("BinRequestsPage", "fetched rows", { count: rows.length, hasError: !!error });
  const binRequests: BinRequestItem[] = rows.map((br: any) => ({
    id: br.id,
    address: br.address ?? "Unknown address",
    latitude: br.latitude ?? null,
    longitude: br.longitude ?? null,
    status: String(br.status ?? "requested"),
    created_at: br.created_at ?? null,
    user_id: br.user_id ?? null,
  }));

  return (
    <>
      <BrowserDebugLog
        tag="BinRequestsPage"
        payload={{
          rowCount: binRequests.length,
          supabaseError: error?.message ?? null,
        }}
      />
      <BinRequestsClient binRequests={binRequests} />
    </>
  );
}
