import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listAllGatewaysFn, upsertGatewayFn, deleteGatewayFn, toggleGatewayFn,
  listSubmissionsFn, reviewSubmissionFn,
  type GatewayRow, type GatewayType, type JsonValue,
} from "@/lib/payments/gateways.functions";
import { testGatewayConnectionFn, getGatewayHealthFn } from "@/lib/payments/admin.functions";
import { Activity, CheckCircle, AlertCircle } from "lucide-react";

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
  const qc = useQueryClient();
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["admin", "gateways"],
    queryFn: () => fetchAll(),
  });
  const rows = (q.data?.gateways ?? []).filter((g) => g.type === type);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} gateway{rows.length === 1 ? "" : "s"}</div>
        {type !== "builtin" && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />Add {type === "manual" ? "Manual Method" : "Custom Gateway"}</Button>
        )}
      </div>
      {q.isLoading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((g) => (
          <div key={g.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {g.logo_url ? <img src={g.logo_url} alt={g.name} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">{g.name}</div>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{g.mode}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">{g.slug}</div>
                {g.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</div>}
              </div>
              <Switch
                checked={g.is_enabled}
                onCheckedChange={async (v) => {
                  await toggle({ data: { id: g.id, is_enabled: v } });
                  qc.invalidateQueries({ queryKey: ["admin", "gateways"] });
                }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(g)}>Edit</Button>
              {g.type !== "builtin" && (
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={async () => {
                    if (!confirm(`Delete ${g.name}?`)) return;
                    await remove({ data: { id: g.id } });
                    qc.invalidateQueries({ queryKey: ["admin", "gateways"] });
                    toast.success("Deleted");
                  }}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        ))}
        {!q.isLoading && rows.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center p-8 border rounded-xl border-dashed">No {type} gateways yet.</div>
        )}
      </div>

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
          <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" /></div>
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
                          onClick={async () => { await review({ data: { id: s.id, action: "approve" } }); toast.success("Approved — order marked paid"); qc.invalidateQueries({ queryKey: ["admin", "manual-submissions"] }); }}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={async () => { await review({ data: { id: s.id, action: "reject" } }); toast("Rejected"); qc.invalidateQueries({ queryKey: ["admin", "manual-submissions"] }); }}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                        {s.screenshot_url && <a href={s.screenshot_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">proof</a>}
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
