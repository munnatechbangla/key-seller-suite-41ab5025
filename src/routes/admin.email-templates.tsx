import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListEmailTemplatesFn, adminUpsertEmailTemplateFn } from "@/lib/emails/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/email-templates")({ component: TemplatesPage });

function TemplatesPage() {
  const list = useServerFn(adminListEmailTemplatesFn);
  const upsert = useServerFn(adminUpsertEmailTemplateFn);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-email-templates"], queryFn: () => list() });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = data?.find((t: any) => t.template_key === activeKey) ?? data?.[0];

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-email-templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <p className="text-sm text-muted-foreground">
          Variables use <code>{`{{name}}`}</code> syntax. <code>{`{{site_name}}`}</code> is injected automatically.
        </p>
      </div>
      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <ul className="space-y-1">
          {data?.map((t: any) => (
            <li key={t.id}>
              <button
                onClick={() => setActiveKey(t.template_key)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${active?.id === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {t.name}
                {!t.enabled && <span className="ml-2 text-xs opacity-70">(off)</span>}
              </button>
            </li>
          ))}
        </ul>
        {active && (
          <form
            key={active.id}
            className="space-y-4 rounded-lg border bg-background p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              save.mutate({
                id: active.id,
                template_key: active.template_key,
                name: String(fd.get("name") || active.name),
                subject: String(fd.get("subject") || ""),
                html_body: String(fd.get("html_body") || ""),
                text_body: String(fd.get("text_body") || ""),
                enabled: fd.get("enabled") === "on",
              });
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-muted-foreground">{active.template_key}</div>
                <Input name="name" defaultValue={active.name} className="text-lg font-semibold mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch name="enabled" defaultChecked={active.enabled} />
                Enabled
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Subject</label>
              <Input name="subject" defaultValue={active.subject} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">HTML body</label>
              <Textarea name="html_body" defaultValue={active.html_body} rows={12} className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Text body (optional)</label>
              <Textarea name="text_body" defaultValue={active.text_body ?? ""} rows={4} className="font-mono text-xs" />
            </div>
            <div className="text-xs text-muted-foreground">
              Available variables: {(active.variables as string[]).map((v) => `{{${v}}}`).join(", ")}
            </div>
            <Button type="submit" disabled={save.isPending}>Save template</Button>
          </form>
        )}
      </div>
    </div>
  );
}
