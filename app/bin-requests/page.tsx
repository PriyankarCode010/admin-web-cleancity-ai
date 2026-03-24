import { BinRequestsClient, type BinRequestItem } from "./BinRequestsClient";
import { getSupabaseServiceClient } from "../../lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BinRequestsPage() {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("bin_requests")
    .select("id, latitude, longitude, address, status, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BinRequestsPage] Failed to fetch bin requests", error);
  }

  const rows = Array.isArray(data) ? data : [];

  const binRequests: BinRequestItem[] = rows.map((br: any) => ({
    id: br.id,
    address: br.address ?? "Unknown address",
    latitude: br.latitude ?? null,
    longitude: br.longitude ?? null,
    status: String(br.status ?? "requested"),
    created_at: br.created_at ?? null,
    user_id: br.user_id ?? null,
  }));

  return <BinRequestsClient binRequests={binRequests} />;
}
