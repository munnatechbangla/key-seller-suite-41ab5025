import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Copy, Eye, Loader2, Play, Plus, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  TEMPLATE_VARIABLES,
  renderTemplate,
  type NotificationChannel,
} from "@/lib/notifications/events";
import {
  cancelNotificationFn,
  deleteNotificationTemplateFn,
  duplicateNotificationTemplateFn,
  listNotificationQueueFn,
  listNotificationTemplatesFn,
  retryNotificationFn,
  sendNotificationFn,
  upsertNotificationTemplateFn,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [{ title: "Notifications · Admin" }],
  }),
});

type TemplateRow = {
  id: string;
  name: string;
  event_key: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables_json: string[];
  is_enabled: boolean;
  updated_at: string;
};

type QueueRow = {
  id: string;
  event_key: string;
  channel: NotificationChannel;
  recipient: string;
  status: string;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  rendered_subject: string | null;
  rendered_body: string | null;
};

function statusColor(s: string) {
  switch (s) {
    case "sent":
      return "bg-green-500/15 text-green-600";
    case "pending":
      return "bg-blue-500/15 text-blue-600";
    case "processing":
      return "bg-amber-500/15 text-amber-600";
    case "failed":
      return "bg-red-500/15 text-red-600";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function NotificationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Centralized engine for email, WhatsApp, and future channels. All lifecycle events flow
        through this engine.
      </p>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="queue">
          <QueueTab statusFilter={["pending", "processing", "failed"]} />
        </TabsContent>
        <TabsContent value="history">
          <QueueTab statusFilter={["sent", "cancelled"]} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Templates ----------------

function TemplatesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotificationTemplatesFn);
  const delFn = useServerFn(deleteNotificationTemplateFn);
  const dupFn = useServerFn(duplicateNotificationTemplateFn);
  const upsertFn = useServerFn(upsertNotificationTemplateFn);

  const { data = [], isLoading } = useQuery({
    queryKey: ["notif-templates"],
    queryFn: () => listFn() as Promise<TemplateRow[]>,
  });

  const [editing, setEditing] = useState<Partial<TemplateRow> | null>(null);

  const toggle = useMutation({
    mutationFn: (t: TemplateRow) =>
      upsertFn({
        data: {
          id: t.id,
          name: t.name,
          event_key: t.event_key,
          channel: t.channel,
          subject: t.subject,
          body: t.body,
          variables_json: t.variables_json ?? [],
          is_enabled: !t.is_enabled,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-templates"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["notif-templates"] });
    },
  });

  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["notif-templates"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {data.length} template{data.length === 1 ? "" : "s"}
        </div>
        <Button size="sm" onClick={() => setEditing({ channel: "email", is_enabled: true })}>
          <Plus className="h-4 w-4 mr-1" /> New template
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t.event_key}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="capitalize">
                      {t.channel}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={t.is_enabled}
                      onCheckedChange={() => toggle.mutate(t)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => dup.mutate(t.id)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete template "${t.name}"?`)) del.mutate(t.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No templates yet. Create one to start notifying customers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TemplateEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["notif-templates"] });
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<TemplateRow>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const upsertFn = useServerFn(upsertNotificationTemplateFn);
  const [form, setForm] = useState({
    id: initial.id,
    name: initial.name ?? "",
    event_key: initial.event_key ?? NOTIFICATION_EVENTS[0].key,
    channel: (initial.channel ?? "email") as NotificationChannel,
    subject: initial.subject ?? "",
    body: initial.body ?? "",
    is_enabled: initial.is_enabled ?? true,
  });

  const sampleVars = useMemo(
    () =>
      Object.fromEntries(TEMPLATE_VARIABLES.map((k) => [k, `{${k}}`])) as Record<string, string>,
    [],
  );
  const previewSubject = renderTemplate(form.subject ?? "", sampleVars);
  const previewBody = renderTemplate(form.body ?? "", sampleVars);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id,
          name: form.name.trim(),
          event_key: form.event_key,
          channel: form.channel,
          subject: form.channel === "email" ? form.subject : null,
          body: form.body,
          variables_json: [...TEMPLATE_VARIABLES],
          is_enabled: form.is_enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Template saved");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Event</label>
              <Select
                value={form.event_key}
                onValueChange={(v) => setForm({ ...form, event_key: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_EVENTS.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Channel</label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as NotificationChannel })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={form.is_enabled}
                onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
              />
              <span className="text-sm">Enabled</span>
            </div>
          </div>

          {form.channel === "email" && (
            <div>
              <label className="text-xs font-medium">Subject</label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Your order {{order_number}} is confirmed"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Body</label>
            <Textarea
              value={form.body}
              rows={8}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Hi {{customer_name}}, your order {{order_number}} is being processed..."
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Available variables:{" "}
            {TEMPLATE_VARIABLES.map((v) => (
              <code key={v} className="bg-muted px-1 mx-0.5 rounded">
                {`{{${v}}}`}
              </code>
            ))}
          </div>

          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs font-semibold mb-1 flex items-center gap-1">
              <Eye className="h-3 w-3" /> Preview
            </div>
            {form.channel === "email" && previewSubject && (
              <div className="text-sm font-medium mb-1">{previewSubject}</div>
            )}
            <pre className="text-xs whitespace-pre-wrap font-sans">{previewBody}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.body}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Queue / History ----------------

function QueueTab({ statusFilter }: { statusFilter: string[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotificationQueueFn);
  const sendFn = useServerFn(sendNotificationFn);
  const retryFn = useServerFn(retryNotificationFn);
  const cancelFn = useServerFn(cancelNotificationFn);

  const { data = [], isLoading } = useQuery({
    queryKey: ["notif-queue"],
    queryFn: () => listFn({ data: { limit: 200 } }) as Promise<QueueRow[]>,
  });

  const filtered = data.filter((r) => statusFilter.includes(r.status));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notif-queue"] });
  const send = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Sent");
      else toast.error(r?.error ?? "Send failed");
      invalidate();
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => { toast.success("Queued for retry"); invalidate(); },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("Cancelled"); invalidate(); },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2">Recipient</th>
            <th className="px-3 py-2">Channel</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Retry</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Sent</th>
            <th className="px-3 py-2">Last error</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-2">{r.recipient}</td>
              <td className="px-3 py-2 capitalize">{r.channel}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.event_key}</td>
              <td className="px-3 py-2">
                <Badge className={statusColor(r.status)}>{r.status}</Badge>
              </td>
              <td className="px-3 py-2">{r.retry_count}</td>
              <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-3 py-2 text-xs">
                {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-destructive max-w-[200px] truncate">
                {r.last_error ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-1">
                  {r.status !== "sent" && r.status !== "cancelled" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => send.mutate(r.id)} title="Send now">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => retry.mutate(r.id)} title="Retry">
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => cancel.mutate(r.id)} title="Cancel">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Settings ----------------

import {
  getCommunicationSettingsFn,
  runNotificationQueueOnceFn,
  sendTestEmailFn,
  sendTestWhatsAppFn,
  updateCommunicationSettingsFn,
} from "@/lib/communications.functions";

function SettingsTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCommunicationSettingsFn);
  const saveFn = useServerFn(updateCommunicationSettingsFn);
  const testEmailFn = useServerFn(sendTestEmailFn);
  const testWaFn = useServerFn(sendTestWhatsAppFn);
  const runOnceFn = useServerFn(runNotificationQueueOnceFn);

  const { data, isLoading } = useQuery({
    queryKey: ["comms-settings"],
    queryFn: () => getFn() as Promise<any>,
  });

  const [form, setForm] = useState<any>({});
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const s = { ...(data ?? {}), ...form };

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFn({ data: patch }),
    onSuccess: () => {
      toast.success("Settings saved");
      setForm({});
      qc.invalidateQueries({ queryKey: ["comms-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const sendTestEmail = useMutation({
    mutationFn: () => testEmailFn({ data: { to: testEmail, subject: "Test", body: "Hello from your store" } }),
    onSuccess: (r: any) => (r?.ok ? toast.success("Test email sent") : toast.error(r?.error ?? "Failed")),
  });
  const sendTestWa = useMutation({
    mutationFn: () => testWaFn({ data: { to: testPhone, body: "Test message" } }),
    onSuccess: (r: any) => (r?.ok ? toast.success("Test WhatsApp sent") : toast.error(r?.error ?? "Failed")),
  });
  const runOnce = useMutation({
    mutationFn: () => runOnceFn(),
    onSuccess: (r: any) => toast.success(`Processed ${r?.processed ?? 0} (sent ${r?.sent ?? 0}, deferred ${r?.deferred ?? 0}, failed ${r?.failed ?? 0})`),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  const set = (patch: Record<string, unknown>) => setForm((f: any) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6">
      {/* EMAIL */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Email</h3>
            <p className="text-xs text-muted-foreground">
              Providers are disabled until you configure them. No environment secret required.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Enabled</span>
            <Switch
              checked={!!s.email_provider_enabled}
              onCheckedChange={(v) => set({ email_provider_enabled: v })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Provider</label>
            <Select value={s.email_provider ?? "none"} onValueChange={(v) => set({ email_provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (disabled)</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
                <SelectItem value="postmark">Postmark</SelectItem>
                <SelectItem value="ses">Amazon SES (soon)</SelectItem>
                <SelectItem value="smtp">SMTP (soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">
              API Key {data?.has_email_api_key && <Badge variant="outline" className="ml-1">saved</Badge>}
            </label>
            <Input
              type="password"
              placeholder={data?.has_email_api_key ? "•••••• (leave blank to keep)" : "re_..."}
              value={s.email_api_key ?? ""}
              onChange={(e) => set({ email_api_key: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Sender Name</label>
            <Input value={s.email_from_name ?? ""} onChange={(e) => set({ email_from_name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Sender Email</label>
            <Input value={s.email_from_address ?? ""} onChange={(e) => set({ email_from_address: e.target.value })} placeholder="hello@yourdomain.com" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium">Reply-To</label>
            <Input value={s.email_reply_to ?? ""} onChange={(e) => set({ email_reply_to: e.target.value })} placeholder="support@yourdomain.com" />
          </div>
        </div>
        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <div className="flex-1">
            <label className="text-xs font-medium">Test email recipient</label>
            <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <Button variant="outline" disabled={!testEmail || sendTestEmail.isPending} onClick={() => sendTestEmail.mutate()}>
            {sendTestEmail.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Send test email
          </Button>
        </div>
      </div>

      {/* WHATSAPP */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">WhatsApp (Meta Cloud API)</h3>
            <p className="text-xs text-muted-foreground">Configure once and messages flow automatically from the queue.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Enabled</span>
            <Switch
              checked={!!s.whatsapp_provider_enabled}
              onCheckedChange={(v) => set({ whatsapp_provider_enabled: v })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Phone Number ID</label>
            <Input value={s.whatsapp_phone_number_id ?? ""} onChange={(e) => set({ whatsapp_phone_number_id: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Business Account ID</label>
            <Input value={s.whatsapp_business_account_id ?? ""} onChange={(e) => set({ whatsapp_business_account_id: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium">
              Access Token {data?.has_whatsapp_access_token && <Badge variant="outline" className="ml-1">saved</Badge>}
            </label>
            <Input
              type="password"
              placeholder={data?.has_whatsapp_access_token ? "•••••• (leave blank to keep)" : "EAA..."}
              value={s.whatsapp_access_token ?? ""}
              onChange={(e) => set({ whatsapp_access_token: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Verify Token</label>
            <Input value={s.whatsapp_verify_token ?? ""} onChange={(e) => set({ whatsapp_verify_token: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Test Number</label>
            <Input value={s.whatsapp_test_number ?? ""} onChange={(e) => set({ whatsapp_test_number: e.target.value })} />
          </div>
        </div>
        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <div className="flex-1">
            <label className="text-xs font-medium">Test WhatsApp recipient (E.164)</label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+15551234567" />
          </div>
          <Button variant="outline" disabled={!testPhone || sendTestWa.isPending} onClick={() => sendTestWa.mutate()}>
            {sendTestWa.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Send test message
          </Button>
        </div>
      </div>

      {/* WORKER */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Queue worker</h3>
            <p className="text-xs text-muted-foreground">
              A background job runs every minute. Use the button to run a batch immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Max retries</label>
            <Input type="number" className="w-20" min={1} max={10}
              value={s.max_retries ?? 3}
              onChange={(e) => set({ max_retries: Number(e.target.value) })} />
          </div>
        </div>
        <Button variant="outline" onClick={() => runOnce.mutate()} disabled={runOnce.isPending}>
          {runOnce.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Run queue now
        </Button>
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-3">
        <Button variant="ghost" onClick={() => setForm({})} disabled={!Object.keys(form).length}>
          Reset
        </Button>
        <Button onClick={() => save.mutate(form)} disabled={!Object.keys(form).length || save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
