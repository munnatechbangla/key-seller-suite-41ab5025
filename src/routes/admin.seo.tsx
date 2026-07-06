import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Download, Upload } from "lucide-react";
import { adminUpsertSettingFn } from "@/lib/admin-settings.functions";
import { redirectsListFn, redirectUpsertFn, redirectDeleteFn } from "@/lib/redirects.functions";
import { useSettings, type SeoCenterConfig } from "@/lib/cms/settings";

export const Route = createFileRoute("/admin/seo")({
  component: SeoCenterPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function SeoCenterPage() {
  const upsert = useServerFn(adminUpsertSettingFn);
  const settings = useSettings((s) => s.settings);
  const loadSettings = useSettings((s) => s.load);
  const [cfg, setCfg] = useState<SeoCenterConfig>(settings.seo_center);

  useEffect(() => { setCfg(settings.seo_center); }, [settings.seo_center]);

  const save = useMutation({
    mutationFn: () => upsert({ data: { group_key: "seo_center", setting_key: "config", value: cfg as any } }),
    onSuccess: () => { toast.success("Saved"); loadSettings(); },
    onError: (e: any) => toast.error(e.message),
  });

  const set = <K extends keyof SeoCenterConfig>(k: K, v: SeoCenterConfig[K]) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/cms"><ArrowLeft className="h-4 w-4 mr-1" /> CMS</Link></Button>
        <h1 className="text-2xl font-bold">SEO &amp; Analytics Center</h1>
        <Button className="ml-auto" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save all"}
        </Button>
      </div>

      <Tabs defaultValue="site">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="site">Site SEO</TabsTrigger>
          <TabsTrigger value="verify">Verification</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="scripts">Custom Scripts</TabsTrigger>
          <TabsTrigger value="cookie">Cookie Consent</TabsTrigger>
          <TabsTrigger value="perf">Performance</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="redirects">Redirects</TabsTrigger>
          <TabsTrigger value="robots">Robots.txt</TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="space-y-3 pt-4">
          <Field label="Company Name" value={cfg.company_name} onChange={(v) => set("company_name", v)} />
          <div>
            <Label>Organization Type</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={cfg.organization_type} onChange={(e) => set("organization_type", e.target.value)}>
              {["Organization", "Corporation", "LocalBusiness", "OnlineStore", "Store", "EducationalOrganization"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <Field label="Canonical Domain" value={cfg.canonical_domain} onChange={(v) => set("canonical_domain", v)} placeholder="https://example.com" />
          <div>
            <Label>Default Robots</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={cfg.default_robots} onChange={(e) => set("default_robots", e.target.value)}>
              <option value="index,follow">index, follow</option>
              <option value="noindex,follow">noindex, follow</option>
              <option value="index,nofollow">index, nofollow</option>
              <option value="noindex,nofollow">noindex, nofollow</option>
            </select>
          </div>
          <Field label="Default OG Image URL" value={cfg.default_og_image} onChange={(v) => set("default_og_image", v)} />
          <Field label="Default Twitter Image URL" value={cfg.default_twitter_image} onChange={(v) => set("default_twitter_image", v)} />
        </TabsContent>

        <TabsContent value="verify" className="space-y-3 pt-4">
          <Field label="Google Search Console" value={cfg.google_site_verification} onChange={(v) => set("google_site_verification", v)} />
          <Field label="Bing Webmaster (msvalidate.01)" value={cfg.bing_site_verification} onChange={(v) => set("bing_site_verification", v)} />
          <Field label="Yandex Webmaster" value={cfg.yandex_verification} onChange={(v) => set("yandex_verification", v)} />
          <Field label="Pinterest (p:domain_verify)" value={cfg.pinterest_verification} onChange={(v) => set("pinterest_verification", v)} />
          <Field label="Facebook Domain Verification" value={cfg.facebook_domain_verification} onChange={(v) => set("facebook_domain_verification", v)} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">GA4, GTM and Meta Pixel are configured under Admin → Settings → Analytics. The fields below add additional providers.</p>
          <Field label="TikTok Pixel ID" value={cfg.tiktok_pixel_id} onChange={(v) => set("tiktok_pixel_id", v)} />
          <Field label="Microsoft Clarity ID" value={cfg.clarity_id} onChange={(v) => set("clarity_id", v)} />
          <Field label="LinkedIn Insight Partner ID" value={cfg.linkedin_partner_id} onChange={(v) => set("linkedin_partner_id", v)} />
          <Field label="Snap Pixel ID" value={cfg.snap_pixel_id} onChange={(v) => set("snap_pixel_id", v)} />
          <div>
            <Label>Custom Analytics HTML</Label>
            <Textarea rows={4} value={cfg.custom_analytics} onChange={(e) => set("custom_analytics", e.target.value)} placeholder="<script>...</script>" />
          </div>
        </TabsContent>

        <TabsContent value="scripts" className="space-y-3 pt-4">
          <TextArea label="Head scripts" value={cfg.head_scripts} onChange={(v) => set("head_scripts", v)} />
          <TextArea label="Body start scripts" value={cfg.body_start_scripts} onChange={(v) => set("body_start_scripts", v)} />
          <TextArea label="Body end scripts" value={cfg.body_end_scripts} onChange={(v) => set("body_end_scripts", v)} />
          <TextArea label="Footer scripts" value={cfg.footer_scripts} onChange={(v) => set("footer_scripts", v)} />
        </TabsContent>

        <TabsContent value="cookie" className="space-y-3 pt-4">
          <ToggleRow label="Enable cookie consent banner" checked={cfg.cookie_enabled} onChange={(v) => set("cookie_enabled", v)} />
          <TextArea label="Banner text" value={cfg.cookie_banner_text} onChange={(v) => set("cookie_banner_text", v)} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Accept label" value={cfg.cookie_accept_label} onChange={(v) => set("cookie_accept_label", v)} />
            <Field label="Reject label" value={cfg.cookie_reject_label} onChange={(v) => set("cookie_reject_label", v)} />
            <Field label="Preferences label" value={cfg.cookie_preferences_label} onChange={(v) => set("cookie_preferences_label", v)} />
          </div>
          <Field label="Privacy policy URL" value={cfg.cookie_privacy_url} onChange={(v) => set("cookie_privacy_url", v)} />
        </TabsContent>

        <TabsContent value="perf" className="space-y-3 pt-4">
          <TextArea label="Preconnect URLs (space-separated)" value={cfg.preconnect_urls} onChange={(v) => set("preconnect_urls", v)} />
          <TextArea label="DNS Prefetch URLs (space-separated)" value={cfg.dns_prefetch_urls} onChange={(v) => set("dns_prefetch_urls", v)} />
          <ToggleRow label="Enable image lazy loading" checked={cfg.lazy_loading} onChange={(v) => set("lazy_loading", v)} />
          <ToggleRow label="Enable image optimization" checked={cfg.image_optimization} onChange={(v) => set("image_optimization", v)} />
          <ToggleRow label="Enable font optimization" checked={cfg.font_optimization} onChange={(v) => set("font_optimization", v)} />
        </TabsContent>

        <TabsContent value="social" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Primary social links are managed under Admin → Settings → Social. Add extra links below.</p>
          {cfg.extra_social.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
              <div><Label>Label</Label><Input value={row.label} onChange={(e) => {
                const next = [...cfg.extra_social]; next[i] = { ...row, label: e.target.value }; set("extra_social", next);
              }} /></div>
              <div><Label>URL</Label><Input value={row.href} onChange={(e) => {
                const next = [...cfg.extra_social]; next[i] = { ...row, href: e.target.value }; set("extra_social", next);
              }} /></div>
              <Button variant="ghost" size="icon" onClick={() => set("extra_social", cfg.extra_social.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("extra_social", [...cfg.extra_social, { label: "", href: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Add social link
          </Button>
        </TabsContent>

        <TabsContent value="redirects" className="pt-4">
          <RedirectsPanel />
        </TabsContent>

        <TabsContent value="robots" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            <code>robots.txt</code> is served from <code>public/robots.txt</code>. Edit that file in the codebase to customize crawler access.
          </p>
          <pre className="p-3 border rounded-md text-xs bg-muted overflow-auto">{`User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /checkout
Sitemap: /sitemap.xml`}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>;
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="text-sm">{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function RedirectsPanel() {
  const list = useServerFn(redirectsListFn);
  const upsert = useServerFn(redirectUpsertFn);
  const del = useServerFn(redirectDeleteFn);
  const qc = useQueryClient();
  const key = ["admin-redirects"];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list() });
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<{ source_path: string; target_path: string; status_code: number; note?: string; enabled: boolean }>({
    source_path: "", target_path: "", status_code: 301, enabled: true,
  });

  const save = useMutation({
    mutationFn: (row: any) => upsert({ data: row }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: key }); setDraft({ source_path: "", target_path: "", status_code: 301, enabled: true }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const rows = (data as any[]).filter((r) =>
    !q || r.source_path.includes(q) || r.target_path.includes(q),
  );

  const exportCsv = () => {
    const csv = ["source,target,status,enabled", ...(data as any[]).map((r) => `${r.source_path},${r.target_path},${r.status_code},${r.enabled}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "redirects.csv"; a.click();
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
    for (const line of lines) {
      const [source, target, status, enabled] = line.split(",");
      if (!source || !target) continue;
      await upsert({ data: {
        source_path: source.trim(),
        target_path: target.trim(),
        status_code: Number(status || 301),
        enabled: (enabled ?? "true").trim() !== "false",
      } as any });
    }
    qc.invalidateQueries({ queryKey: key });
    toast.success("Imported");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 items-end p-4 border rounded-lg">
        <div><Label>Source path</Label><Input value={draft.source_path} onChange={(e) => setDraft({ ...draft, source_path: e.target.value })} placeholder="/old-page" /></div>
        <div><Label>Target</Label><Input value={draft.target_path} onChange={(e) => setDraft({ ...draft, target_path: e.target.value })} placeholder="/new-page" /></div>
        <div><Label>Status</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={draft.status_code} onChange={(e) => setDraft({ ...draft, status_code: Number(e.target.value) })}>
            <option value={301}>301 permanent</option>
            <option value={302}>302 temporary</option>
            <option value={410}>410 gone</option>
          </select>
        </div>
        <div className="flex items-center gap-2"><Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} /><span className="text-xs">Enabled</span></div>
        <Button size="sm" onClick={() => {
          if (!draft.source_path || !draft.target_path) return toast.error("Source and target required");
          save.mutate(draft);
        }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>

      <div className="flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search redirects…" className="max-w-sm" />
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
        <label className="inline-flex items-center gap-1 border rounded-md px-2 py-1.5 text-sm cursor-pointer">
          <Upload className="h-4 w-4" /> Import
          <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </label>
      </div>

      <div className="border rounded-lg divide-y">
        {isLoading && <div className="p-4 text-muted-foreground">Loading…</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-mono text-sm">{r.source_path} → {r.target_path}</div>
              <div className="text-xs text-muted-foreground">{r.status_code} · {r.enabled ? "enabled" : "disabled"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!isLoading && rows.length === 0 && <div className="p-4 text-muted-foreground text-sm">No redirects yet.</div>}
      </div>
    </div>
  );
}
