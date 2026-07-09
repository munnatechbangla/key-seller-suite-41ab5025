import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listAssetsFn,
  registerAssetFn,
  deleteAssetFn,
  renameAssetFn,
  getAssetUsageFn,
} from "@/lib/media.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Copy, Trash2, Pencil, Search, Loader2, Check } from "lucide-react";
import { resolveMediaUrl } from "@/lib/media/resolve";
import { useResolvedMediaUrl } from "@/lib/cms/site-logo";

export const MEDIA_FOLDERS = [
  "products", "categories", "brands", "hero", "banners",
  "blog", "logos", "icons", "screenshots", "downloads", "invoices", "general",
] as const;

const ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,.gif,.pdf,.zip,.rar,.txt,.mp4,.webm,image/*,application/pdf,application/zip,application/x-rar-compressed,text/plain,video/mp4,video/webm";

function sanitize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function readImageSize(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return {};
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export function MediaLibrary({
  mode = "manage",
  onSelect,
  accept = "all",
}: {
  mode?: "manage" | "picker";
  onSelect?: (asset: any) => void;
  accept?: "all" | "image";
}) {
  const [folder, setFolder] = useState<string>("");
  const [search, setSearch] = useState("");
  const [uploadFolder, setUploadFolder] = useState<string>("general");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const list = useServerFn(listAssetsFn);
  const register = useServerFn(registerAssetFn);
  const del = useServerFn(deleteAssetFn);
  const rename = useServerFn(renameAssetFn);
  const usage = useServerFn(getAssetUsageFn);

  const key = ["media-assets", folder, search, accept];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: {
      folder: folder || undefined,
      search: search || undefined,
      mime_prefix: accept === "image" ? "image/" : undefined,
      limit: 120,
    } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["media-assets"] });

  const doUpload = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    setProgress({ done: 0, total: arr.length });
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const safe = sanitize(file.name);
        const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const path = `${uploadFolder}/${stamp}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const dims = await readImageSize(file);
        await register({ data: {
          storage_path: path,
          filename: safe,
          original_filename: file.name,
          folder: uploadFolder,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          width: dims.width,
          height: dims.height,
        } });
        setProgress({ done: i + 1, total: arr.length });
      }
      toast.success(`Uploaded ${arr.length} file(s)`);
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeMutation = useMutation({
    mutationFn: async (a: any) => {
      try {
        return await del({ data: { id: a.id } });
      } catch (e: any) {
        if (e.message?.includes("in use")) {
          const rows = await usage({ data: { id: a.id } });
          throw new Error(`Asset in use by ${rows.length} record(s). Remove references first.`);
        }
        throw e;
      }
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: (v: { id: string; filename: string }) => rename({ data: v }),
    onSuccess: () => { toast.success("Renamed"); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const items = (data?.items ?? []) as any[];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-end p-4 border rounded-lg">
        <div>
          <Label className="text-xs">Upload folder</Label>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
            {MEDIA_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <input ref={fileRef} type="file" multiple accept={accept === "image" ? "image/*" : ACCEPT} className="hidden" onChange={(e) => e.target.files && doUpload(e.target.files)} />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload {progress ? `(${progress.done}/${progress.total})` : ""}
          </Button>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" placeholder="filename" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Filter folder</Label>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {MEDIA_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Drag drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground ${dragOver ? "border-primary bg-primary/5" : "border-muted"}`}
      >
        Drag &amp; drop files here to upload to <b>{uploadFolder}</b>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">No assets yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((a) => (
            <div key={a.id} className="border rounded-lg overflow-hidden bg-background flex flex-col">
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {a.mime_type?.startsWith("image/") ? (
                  <img src={a.public_url} alt={a.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs text-muted-foreground p-4 text-center break-all">{a.mime_type}</div>
                )}
                {a.usage_count > 0 && (
                  <span className="absolute top-1 right-1 text-[10px] bg-primary text-primary-foreground rounded px-1.5 py-0.5">in use · {a.usage_count}</span>
                )}
              </div>
              <div className="p-2 text-xs space-y-1">
                <div className="font-medium truncate" title={a.filename}>{a.filename}</div>
                <div className="text-muted-foreground truncate">
                  {a.folder} · {(a.file_size/1024).toFixed(1)} KB
                  {a.width ? ` · ${a.width}×${a.height}` : ""}
                </div>
                <div className="flex gap-1 pt-1">
                  {mode === "picker" && (
                    <Button size="sm" className="h-7 px-2 flex-1" onClick={() => onSelect?.(a)}>
                      <Check className="h-3 w-3 mr-1" /> Use
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy permanent link" onClick={() => {
                    navigator.clipboard.writeText(resolveMediaUrl(a));
                    toast.success("Permanent link copied");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Rename" onClick={() => setEditing(a)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={() => confirm(`Delete ${a.filename}?`) && removeMutation.mutate(a)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename asset</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Label>Filename</Label>
              <Input value={editing.filename} onChange={(e) => setEditing({ ...editing, filename: e.target.value })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && renameMutation.mutate({ id: editing.id, filename: sanitize(editing.filename) })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MediaPicker({
  value,
  onChange,
  accept = "image",
  label = "Image",
}: {
  value?: string | null;
  onChange: (url: string) => void;
  accept?: "all" | "image";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = useResolvedMediaUrl(value);
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2 items-start">
        {value && accept === "image" && preview && (
          <img src={preview} alt="" className="h-16 w-16 object-cover rounded border" />
        )}
        <div className="flex-1 space-y-1">
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="media://path or paste URL" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Select from Media Library</Button>
            {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>Clear</Button>}
          </div>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Media Library</DialogTitle></DialogHeader>
          <MediaLibrary mode="picker" accept={accept} onSelect={(a) => { onChange(resolveMediaUrl(a)); setOpen(false); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
