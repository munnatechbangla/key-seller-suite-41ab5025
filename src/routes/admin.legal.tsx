import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LegalPage as LegalPageView } from "@/components/site/LegalPage";
import type { LegalContent, LegalPage } from "@/lib/cms/legal";

export const Route = createFileRoute("/admin/legal")({
  component: AdminLegalPages,
});

const DEFAULT_SLUGS = ["privacy", "terms", "refund", "faq"];

function AdminLegalPages() {
  const [rows, setRows] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("legal_pages")
      .select("*")
      .order("slug");
    if (error) toast.error(error.message);
    setRows((data as unknown as LegalPage[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  async function createNew(slug?: string) {
    const s = slug ?? prompt("Page slug (e.g. shipping, cookies)")?.trim();
    if (!s) return;
    const { data, error } = await supabase
      .from("legal_pages")
      .insert({
        slug: s,
        title: s.charAt(0).toUpperCase() + s.slice(1),
        content: { sections: [{ h: "Section", p: "Content..." }] },
        is_published: false,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Created");
    await load();
    setSelectedId((data as unknown as LegalPage).id);
  }

  async function save(patch: Partial<LegalPage>) {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("legal_pages").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setRows((rs) => rs.map((r) => (r.id === selected.id ? { ...r, ...patch } as LegalPage : r)));
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete page "${selected.slug}"?`)) return;
    const { error } = await supabase.from("legal_pages").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setSelectedId(null);
    await load();
  }

  const missingDefaults = DEFAULT_SLUGS.filter((s) => !rows.some((r) => r.slug === s));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Legal Pages</h1>
          <p className="text-sm text-muted-foreground">Manage Privacy, Terms, Refund, FAQ and custom legal pages.</p>
        </div>
        <Button onClick={() => createNew()}>
          <Plus className="h-4 w-4 mr-2" /> New page
        </Button>
      </div>

      {missingDefaults.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between flex-wrap gap-2">
          <span>Missing default pages: {missingDefaults.join(", ")}</span>
          <div className="flex gap-2">
            {missingDefaults.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => createNew(s)}>
                Create {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="border rounded-md bg-background">
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted ${selectedId === r.id ? "bg-muted" : ""}`}
                  >
                    <span>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">/{r.slug}</div>
                    </span>
                    {r.is_published ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="p-4 text-sm text-muted-foreground">No pages yet.</li>
              )}
            </ul>
          </aside>

          <section className="min-w-0">
            {selected ? (
              <Editor
                key={selected.id}
                page={selected}
                saving={saving}
                onSave={save}
                onDelete={remove}
              />
            ) : (
              <div className="border rounded-md p-10 text-center text-muted-foreground bg-background">
                Select a page to edit, or create a new one.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Editor({
  page,
  saving,
  onSave,
  onDelete,
}: {
  page: LegalPage;
  saving: boolean;
  onSave: (patch: Partial<LegalPage>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [subtitle, setSubtitle] = useState(page.subtitle ?? "");
  const [isPublished, setIsPublished] = useState(page.is_published);
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "");
  const [canonical, setCanonical] = useState(page.canonical_url ?? "");
  const [contentText, setContentText] = useState(JSON.stringify(page.content ?? {}, null, 2));
  const [contentError, setContentError] = useState<string | null>(null);

  const parsedContent: LegalContent = useMemo(() => {
    try {
      const v = JSON.parse(contentText || "{}");
      return v as LegalContent;
    } catch (e) {
      return page.content ?? {};
    }
  }, [contentText, page.content]);

  function handleSave() {
    let content: LegalContent;
    try {
      content = JSON.parse(contentText || "{}");
      setContentError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      setContentError(msg);
      toast.error("Content JSON is invalid");
      return;
    }
    onSave({
      title,
      subtitle: subtitle || null,
      is_published: isPublished,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      canonical_url: canonical || null,
      content,
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-4 border rounded-md p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Slug: /{page.slug}</div>
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="pub" />
            <Label htmlFor="pub">{isPublished ? "Published" : "Draft"}</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Content (JSON)</Label>
          <Textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Shape: <code>{"{ sections: [{h,p}] }"}</code> or <code>{"{ faq_groups: [{name, items:[{q,a}]}] }"}</code> or <code>{"{ body_md: '...' }"}</code>
          </p>
          {contentError && <p className="text-xs text-destructive">{contentError}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-2">
            <Label>SEO Title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Canonical URL</Label>
            <Input value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>SEO Description</Label>
            <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-background overflow-hidden">
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">Live preview</div>
        <div className="max-h-[80vh] overflow-auto scale-[0.95] origin-top">
          <LegalPageView
            title={title || page.title}
            subtitle={subtitle}
            sections={parsedContent.sections}
            bodyMd={parsedContent.body_md ?? null}
          />
        </div>
      </div>
    </div>
  );
}
