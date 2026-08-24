import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const adminListMediaAssets = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    folder: z.string().optional(),
    search: z.string().optional(),
    mime_prefix: z.string().optional(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("media_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (data.search) {
      query = query.ilike("filename", `%${data.search}%`);
    }

    const { data: assets, error } = await query
      .range(data.offset, data.offset + data.limit - 1);

    if (error) throw error;
    return assets;
  });

// Aliases for component compatibility
export const listAssetsFn = adminListMediaAssets;

export const adminUpsertMediaAsset = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    filename: z.string(),
    storage_path: z.string(),
    mime_type: z.string().optional().nullable(),
    size_bytes: z.number().optional().nullable(),
    metadata: z.any().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: asset, error } = await supabase
      .from("media_assets")
      .upsert({
        id: data.id || undefined,
        filename: data.filename,
        storage_path: data.storage_path,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        metadata: data.metadata || {},
      } as any)
      .select()
      .single();

    if (error) throw error;
    return asset;
  });

export const registerAssetFn = adminUpsertMediaAsset;

export const adminDeleteMediaAsset = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { error } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });

export const deleteAssetFn = adminDeleteMediaAsset;

export const adminRenameMediaAsset = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string(),
    new_filename: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: asset, error } = await supabase
      .from("media_assets")
      .update({ filename: data.new_filename } as any)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw error;
    return asset;
  });

export const renameAssetFn = adminRenameMediaAsset;

export const adminGetAssetUsage = createServerFn({ method: "GET" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: assetId }) => {
    const { data: usage, error } = await supabase
      .from("media_asset_usage")
      .select("*")
      .eq("asset_id", assetId);

    if (error) throw error;
    return usage;
  });

export const getAssetUsageFn = adminGetAssetUsage;

export const adminSyncStorageAssets = createServerFn({ method: "POST" })
  .handler(async () => {
    // Placeholder logic for storage sync
    return { success: true, count: 0 };
  });

export const syncStorageAssetsFn = adminSyncStorageAssets;
