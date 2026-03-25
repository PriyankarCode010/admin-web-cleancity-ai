import { NextResponse } from "next/server";
import { dbgErr } from "../../../../lib/debugLog";
import { getSupabaseServiceClient } from "../../../../lib/supabaseServer";
import {
  getSupabaseOriginFromEnv,
  parseSupabaseStorageObjectUrl,
} from "../../../../lib/supabaseStorageFromUrl";

export const dynamic = "force-dynamic";

// PATCH /api/reports/:id
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { severity } = body;

    if (!severity) {
      return NextResponse.json(
        { error: "Missing severity" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from("reports")
      .update({ severity })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update severity" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/:id
export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: row, error: fetchError } = await supabase
      .from("reports")
      .select("id, image_url")
      .eq("id", params.id)
      .maybeSingle();

    if (fetchError) {
      dbgErr("api/reports/[id]", "DELETE fetch row", fetchError);
      return NextResponse.json(
        { error: "Failed to load report" },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const imageUrl =
      typeof row.image_url === "string" && row.image_url.length > 0
        ? row.image_url
        : null;

    if (imageUrl) {
      const origin = getSupabaseOriginFromEnv();
      if (origin) {
        const ref = parseSupabaseStorageObjectUrl(imageUrl, origin);
        if (ref) {
          const { error: storageError } = await supabase.storage
            .from(ref.bucket)
            .remove([ref.path]);

          if (storageError) {
            dbgErr("api/reports/[id]", "DELETE storage object (row still removed)", {
              bucket: ref.bucket,
              path: ref.path,
              message: storageError.message,
            });
          }
        }
      }
    }

    const { error } = await supabase.from("reports").delete().eq("id", params.id);

    if (error) {
      dbgErr("api/reports/[id]", "DELETE report row", error);
      return NextResponse.json(
        { error: "Failed to delete report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    dbgErr("api/reports/[id]", "DELETE unexpected", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
