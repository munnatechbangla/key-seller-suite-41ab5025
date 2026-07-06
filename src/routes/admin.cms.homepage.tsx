import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  cmsGetOrCreateHomePageFn,
  cmsListSectionsFn, cmsUpsertSectionFn, cmsDeleteSectionFn,
  cmsReorderSectionsFn, cmsDuplicateSectionFn,
  cmsPublishPageFn, cmsGetPageFn,
} from "@/lib/cms.functions";
import { SECTION_TYPES, findSectionDef, type SectionTypeKey } from "@/lib/cms/section-types";
import { HomepageRenderer, type CmsSection } from "@/components/cms/SectionRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, Copy, Trash2, Eye, EyeOff, Plus, ChevronDown, ChevronRight, Smartphone, Tablet, Monitor, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/cms/homepage")({
  component: HomepageBuilderPage,
});

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

function HomepageBuilderPage() {
  const ensure = useServerFn(cmsGetOrCreateHomePageFn);
  const listSecs = useServerFn(cmsListSectionsFn);
  const getPage = useServerFn(cmsGetPageFn);
  const pub = useServerFn(cmsPublishPageFn);
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<string>("draft");
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [selected, setSelected] = useState<CmsSection | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refresh = async (pid = pageId) => {
    if (!pid) return;
    const [rows, page] = await Promise.all([
      listSecs({ data: { page_id: pid } }),
      getPage({ data: { id: pid } }),
    ]);
    setSections(rows as CmsSection[]);
    if (page) setPageStatus((page as any).status);
  };

  useEffect(() => {
    (async () => {
      const page = await ensure();
      setPageId((page as any).id);
      setPageStatus((page as any).status);
      const rows = await listSecs({ data: { page_id: (page as any).id } });
      setSections(rows as CmsSection[]);
    })();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/admin/cms" className="hover:underline">CMS</Link> <ChevronRight className="h-3 w-3" /> Homepage Builder
          </div>
          <h1 className="text-2xl font-bold">Homepage Builder</h1>
          <p className="text-sm text-muted-foreground">
            Drag, drop, and configure sections. Until published, the current homepage keeps rendering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-1">
            <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
            <Button variant={device === "tablet" ? "default" : "ghost"} size="sm" onClick={() => setDevice("tablet")}><Tablet className="h-4 w-4" /></Button>
            <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" asChild><a href="/" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Live</a></Button>
          <Button
            variant={pageStatus === "published" ? "secondary" : "default"}
            onClick={async () => {
              if (!pageId) return;
              await pub({ data: { id: pageId, publish: pageStatus !== "published" } });
              setPageStatus(pageStatus === "published" ? "draft" : "published");
              toast.success(pageStatus === "published" ? "Unpublished — current homepage restored" : "Published — new homepage is live");
            }}
          >
            {pageStatus === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Sections list */}
        <aside className="col-span-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sections</h2>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <SectionRow
                key={s.id}
                s={s}
                index={i}
                total={sections.length}
                collapsed={!!collapsed[s.id]}
                selected={selected?.id === s.id}
                onSelect={() => setSelected(s)}
                onToggleCollapse={() => setCollapsed({ ...collapsed, [s.id]: !collapsed[s.id] })}
                onChanged={() => refresh().then(() => setSelected(null))}
                pageId={pageId!}
                sections={sections}
              />
            ))}
            {sections.length === 0 && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                No sections yet. Click <b>Add</b> to insert your first section.
              </CardContent></Card>
            )}
          </div>
        </aside>

        {/* Preview */}
        <main className="col-span-8">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="settings" disabled={!selected}>Section settings</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="border rounded-lg bg-muted/20 p-4 overflow-auto">
                <div className="mx-auto bg-background shadow-sm rounded-md overflow-hidden transition-all" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
                  <HomepageRenderer sections={sections} />
                  {sections.length === 0 && <div className="p-16 text-center text-sm text-muted-foreground">Add sections to preview.</div>}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="settings">
              {selected && <SectionEditor section={selected} onSaved={async () => { await refresh(); }} />}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={async (typeKey) => {
          if (!pageId) return;
          const def = findSectionDef(typeKey)!;
          const upsert = cmsUpsertSectionFn;
          await upsert({ data: {
            page_id: pageId,
            section_key: `${typeKey}-${Date.now().toString(36)}`,
            section_type: typeKey,
            title: def.label,
            subtitle: null,
            json_content: { ...def.defaults, style: { container_width: "lg", visibility: { desktop: true, tablet: true, mobile: true }, animation: "none" } },
            sort_order: sections.length,
            enabled: true,
          } as any });
          setAddOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

function SectionRow({ s, index, total, collapsed, selected, onSelect, onToggleCollapse, onChanged, sections }: {
  s: CmsSection; index: number; total: number; collapsed: boolean; selected: boolean;
  onSelect: () => void; onToggleCollapse: () => void; onChanged: () => void; pageId: string; sections: CmsSection[];
}) {
  const upsert = useServerFn(cmsUpsertSectionFn);
  const del = useServerFn(cmsDeleteSectionFn);
  const dup = useServerFn(cmsDuplicateSectionFn);
  const reorder = useServerFn(cmsReorderSectionsFn);
  const def = findSectionDef(s.section_type);

  const move = async (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const a = sections[index], b = sections[j];
    await reorder({ data: { items: [{ id: a.id, sort_order: b.sort_order }, { id: b.id, sort_order: a.sort_order }] } });
    onChanged();
  };

  return (
    <Card className={selected ? "border-primary" : ""}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={onToggleCollapse} className="p-1">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button className="flex-1 text-left" onClick={onSelect}>
            <div className="font-semibold text-sm">{s.title || def?.label || s.section_type}</div>
            <div className="text-xs text-muted-foreground">{def?.label ?? s.section_type}</div>
          </button>
          <Switch checked={s.enabled} onCheckedChange={async (v) => { await upsert({ data: { ...s, enabled: v } as any }); onChanged(); }} />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => move(-1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => move(1)} disabled={index === total - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onSelect}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: s.id } }); onChanged(); }}><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete section?")) { await del({ data: { id: s.id } }); onChanged(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionEditor({ section, onSaved }: { section: CmsSection; onSaved: () => Promise<void> }) {
  const upsert = useServerFn(cmsUpsertSectionFn);
  const [draft, setDraft] = useState<CmsSection>(section);
  useEffect(() => setDraft(section), [section.id]);
  const style = draft.json_content?.style ?? {};
  const setStyle = (patch: any) => setDraft({ ...draft, json_content: { ...draft.json_content, style: { ...style, ...patch } } });
  const setJson = (patch: any) => setDraft({ ...draft, json_content: { ...draft.json_content, ...patch } });

  const save = async () => {
    try {
      await upsert({ data: draft as any });
      toast.success("Saved");
      await onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Title</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
        <div><Label>Subtitle</Label><Input value={draft.subtitle ?? ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></div>
      </div>
      <div><Label>Description</Label><Textarea rows={2} value={draft.json_content?.description ?? ""} onChange={(e) => setJson({ description: e.target.value })} /></div>

      <details className="border rounded-md p-3" open>
        <summary className="font-semibold text-sm cursor-pointer">Type-specific JSON</summary>
        <p className="text-xs text-muted-foreground mt-1">Advanced: edit the raw config for this section type.</p>
        <Textarea
          rows={10}
          className="font-mono text-xs mt-2"
          defaultValue={JSON.stringify({ ...draft.json_content, style: undefined, description: undefined }, null, 2)}
          onBlur={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraft({ ...draft, json_content: { ...parsed, style, description: draft.json_content?.description } });
            } catch { toast.error("Invalid JSON"); }
          }}
        />
      </details>

      <details className="border rounded-md p-3">
        <summary className="font-semibold text-sm cursor-pointer">Style & layout</summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div><Label>Background color</Label><Input value={style.background_color ?? ""} onChange={(e) => setStyle({ background_color: e.target.value })} placeholder="#0f172a" /></div>
          <div><Label>Background image URL</Label><Input value={style.background_image ?? ""} onChange={(e) => setStyle({ background_image: e.target.value })} /></div>
          <div><Label>Overlay (CSS gradient)</Label><Input value={style.overlay ?? ""} onChange={(e) => setStyle({ overlay: e.target.value })} placeholder="linear-gradient(0deg,#0006,#0000)" /></div>
          <div><Label>Padding</Label><Input value={style.padding ?? ""} onChange={(e) => setStyle({ padding: e.target.value })} placeholder="80px 0" /></div>
          <div><Label>Margin</Label><Input value={style.margin ?? ""} onChange={(e) => setStyle({ margin: e.target.value })} /></div>
          <div><Label>Border radius</Label><Input value={style.border_radius ?? ""} onChange={(e) => setStyle({ border_radius: e.target.value })} placeholder="24px" /></div>
          <div><Label>Container width</Label>
            <Select value={style.container_width ?? "lg"} onValueChange={(v) => setStyle({ container_width: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="xl">Extra large</SelectItem>
                <SelectItem value="full">Full width</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Animation</Label>
            <Select value={style.animation ?? "none"} onValueChange={(v) => setStyle({ animation: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide-up">Slide up</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Custom CSS class</Label><Input value={style.custom_class ?? ""} onChange={(e) => setStyle({ custom_class: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!style.dark_mode} onCheckedChange={(v) => setStyle({ dark_mode: v })} /> Dark mode</label>
        </div>
        <div className="mt-3">
          <Label>Visibility</Label>
          <div className="flex gap-4 mt-1">
            {(["desktop","tablet","mobile"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm capitalize">
                <Switch checked={style.visibility?.[k] !== false} onCheckedChange={(v) => setStyle({ visibility: { ...style.visibility, [k]: v } })} /> {k}
              </label>
            ))}
          </div>
        </div>
      </details>

      <div className="flex justify-end gap-2">
        <Button onClick={save}>Save changes</Button>
      </div>
    </CardContent></Card>
  );
}

function AddSectionDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (t: SectionTypeKey) => void }) {
  const grouped = useMemo(() => {
    const m: Record<string, typeof SECTION_TYPES> = {};
    for (const t of SECTION_TYPES) { (m[t.group] ??= []).push(t); }
    return m;
  }, []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add section</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {Object.entries(grouped).map(([group, types]) => (
            <div key={group}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {types.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onAdd(t.key)}
                    className="text-left rounded-lg border p-3 hover:border-primary hover:bg-muted/40 transition"
                  >
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
