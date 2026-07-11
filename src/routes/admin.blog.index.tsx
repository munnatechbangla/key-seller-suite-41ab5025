import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  blogAdminListFn, blogAdminUpsertFn, blogAdminDeleteFn,
  blogAdminListCommentsFn, blogAdminModerateCommentFn,
} from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { Plus, Trash2, ExternalLink } from "lucide-react";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export const Route = createFileRoute("/admin/blog")({ component: AdminBlog });

const POST_TYPES = ["blog","kb","docs","tutorial","news","update","release","changelog","guide","review","comparison","faq"] as const;

type Post = {
  id: string; slug: string; title: string; subtitle: string | null; excerpt: string | null;
  content_html: string | null; content_markdown: string | null;
  cover_url: string | null; cover_alt: string | null;
  post_type: string; status: string; featured: boolean; pinned: boolean; allow_comments: boolean;
  meta_title: string | null; meta_description: string | null; focus_keyword: string | null;
  secondary_keywords: string[]; canonical_url: string | null; robots: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null;
  twitter_title: string | null; twitter_description: string | null; twitter_image: string | null;
  schema_article: boolean;
  version: string | null; release_date: string | null;
  published_at: string | null; scheduled_at: string | null; updated_at: string;
  reading_time: number | null; word_count: number | null; views: number; likes: number;
};

function AdminBlog() {
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Content Platform</h1>
        <p className="text-sm text-muted-foreground">Blog, Knowledge Base, Documentation, Changelog, News, Tutorials & more. Existing pages remain unchanged.</p>
      </header>
      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Articles</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="links">Public URLs</TabsTrigger>
        </TabsList>
        <TabsContent value="posts"><PostsTab /></TabsContent>
        <TabsContent value="comments"><CommentsTab /></TabsContent>
        <TabsContent value="links"><LinksTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PostsTab() {
  const list = useServerFn(blogAdminListFn);
  const upsert = useServerFn(blogAdminUpsertFn);
  const del = useServerFn(blogAdminDeleteFn);
  const [rows, setRows] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const refresh = () => list().then((r) => setRows(r as unknown as Post[]));
  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    setEditing({ slug: "", title: "", post_type: "blog", status: "draft", robots: "index,follow", schema_article: true, featured: false, pinned: false, allow_comments: true, secondary_keywords: [] });
    setOpen(true);
  };
  const save = async () => {
    if (!editing?.slug || !editing?.title) { toast.error("Slug and title required"); return; }
    try {
      const words = (editing.content_markdown ?? editing.content_html ?? "").split(/\s+/).filter(Boolean).length;
      const payload = { ...editing, word_count: words, reading_time: Math.max(1, Math.round(words / 220)) };
      await upsert({ data: payload as never });
      toast.success("Saved");
      setOpen(false); refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.post_type === filter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <Label>Type</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {POST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Article</Button>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr><th className="p-3">Title</th><th className="p-3">Slug</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3 text-muted-foreground">/{r.slug}</td>
                <td className="p-3">{r.post_type}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete article?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No articles yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit article" : "New article"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => {
                  const title = e.target.value;
                  setEditing((prev) => {
                    if (!prev) return prev;
                    const autoSlug = !prev.id && (!prev.slug || prev.slug === slugify(prev.title ?? ""));
                    return { ...prev, title, slug: autoSlug ? slugify(title) : prev.slug };
                  });
                }} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
              </div>
              <div><Label>Subtitle</Label><Input value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} /></div>
              <div><Label>Excerpt</Label><Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Type</Label>
                  <Select value={editing.post_type ?? "blog"} onValueChange={(v) => setEditing({ ...editing, post_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{POST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={editing.status ?? "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Scheduled at</Label><Input type="datetime-local" value={(editing.scheduled_at ?? "").slice(0,16)} onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2"><Switch checked={!!editing.featured} onCheckedChange={(v) => setEditing({ ...editing, featured: v })} /><Label>Featured</Label></div>
                <div className="flex items-center gap-2"><Switch checked={!!editing.pinned} onCheckedChange={(v) => setEditing({ ...editing, pinned: v })} /><Label>Pinned</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editing.allow_comments !== false} onCheckedChange={(v) => setEditing({ ...editing, allow_comments: v })} /><Label>Comments</Label></div>
              </div>
              <MediaPicker label="Featured image" value={editing.cover_url ?? ""} onChange={(v) => setEditing({ ...editing, cover_url: v || null })} />
              <div><Label>Content (Markdown or HTML)</Label>
                <Textarea rows={12} value={editing.content_markdown ?? editing.content_html ?? ""} onChange={(e) => setEditing({ ...editing, content_markdown: e.target.value })} placeholder="Rich text, Markdown, HTML, code blocks, images, callouts, tables, FAQs, quotes, CTAs..." />
              </div>

              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">SEO & Structured Data</summary>
                <div className="mt-3 space-y-3">
                  <div><Label>Meta title</Label><Input value={editing.meta_title ?? ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} /></div>
                  <div><Label>Meta description</Label><Textarea rows={2} value={editing.meta_description ?? ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Focus keyword</Label><Input value={editing.focus_keyword ?? ""} onChange={(e) => setEditing({ ...editing, focus_keyword: e.target.value })} /></div>
                    <div><Label>Secondary keywords (comma)</Label><Input value={(editing.secondary_keywords ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, secondary_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Canonical URL</Label><Input value={editing.canonical_url ?? ""} onChange={(e) => setEditing({ ...editing, canonical_url: e.target.value })} /></div>
                    <div><Label>Robots</Label><Input value={editing.robots ?? "index,follow"} onChange={(e) => setEditing({ ...editing, robots: e.target.value })} /></div>
                  </div>
                  <div><Label>OG title</Label><Input value={editing.og_title ?? ""} onChange={(e) => setEditing({ ...editing, og_title: e.target.value })} /></div>
                  <div><Label>OG description</Label><Textarea rows={2} value={editing.og_description ?? ""} onChange={(e) => setEditing({ ...editing, og_description: e.target.value })} /></div>
                  <div><Label>OG image</Label><Input value={editing.og_image ?? ""} onChange={(e) => setEditing({ ...editing, og_image: e.target.value })} /></div>
                  <div><Label>Twitter image</Label><Input value={editing.twitter_image ?? ""} onChange={(e) => setEditing({ ...editing, twitter_image: e.target.value })} /></div>
                  <div className="flex items-center gap-2"><Switch checked={editing.schema_article !== false} onCheckedChange={(v) => setEditing({ ...editing, schema_article: v })} /><Label>Emit Article JSON-LD</Label></div>
                </div>
              </details>

              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">Changelog / Release</summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><Label>Version</Label><Input value={editing.version ?? ""} onChange={(e) => setEditing({ ...editing, version: e.target.value })} /></div>
                  <div><Label>Release date</Label><Input type="date" value={editing.release_date ?? ""} onChange={(e) => setEditing({ ...editing, release_date: e.target.value || null })} /></div>
                </div>
              </details>

              <div className="flex justify-end gap-2 pt-2">
                {editing.slug && <Button variant="outline" asChild><a href={`/blog/${editing.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Preview</a></Button>}
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Comment = { id: string; post_id: string; body: string; guest_name: string | null; guest_email: string | null; status: string; created_at: string };
function CommentsTab() {
  const list = useServerFn(blogAdminListCommentsFn);
  const moderate = useServerFn(blogAdminModerateCommentFn);
  const [rows, setRows] = useState<Comment[]>([]);
  const refresh = () => list().then((r) => setRows(r as unknown as Comment[]));
  useEffect(() => { refresh(); }, []);
  return (
    <Card><CardContent className="p-0">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left"><tr><th className="p-3">Author</th><th className="p-3">Body</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">{c.guest_name ?? "Registered"}</td>
              <td className="p-3 max-w-md truncate">{c.body}</td>
              <td className="p-3">{c.status}</td>
              <td className="p-3 text-right space-x-1">
                <Button size="sm" variant="ghost" onClick={async () => { await moderate({ data: { id: c.id, status: "approved" } }); refresh(); }}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await moderate({ data: { id: c.id, status: "spam" } }); refresh(); }}>Spam</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await moderate({ data: { id: c.id, status: "trash" } }); refresh(); }}>Trash</Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No comments.</td></tr>}
        </tbody>
      </table>
    </CardContent></Card>
  );
}

function LinksTab() {
  return (
    <Card><CardHeader><CardTitle className="text-base">Public URLs</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>Blog article: <code>/blog/&lt;slug&gt;</code></div>
        <div>Knowledge Base: <a className="text-primary" href="/kb">/kb</a></div>
        <div>Changelog: <a className="text-primary" href="/changelog">/changelog</a></div>
        <div>Docs: <a className="text-primary" href="/docs">/docs</a></div>
      </CardContent>
    </Card>
  );
}
