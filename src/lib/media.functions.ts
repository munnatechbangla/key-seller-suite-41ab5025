import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listAssetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folder?: string; search?: string; mime_prefix?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await context.supabase.rpc("admin_list_media_assets", {
      _folder: data.folder ?? undefined,
      _search: data.search ?? undefined,
      _mime_prefix: data.mime_prefix ?? undefined,
      _limit: data.limit ?? 60,
      _offset: data.offset ?? 0,
    });

    if (error) throw new Error(error.message);
    return res as { items: any[]; total: number };
  });

export const registerAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    storage_path: string;
    filename: string;
    original_filename?: string;
    folder: string;
    mime_type: string;
    file_size: number;
    width?: number | null;
    height?: number | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("media")
      .createSignedUrl(data.storage_path, SIGNED_URL_TTL);
    if (sErr) throw new Error(sErr.message);
    const public_url = signed?.signedUrl ?? null;

    const { data: row, error } = await context.supabase
      .from("media_assets")
      .insert({
        storage_path: data.storage_path,
        filename: data.filename,
        original_filename: data.original_filename ?? data.filename,
        folder: data.folder || "general",
        mime_type: data.mime_type,
        file_size: data.file_size,
        width: data.width ?? null,
        height: data.height ?? null,
        public_url,
        uploader_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; filename: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("media_assets")
      .update({ filename: data.filename })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; force?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: asset, error: aErr } = await context.supabase
      .from("media_assets")
      .select("id, storage_path")
      .eq("id", data.id)
      .single();
    if (aErr || !asset) throw new Error("Asset not found");

    if (!data.force) {
      const { count } = await context.supabase
        .from("media_asset_usage")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", data.id);
      if ((count ?? 0) > 0) {
        throw new Error("This asset is currently in use.");
      }
    }
    await context.supabase.storage.from("media").remove([asset.storage_path]);
    const { error } = await context.supabase.from("media_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAssetUsageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await context.supabase.rpc("admin_get_asset_usage", { _asset_id: data.id });
    if (error) throw new Error(error.message);
    return res as any[];
  });

export const refreshAssetUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: asset } = await context.supabase
      .from("media_assets")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (!asset) throw new Error("Not found");
    const { data: signed, error } = await context.supabase.storage
      .from("media")
      .createSignedUrl(asset.storage_path, SIGNED_URL_TTL);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("media_assets")
      .update({ public_url: signed?.signedUrl })
      .eq("id", data.id);
    return { url: signed?.signedUrl };
  });
