import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Image as ImageIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { GatewayLogo } from "@/components/site/GatewayLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllGatewaysFn, upsertGatewayFn, deleteGatewayFn, toggleGatewayFn, reorderGatewaysFn,
  listSubmissionsFn, reviewSubmissionFn,
  type GatewayRow, type GatewayType, type JsonValue,
} from "@/lib/payments/gateways.functions";
import { testGatewayConnectionFn, getGatewayHealthFn } from "@/lib/payments/admin.functions";
import { Activity, CheckCircle, AlertCircle } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/gateways")({
  component: GatewaysPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function GatewaysPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Gateways</h1>
        <p className="text-sm text-muted-foreground">Configure built-in, custom automatic, and manual payment methods.</p>
      </div>
      <Tabs defaultValue="builtin">
        <TabsList>
          <TabsTrigger value="builtin">Built-in</TabsTrigger>
          <TabsTrigger value="custom_auto">Custom Automatic</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="builtin"><GatewayList type="builtin" /></TabsContent>
        <TabsContent value="custom_auto"><GatewayList type="custom_auto" /></TabsContent>
        <TabsContent value="manual"><GatewayList type="manual" /></TabsContent>
        <TabsContent value="submissions"><SubmissionsList /></TabsContent>
      </Tabs>
    </div>
  );
}

function GatewayList({ type }: { type: GatewayType }) {
  const fetchAll = useServerFn(listAllGatewaysFn);
  const toggle = useServerFn(toggleGatewayFn);
  const remove = useServerFn(deleteGatewayFn);
  const reorder = useServerFn(reorderGatewaysFn);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const q = useQuery({
    queryKey: ["admin", "gateways"],
    queryFn: () => fetchAll(),
  });
  const serverRows = (q.data?.gateways ?? []).filter((g) => g.type === type);

  // Sync local order with server results.
  useEffect(() => {
    setOrderedIds(serverRows.map((g) => g.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.dataUpdatedAt, type]);

  const rowMap = new Map(serverRows.map((g) => [g.id, g]));
  const rows: GatewayRow[] = (orderedIds ?? serverRows.map((g) => g.id))
    .map((id) => rowMap.get(id))
    .filter((g): g is GatewayRow => !!g);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canReorder = rows.length > 1;

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(rows, oldIndex, newIndex);
    setOrderedIds(next.map((r) => r.id));
    const items = next.map((r, i) => ({ id: r.id, sort_order: (i + 1) * 10 }));
    try {
      await reorder({ data: { items } });
      qc.invalidateQueries({ queryKey: ["admin", "gateways"] });
      qc.invalidateQueries({ queryKey: ["public", "gateways"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
      setOrderedIds(serverRows.map((g) => g.id));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} gateway{rows.length === 1 ? "" : "s"}
          {canReorder && <span className="ml-2 hidden sm:inline">· drag <GripVertical className="inline h-3 w-3" /> to reorder</span>}
        </div>
        {type !== "builtin" && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />Add {type === "manual" ? "Manual Method" : "Custom Gateway"}</Button>
        )}
      </div>
      {q.isLoading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((g) => (
              <SortableGatewayCard
                key={g.id}
                gateway={g}
                onToggle={async (v) => {
                  await toggle({ data: { id: g.id, is_enabled: v } });
                  qc.invalidateQueries({ queryKey: ["admin", "gateways"] });
                }}
                onEdit={() => setEditing(g)}
                onDelete={async () => {
                  if (!confirm(`Delete ${g.name}?`)) return;
                  await remove({ data: { id: g.id } });
                  qc.invalidateQueries({ queryKey: ["admin", "gateways"] });
                  toast.success("Deleted");
                }}
              />
            ))}
            {!q.isLoading && rows.length === 0 && (
              <div className="col-span-full text-sm text-muted-foreground text-center p-8 border rounded-xl border-dashed">No {type} gateways yet.</div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {(editing || creating) && (
        <GatewayEditor
          gateway={editing}
          defaultType={type}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "gateways"] })}
        />
      )}
    </div>
  );
}

function SortableGatewayCard({
  gateway: g, onToggle, onEdit, onDelete,
}: {
  gateway: GatewayRow;
  onToggle: (v: boolean) => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: g.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.18)" : undefined,
    opacity: isDragging ? 0.95 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-xl border bg-card p-4", isDragging && "ring-2 ring-primary/40")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="mt-1 -ml-1 text-muted-foreground hover:text-foreground touch-none cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {g.logo_url ? <GatewayLogo src={g.logo_url} alt={g.name} className="h-10 w-10 flex items-center justify-center" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold truncate">{g.name}</div>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{g.mode}</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{g.slug}</div>
          {g.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</div>}
        </div>
        <Switch checked={g.is_enabled} onCheckedChange={onToggle} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        {g.type !== "builtin" && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


function GatewayEditor({ gateway, defaultType, onClose, onSaved }: {
  gateway: GatewayRow | null; defaultType: GatewayType; onClose: () => void; onSaved: () => void;
}) {
  const save = useServerFn(upsertGatewayFn);
  const [form, setForm] = useState({
    id: gateway?.id,
    name: gateway?.name ?? "",
    slug: gateway?.slug ?? "",
    type: gateway?.type ?? defaultType,
    logo_url: gateway?.logo_url ?? "",
    description: gateway?.description ?? "",
    is_enabled: gateway?.is_enabled ?? false,
    mode: gateway?.mode ?? "sandbox" as const,
    sort_order: gateway?.sort_order ?? 100,
    configText: JSON.stringify(gateway?.config ?? defaultConfig(defaultType), null, 2),
  });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{gateway ? "Edit" : "Add"} {form.type === "manual" ? "Manual Method" : form.type === "custom_auto" ? "Custom Gateway" : "Built-in Gateway"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} disabled={!!gateway && gateway.type === "builtin"} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Gateway Logo</Label>
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 shrink-0 rounded-lg border bg-slate-900 flex items-center justify-center overflow-hidden">
                <GatewayLogo src={form.logo_url} alt={form.name} className="h-16 w-16 flex items-center justify-center" />
              </div>
              <div className="flex-1">
                <MediaPicker
                  label=""
                  accept="image"
                  value={form.logo_url}
                  onChange={(v) => setForm({ ...form, logo_url: v })}
                />
                <p className="text-xs text-muted-foreground mt-1">Stored as media:// reference. Preview is a live checkout render.</p>
              </div>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Mode</Label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "sandbox" | "live" })}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                <option value="sandbox">Sandbox</option><option value="live">Live</option>
              </select>
            </div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2"><Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} /><Label>Enabled</Label></div>
          </div>
          <div>
            <Label>Config (JSON)</Label>
            <Textarea value={form.configText} onChange={(e) => setForm({ ...form, configText: e.target.value })} rows={12} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">{configHelp(form.type)}</p>
          </div>
          {gateway && form.type === "custom_auto" && <GatewayHealthPanel id={gateway.id} slug={gateway.slug} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={async () => {
            try {
              const parsed = JSON.parse(form.configText) as { [k: string]: JsonValue };
              setSaving(true);
              await save({
                data: {
                  id: form.id, name: form.name, slug: form.slug, type: form.type,
                  logo_url: form.logo_url || null, description: form.description || null,
                  is_enabled: form.is_enabled, mode: form.mode, sort_order: form.sort_order,
                  config: parsed,
                },
              });
              toast.success("Saved");
              onSaved(); onClose();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Save failed");
            } finally { setSaving(false); }
          }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GatewayHealthPanel({ id, slug }: { id: string; slug: string }) {
  const testFn = useServerFn(testGatewayConnectionFn);
  const healthFn = useServerFn(getGatewayHealthFn);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number; status?: number } | null>(null);
  const h = useQuery({
    queryKey: ["gateway-health", slug],
    queryFn: () => healthFn({ data: { slug, limit: 10 } }),
  });

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Health & Logs</div>
        <Button size="sm" variant="outline" disabled={testing} onClick={async () => {
          setTesting(true); setTestResult(null);
          try { const r = await testFn({ data: { id } }); setTestResult(r); h.refetch(); }
          catch (e) { setTestResult({ ok: false, message: e instanceof Error ? e.message : "failed", latencyMs: 0 }); }
          finally { setTesting(false); }
        }}>{testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test Connection"}</Button>
      </div>
      {testResult && (
        <div className={cn("text-xs rounded px-2 py-1.5 flex items-center gap-2",
          testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
          {testResult.ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {testResult.message}{testResult.status ? ` · HTTP ${testResult.status}` : ""} · {testResult.latencyMs}ms
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border bg-card p-2">
          <div className="text-muted-foreground">Last success</div>
          <div className="font-mono truncate">{h.data?.lastSuccess ? new Date(h.data.lastSuccess.created_at).toLocaleString() : "—"}</div>
        </div>
        <div className="rounded border bg-card p-2">
          <div className="text-muted-foreground">Last failure</div>
          <div className="font-mono truncate">{h.data?.lastFailure ? new Date(h.data.lastFailure.created_at).toLocaleString() : "—"}</div>
          {h.data?.lastFailure?.error_message && <div className="text-destructive truncate">{h.data.lastFailure.error_message}</div>}
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto border rounded bg-card">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/40 text-muted-foreground"><tr>
            <th className="text-left p-1.5">Time</th><th className="text-left p-1.5">Event</th><th className="text-left p-1.5">Status</th><th className="text-left p-1.5">Order / Txn</th>
          </tr></thead>
          <tbody>
            {(h.data?.logs ?? []).map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-1.5 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                <td className="p-1.5">{l.event_type}</td>
                <td className="p-1.5">{l.status ?? "—"}</td>
                <td className="p-1.5 font-mono truncate max-w-[140px]">{l.order_number ?? l.transaction_id ?? "—"}</td>
              </tr>
            ))}
            {!h.isLoading && (h.data?.logs.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function defaultConfig(type: GatewayType): { [k: string]: JsonValue } {
  if (type === "manual") {
    return {
      instructions: "Send payment to the account below and submit your transaction ID.",
      account_name: "",
      account_number: "",
      qr_code_url: "",
      require_transaction_id: true,
      require_screenshot: false,
    };
  }
  if (type === "custom_auto") {
    return {
      api_base_url: "https://api.example.com",
      create_endpoint: "/v1/payments",
      verify_endpoint: "/v1/payments/{transaction_id}",
      webhook_url_path: "/api/public/payments/custom-webhook",
      request_method: "POST",
      auth_type: "bearer", // api_key | bearer | basic | custom_header
      auth: { token: "", header_name: "Authorization" },
      headers: { "Content-Type": "application/json" },
      webhook: { signature_header: "X-Signature", secret: "", verification: "hmac_sha256" },
    };
  }
  return { requires_secrets: [] };
}

function configHelp(type: GatewayType): string {
  if (type === "manual") return "Instructions and account details shown to customers at checkout.";
  if (type === "custom_auto") return "API endpoints, auth type, and webhook signature settings.";
  return "Required environment secrets for the built-in adapter.";
}

function SubmissionsList() {
  const fetchSubs = useServerFn(listSubmissionsFn);
  const review = useServerFn(reviewSubmissionFn);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const q = useQuery({
    queryKey: ["admin", "manual-submissions", status],
    queryFn: () => fetchSubs({ data: { status } }),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={cn("text-xs px-3 py-1 rounded-full capitalize",
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{s}</button>
        ))}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Gateway</th>
              <th className="text-left p-3">Txn ID</th>
              <th className="text-left p-3">Sender</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.submissions.map((s) => {
              const ord = s.orders as { order_number: string; total: number; currency: string } | null;
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{ord?.order_number ?? "—"}</td>
                  <td className="p-3">{s.gateway_slug}</td>
                  <td className="p-3 font-mono text-xs">{s.transaction_id ?? "—"}</td>
                  <td className="p-3 text-xs">{s.sender_name ?? "—"}<br /><span className="text-muted-foreground">{s.sender_account ?? ""}</span></td>
                  <td className="p-3 text-right">{ord ? `${Number(ord.total).toFixed(2)} ${ord.currency}` : "—"}</td>
                  <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded",
                    s.status === "approved" ? "bg-emerald-500/15 text-emerald-600" :
                    s.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600")}>{s.status}</span></td>
                  <td className="p-3">
                    {s.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-emerald-600"
                          onClick={async () => {
                            try {
                              await review({ data: { id: s.id, action: "approve" } });
                              toast.success("Approved — order marked paid");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Approve failed");
                            }
                            qc.invalidateQueries({ queryKey: ["admin", "manual-submissions"] });
                            qc.invalidateQueries({ queryKey: ["admin", "orders"] });
                          }}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={async () => {
                            try {
                              await review({ data: { id: s.id, action: "reject" } });
                              toast("Rejected");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Reject failed");
                            }
                            qc.invalidateQueries({ queryKey: ["admin", "manual-submissions"] });
                          }}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                        {s.screenshot_url && <ProofLink value={s.screenshot_url} />}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {q.isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</td></tr>}
            {!q.isLoading && (q.data?.submissions.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No submissions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProofLink({ value }: { value: string }) {
  const [loading, setLoading] = useState(false);
  const open = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Legacy rows may already hold a full URL.
    if (/^https?:\/\//i.test(value)) {
      window.open(value, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.storage.from("payments").createSignedUrl(value, 300);
    setLoading(false);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not load proof"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <a href="#" onClick={open} className="text-xs underline self-center">
      {loading ? "…" : "proof"}
    </a>
  );
}
