import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  landingGetPageFn, landingUpsertPageFn,
  landingListSectionsFn, landingUpsertSectionFn,
  landingDeleteSectionFn, landingReorderSectionsFn,
  landingListTemplatesFn, landingSaveAsTemplateFn, landingApplyTemplateFn,
} from "@/lib/landing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionRenderer, type CmsSection } from "@/components/cms/SectionRenderer";
import { Trash2, Plus, ChevronUp, ChevronDown, Save, Monitor, Tablet, Smartphone, ArrowLeft, FileDown, FileUp } from "lucide-react";

export const Route = createFileRoute("/admin/cms/landing-pages/$id")({
  component: LandingEditor,
});

const SUPPORTED_TYPES: { key: string; label: string; sample: any }[] = [
  { key: "hero", label: "Hero", sample: { headline: "Big headline", cta: { label: "Get started", href: "#" } } },
  { key: "cta", label: "CTA", sample: { headline: "Ready?", cta: { label: "Buy now", href: "#" } } },
  { key: "features", label: "Features", sample: { items: [{ title: "Fast", description: "Really fast" }] } },
  { key: "statistics", label: "Statistics", sample: { items: [{ value: "10k+", label: "Users" }] } },
  { key: "testimonials", label: "Testimonials", sample: { items: [{ author: "Jane", quote: "Amazing" }] } },
  { key: "faq", label: "FAQ", sample: { items: [{ q: "What is it?", a: "A landing page." }] } },
  { key: "gallery", label: "Gallery", sample: { images: [] } },
  { key: "video", label: "Video", sample: { url: "" } },
  { key: "newsletter", label: "Newsletter", sample: { title: "Join us", placeholder: "you@example.com" } },
  { key: "featured_products", label: "Featured Products", sample: { source: "featured", limit: 8 } },
  { key: "flash_sale", label: "Countdown / Flash Sale", sample: { ends_at: new Date(Date.now() + 86400000).toISOString() } },
  { key: "custom_html", label: "Custom HTML", sample: { html: "<div>Custom block</div>" } },
  { key: "text_image", label: "Text + Image / Columns", sample: { text: "About", image: "" } },
  { key: "spacer", label: "Spacer", sample: { height: "60px" } },
  { key: "divider", label: "Divider", sample: {} },
];

type Section = CmsSection;
type PageRow = any;

function LandingEditor() {
  const { id } = Route.useParams();
  const getPage = useServerFn(landingGetPageFn);
  const upsertPage = useServerFn(landingUpsertPageFn);
  const listSec = useServerFn(landingListSectionsFn);
  const upsertSec = useServerFn(landingUpsertSectionFn);
  const delSec = useServerFn(landingDeleteSectionFn);
  const reorder = useServerFn(landingReorderSectionsFn);
  const listTpl = useServerFn(landingListTemplatesFn);
  const saveTpl = useServerFn(landingSaveAsTemplateFn);
  const applyTpl = useServerFn(landingApplyTemplateFn);

  const [page, setPage] = useState<PageRow | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const refresh = async () => {
    const p = await getPage({ data: { id } });
    setPage(p);
    const s = await listSec({ data: { page_id: id } });
    setSections(s as Section[]);
  };
  useEffect(() => { refresh(); listTpl().then((t) => setTemplates(t as any[])); }, [id]);

  const addSection = async (typeKey: string) => {
    const tpl = SUPPORTED_TYPES.find((t) => t.key === typeKey)!;
    await upsertSec({
      data: {
        page_id: id,
        section_key: `${typeKey}-${Date.now().toString(36)}`,
        section_type: typeKey,
        title: null,
        subtitle: null,
        json_content: tpl.sample,
        sort_order: sections.length,
        enabled: true,
      } as any,
    });
    refresh();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[index]; const b = sections[target];
    await reorder({ data: { items: [{ id: a.id, sort_order: b.sort_order }, { id: b.id, sort_order: a.sort_order }] } });
    refresh();
  };

  const currentSection = useMemo(() => sections.find((s) => s.id === selected) ?? null, [sections, selected]);

  const savePageMeta = async () => {
    if (!page) return;
    await upsertPage({ data: {
      id: page.id, slug: page.slug, title: page.title, description: page.description,
      page_type: page.page_type, status: page.status,
      meta_title: page.meta_title, meta_description: page.meta_description,
      og_title: page.og_title, og_description: page.og_description, og_image: page.og_image,
      canonical_url: page.canonical_url, robots: page.robots, theme: page.theme ?? {},
    } as any });
    toast.success("Page saved");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ page, sections }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${page?.slug || "landing"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const secs = (parsed?.sections ?? []) as any[];
      for (let i = 0; i < secs.length; i++) {
        const s = secs[i];
        await upsertSec({ data: {
          page_id: id,
          section_key: `${s.section_type}-${Date.now().toString(36)}-${i}`,
          section_type: s.section_type,
          title: s.title ?? null, subtitle: s.subtitle ?? null,
          json_content: s.json_content ?? {},
          sort_order: sections.length + i, enabled: s.enabled ?? true,
        } as any });
      }
      toast.success("Imported");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!page) return <div className="p-6">Loading…</div>;

  const canvasWidth = device === "mobile" ? "max-w-sm" : device === "tablet" ? "max-w-2xl" : "max-w-full";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b p-3 flex items-center gap-2 bg-background">
        <Button size="sm" variant="ghost" asChild><Link to="/admin/cms/landing-pages"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <div className="font-semibold">{page.title}</div>
          <div className="text-xs text-muted-foreground">/l/{page.slug} — {page.status}</div>
        </div>
        <div className="flex gap-1 border rounded p-0.5">
          <Button size="sm" variant={device === "desktop" ? "default" : "ghost"} onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
          <Button size="sm" variant={device === "tablet" ? "default" : "ghost"} onClick={() => setDevice("tablet")}><Tablet className="h-4 w-4" /></Button>
          <Button size="sm" variant={device === "mobile" ? "default" : "ghost"} onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
        </div>
        <Button size="sm" variant="outline" onClick={exportJson}><FileDown className="h-4 w-4 mr-1" />Export</Button>
        <label className="inline-flex">
          <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <Button size="sm" variant="outline" asChild><span><FileUp className="h-4 w-4 mr-1" />Import</span></Button>
        </label>
        <Button size="sm" onClick={savePageMeta}><Save className="h-4 w-4 mr-1" />Save page</Button>
      </div>

      <div className="grid grid-cols-12 flex-1 min-h-0">
        {/* Left: section list + add */}
        <aside className="col-span-3 border-r overflow-y-auto p-3 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Sections</div>
            <div className="space-y-1">
              {sections.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-1 border rounded p-2 text-sm ${selected === s.id ? "border-primary" : ""}`}>
                  <button className="flex-1 text-left truncate" onClick={() => setSelected(s.id)}>{s.section_type} · {s.section_key}</button>
                  <Switch checked={s.enabled} onCheckedChange={async (v) => { await upsertSec({ data: { ...s, enabled: v } as any }); refresh(); }} />
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete section?")) { await delSec({ data: { id: s.id } }); refresh(); } }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {sections.length === 0 && <p className="text-xs text-muted-foreground">No sections. Add one below.</p>}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Add block</div>
            <div className="grid grid-cols-2 gap-1">
              {SUPPORTED_TYPES.map((t) => (
                <Button key={t.key} size="sm" variant="outline" onClick={() => addSection(t.key)}><Plus className="h-3 w-3 mr-1" />{t.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Templates</div>
            <Button size="sm" variant="outline" className="w-full" onClick={async () => {
              const name = prompt("Template name?"); if (!name) return;
              await saveTpl({ data: { page_id: id, name } });
              toast.success("Saved as template");
              listTpl().then((t) => setTemplates(t as any[]));
            }}>Save current as template</Button>
            <div className="mt-2 space-y-1">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-1 border rounded p-2 text-xs">
                  <span className="flex-1 truncate">{t.name}</span>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const replace = confirm("Replace current sections? OK = replace, Cancel = append");
                    await applyTpl({ data: { page_id: id, template_id: t.id, replace } });
                    refresh();
                  }}>Apply</Button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: preview */}
        <main className="col-span-6 overflow-y-auto bg-muted/20 p-4">
          <div className={`mx-auto bg-background ${canvasWidth} shadow rounded`}>
            {sections.filter((s) => s.enabled).length === 0 && (
              <div className="p-10 text-center text-muted-foreground text-sm">Add a section to see the preview.</div>
            )}
            {sections.filter((s) => s.enabled).map((s) => (
              <div key={s.id} className={`relative ${selected === s.id ? "outline outline-2 outline-primary" : ""}`} onClick={() => setSelected(s.id)}>
                <SectionRenderer section={s} />
              </div>
            ))}
          </div>
        </main>

        {/* Right: inspector */}
        <aside className="col-span-3 border-l overflow-y-auto p-3 space-y-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Inspector</div>
          {currentSection ? (
            <Card><CardContent className="p-3 space-y-3">
              <div><Label>Title</Label><Input value={currentSection.title ?? ""} onChange={(e) => setSections((prev) => prev.map((s) => s.id === currentSection.id ? { ...s, title: e.target.value } : s))} onBlur={async (e) => { await upsertSec({ data: { ...currentSection, title: e.target.value } as any }); refresh(); }} /></div>
              <div><Label>Subtitle</Label><Input value={currentSection.subtitle ?? ""} onChange={(e) => setSections((prev) => prev.map((s) => s.id === currentSection.id ? { ...s, subtitle: e.target.value } : s))} onBlur={async (e) => { await upsertSec({ data: { ...currentSection, subtitle: e.target.value } as any }); refresh(); }} /></div>
              <div>
                <Label>JSON content</Label>
                <Textarea rows={14} className="font-mono text-xs" defaultValue={JSON.stringify(currentSection.json_content ?? {}, null, 2)} onBlur={async (e) => {
                  try {
                    const j = JSON.parse(e.target.value || "{}");
                    await upsertSec({ data: { ...currentSection, json_content: j } as any });
                    refresh();
                  } catch { toast.error("Invalid JSON"); }
                }} />
              </div>
            </CardContent></Card>
          ) : (
            <p className="text-xs text-muted-foreground">Select a section to edit.</p>
          )}

          <div className="border-t pt-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Page</div>
            <div><Label>Title</Label><Input value={page.title ?? ""} onChange={(e) => setPage({ ...page, title: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={page.slug ?? ""} onChange={(e) => setPage({ ...page, slug: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={page.status} onValueChange={(v) => setPage({ ...page, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
