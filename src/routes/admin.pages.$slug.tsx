import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Plus, ExternalLink } from "lucide-react";
import {
  defaults,
  PAGE_META,
  PAGE_SLUGS,
  type PageSlug,
  type AboutContent,
  type ContactContent,
  type FaqContent,
  type SupportContent,
  type TrackOrderContent,
  type LegalRichContent,
} from "@/lib/cms/pages/schemas";

export const Route = createFileRoute("/admin/pages/$slug")({
  component: PageEditor,
});

type Row = {
  id: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown> | null;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

function PageEditor() {
  const { slug: slugParam } = Route.useParams();
  const navigate = useNavigate();
  const slug = slugParam as PageSlug;
  const meta = PAGE_META[slug];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<Row | null>(null);
  const [content, setContent] = useState<any>(defaults[slug]);
  const [title, setTitle] = useState(meta?.title ?? "");
  const [subtitle, setSubtitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [published, setPublished] = useState(false);
  const isLegalPage = slug === "privacy" || slug === "terms" || slug === "refund";

  useEffect(() => {
    if (!meta) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
      if (data) {
        const r = data as unknown as Row;
        setRow(r);
        setContent(deepMerge(defaults[slug], r.content ?? {}));
        setTitle(r.title ?? meta.title);
        setSubtitle(r.subtitle ?? "");
        setSeoTitle(r.seo_title ?? "");
        setSeoDesc(r.seo_description ?? "");
        setPublished(r.is_published);
      } else {
        setRow(null);
        setContent(defaults[slug]);
        setTitle(meta.title);
        setSubtitle("");
        setSeoTitle("");
        setSeoDesc("");
        setPublished(false);
      }
      setLoading(false);
    })();
  }, [slug, meta]);

  if (!meta) {
    return (
      <div className="p-6">
        <p className="text-destructive">Unknown page: {slug}</p>
        <Link to="/admin/pages" className="text-primary text-sm">← Back</Link>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    const payload = {
      slug,
      title: isLegalPage ? title : meta.title,
      subtitle: isLegalPage ? subtitle || null : null,
      content,
      is_published: published,
      seo_title: seoTitle || null,
      seo_description: seoDesc || null,
    };
    let error: any;
    if (row) {
      ({ error } = await supabase.from("legal_pages").update(payload).eq("id", row.id));
    } else {
      const res = await supabase.from("legal_pages").insert(payload).select().single();
      error = res.error;
      if (res.data) setRow(res.data as unknown as Row);
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate({ to: "/admin/pages" })} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All pages
        </button>
        <div className="flex items-center gap-2">
          <a href={meta.frontendPath} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
            View <ExternalLink className="h-3 w-3" />
          </a>
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
          </label>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-1">{meta.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{meta.description}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-6">
          {isLegalPage && (
            <Section title="Hero">
              <Field label="Title" value={title} onChange={setTitle} />
              <TextArea label="Subtitle" value={subtitle} onChange={setSubtitle} rows={2} />
            </Section>
          )}

          {slug === "about" && <AboutEditor value={content} onChange={setContent} />}
          {slug === "contact" && <ContactEditor value={content} onChange={setContent} />}
          {slug === "faq" && <FaqEditor value={content} onChange={setContent} />}
          {slug === "support" && <SupportEditor value={content} onChange={setContent} />}
          {slug === "track-order" && <TrackOrderEditor value={content} onChange={setContent} />}
          {(slug === "privacy" || slug === "terms" || slug === "refund") && <LegalEditor value={content} onChange={setContent} />}
        </div>
      )}
    </div>
  );
}

/* ============ Field primitives ============ */

function deepMerge<T>(defaultsVal: T, override: unknown): T {
  if (override == null) return defaultsVal;
  if (Array.isArray(defaultsVal)) return (Array.isArray(override) ? override : defaultsVal) as T;
  if (typeof defaultsVal === "object" && defaultsVal && typeof override === "object") {
    const out: Record<string, unknown> = { ...(defaultsVal as Record<string, unknown>) };
    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      out[key] = deepMerge((defaultsVal as Record<string, unknown>)[key], value);
    }
    return out as T;
  }
  return (override === "" ? defaultsVal : (override as T));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="p-4 border-b border-border font-semibold">{title}</div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
    </div>
  );
}
function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary" />
    </div>
  );
}

function Repeater<T>({ items, add, empty, render, onChange }: { items: T[]; add: () => T; empty: string; render: (item: T, i: number, update: (patch: Partial<T>) => void) => React.ReactNode; onChange: (next: T[]) => void }) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-muted-foreground">{empty}</p>}
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2 relative">
          {render(it, i, (patch) => onChange(items.map((v, j) => (j === i ? { ...v, ...patch } : v))))}
          <button
            type="button"
            className="absolute top-2 right-2 text-destructive hover:opacity-80"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, add()])} className="inline-flex items-center gap-1 text-sm text-primary">
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}

function HeroEditor({ value, onChange }: { value: { title: string; subtitle: string }; onChange: (v: { title: string; subtitle: string }) => void }) {
  return (
    <Section title="Hero">
      <Field label="Title" value={value.title} onChange={(v) => onChange({ ...value, title: v })} />
      <TextArea label="Subtitle" value={value.subtitle} onChange={(v) => onChange({ ...value, subtitle: v })} rows={2} />
    </Section>
  );
}

/* ============ Per-page editors ============ */

function AboutEditor({ value, onChange }: { value: AboutContent; onChange: (v: AboutContent) => void }) {
  return (
    <>
      <HeroEditor value={value.hero} onChange={(hero) => onChange({ ...value, hero })} />
      <Section title="Stats (max 8)">
        <Repeater
          items={value.stats ?? []}
          add={() => ({ icon: "Sparkles", value: "", label: "" })}
          empty="No stats yet."
          onChange={(stats) => onChange({ ...value, stats })}
          render={(s, _i, update) => (
            <div className="grid sm:grid-cols-3 gap-2">
              <Field label="Icon (lucide)" value={s.icon} onChange={(v) => update({ icon: v })} placeholder="Users, Zap…" />
              <Field label="Value" value={s.value} onChange={(v) => update({ value: v })} />
              <Field label="Label" value={s.label} onChange={(v) => update({ label: v })} />
            </div>
          )}
        />
      </Section>
      <Section title="Our story">
        <Field label="Badge" value={value.story?.badge ?? ""} onChange={(v) => onChange({ ...value, story: { ...value.story!, badge: v } })} />
        <Field label="Heading" value={value.story?.heading ?? ""} onChange={(v) => onChange({ ...value, story: { ...value.story!, heading: v } })} />
        <Repeater
          items={value.story?.paragraphs ?? []}
          add={() => ""}
          empty="No paragraphs."
          onChange={(paragraphs) => onChange({ ...value, story: { ...value.story!, paragraphs: paragraphs as string[] } })}
          render={(p, i, update) => <TextArea label={`Paragraph ${i + 1}`} value={p as string} onChange={(v) => update(v as any)} rows={3} />}
        />
      </Section>
    </>
  );
}

function ContactEditor({ value, onChange }: { value: ContactContent; onChange: (v: ContactContent) => void }) {
  return (
    <>
      <HeroEditor value={value.hero} onChange={(hero) => onChange({ ...value, hero })} />
      <Section title="Contact details (overrides Settings)">
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Email" value={value.email ?? ""} onChange={(v) => onChange({ ...value, email: v })} />
          <Field label="Phone" value={value.phone ?? ""} onChange={(v) => onChange({ ...value, phone: v })} />
          <Field label="WhatsApp" value={value.whatsapp ?? ""} onChange={(v) => onChange({ ...value, whatsapp: v })} />
          <Field label="Telegram" value={value.telegram ?? ""} onChange={(v) => onChange({ ...value, telegram: v })} />
        </div>
        <TextArea label="Address" value={value.address ?? ""} onChange={(v) => onChange({ ...value, address: v })} rows={2} />
        <TextArea label="Map embed HTML (optional iframe)" value={value.map_embed ?? ""} onChange={(v) => onChange({ ...value, map_embed: v })} rows={3} />
      </Section>
      <Section title="Business hours">
        <Repeater
          items={value.hours ?? []}
          add={() => ({ day: "Mon–Fri", hours: "9:00 – 18:00" })}
          empty="Defaults to 24/7 Support."
          onChange={(hours) => onChange({ ...value, hours })}
          render={(h, _i, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Day" value={h.day} onChange={(v) => update({ day: v })} />
              <Field label="Hours" value={h.hours} onChange={(v) => update({ hours: v })} />
            </div>
          )}
        />
      </Section>
      <Section title="Form">
        <Field label="Form title" value={value.form.title} onChange={(v) => onChange({ ...value, form: { ...value.form, title: v } })} />
        <TextArea label="Form subtitle" value={value.form.subtitle} onChange={(v) => onChange({ ...value, form: { ...value.form, subtitle: v } })} rows={2} />
        <Field label="Submit label" value={value.form.submit_label} onChange={(v) => onChange({ ...value, form: { ...value.form, submit_label: v } })} />
      </Section>
    </>
  );
}

function FaqEditor({ value, onChange }: { value: FaqContent; onChange: (v: FaqContent) => void }) {
  // Migrate legacy faq_groups on demand into categories+items so future editing uses the new shape.
  useEffect(() => {
    if ((!value.categories || value.categories.length === 0) && value.faq_groups && value.faq_groups.length > 0) {
      const categories = value.faq_groups.map((g, i) => ({ id: `cat_${i}`, name: g.name }));
      const items = value.faq_groups.flatMap((g, i) => g.items.map((it) => ({ category_id: `cat_${i}`, q: it.q, a: it.a })));
      onChange({ ...value, categories, items, faq_groups: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = value.categories ?? [];
  const items = value.items ?? [];

  return (
    <>
      <HeroEditor value={value.hero} onChange={(hero) => onChange({ ...value, hero })} />
      <Section title="Search">
        <Field label="Search placeholder" value={value.search_placeholder} onChange={(v) => onChange({ ...value, search_placeholder: v })} />
      </Section>
      <Section title="Categories">
        <Repeater
          items={categories}
          add={() => ({ id: `cat_${Date.now()}`, name: "New category" })}
          empty="No categories."
          onChange={(cats) => onChange({ ...value, categories: cats })}
          render={(c, _i, update) => (
            <div className="grid grid-cols-3 gap-2">
              <Field label="ID" value={c.id} onChange={(v) => update({ id: v })} />
              <div className="col-span-2"><Field label="Name" value={c.name} onChange={(v) => update({ name: v })} /></div>
            </div>
          )}
        />
      </Section>
      <Section title="FAQ entries">
        <Repeater
          items={items}
          add={() => ({ category_id: categories[0]?.id, q: "New question?", a: "Answer…" })}
          empty="No questions yet."
          onChange={(next) => onChange({ ...value, items: next })}
          render={(it, _i, update) => (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Category</label>
                <select value={it.category_id ?? ""} onChange={(e) => update({ category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <Field label="Question" value={it.q} onChange={(v) => update({ q: v })} />
              <TextArea label="Answer" value={it.a} onChange={(v) => update({ a: v })} rows={3} />
            </div>
          )}
        />
      </Section>
    </>
  );
}

function SupportEditor({ value, onChange }: { value: SupportContent; onChange: (v: SupportContent) => void }) {
  return (
    <>
      <HeroEditor value={value.hero} onChange={(hero) => onChange({ ...value, hero })} />
      <Section title="Help cards">
        <Repeater
          items={value.cards}
          add={() => ({ icon: "HelpCircle", title: "New card", body: "", link: "" })}
          empty="No cards."
          onChange={(cards) => onChange({ ...value, cards })}
          render={(c, _i, update) => (
            <div className="grid sm:grid-cols-4 gap-2">
              <Field label="Icon" value={c.icon} onChange={(v) => update({ icon: v })} />
              <Field label="Title" value={c.title} onChange={(v) => update({ title: v })} />
              <Field label="Body" value={c.body} onChange={(v) => update({ body: v })} />
              <Field label="Link" value={c.link ?? ""} onChange={(v) => update({ link: v })} />
            </div>
          )}
        />
      </Section>
      <Section title="Contact methods">
        <p className="text-xs text-muted-foreground">Use tokens <code>{"{support_email}"}</code> and <code>{"{whatsapp}"}</code> to pull from Settings.</p>
        <Repeater
          items={value.contact_methods}
          add={() => ({ icon: "MessageCircle", label: "Live chat", value: "Reply in 2 min", href: "#", color: "bg-emerald-500" })}
          empty="No channels."
          onChange={(contact_methods) => onChange({ ...value, contact_methods })}
          render={(m, _i, update) => (
            <div className="grid sm:grid-cols-3 gap-2">
              <Field label="Icon" value={m.icon} onChange={(v) => update({ icon: v })} />
              <Field label="Label" value={m.label} onChange={(v) => update({ label: v })} />
              <Field label="Colour class" value={m.color ?? ""} onChange={(v) => update({ color: v })} />
              <div className="sm:col-span-3 grid sm:grid-cols-2 gap-2">
                <Field label="Value" value={m.value} onChange={(v) => update({ value: v })} />
                <Field label="Href" value={m.href} onChange={(v) => update({ href: v })} />
              </div>
            </div>
          )}
        />
      </Section>
      <Section title="Ticket form">
        <Field label="Heading" value={value.ticket_form.heading} onChange={(v) => onChange({ ...value, ticket_form: { ...value.ticket_form, heading: v } })} />
        <Field label="Submit label" value={value.ticket_form.submit_label} onChange={(v) => onChange({ ...value, ticket_form: { ...value.ticket_form, submit_label: v } })} />
        <Field label="Success message" value={value.ticket_form.success_message} onChange={(v) => onChange({ ...value, ticket_form: { ...value.ticket_form, success_message: v } })} />
      </Section>
    </>
  );
}

function TrackOrderEditor({ value, onChange }: { value: TrackOrderContent; onChange: (v: TrackOrderContent) => void }) {
  return (
    <>
      <HeroEditor value={value.hero} onChange={(hero) => onChange({ ...value, hero })} />
      <Section title="Tracker form">
        <Field label="Heading" value={value.tracker.heading} onChange={(v) => onChange({ ...value, tracker: { ...value.tracker, heading: v } })} />
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Order ID placeholder" value={value.tracker.placeholder_order} onChange={(v) => onChange({ ...value, tracker: { ...value.tracker, placeholder_order: v } })} />
          <Field label="Email placeholder" value={value.tracker.placeholder_email} onChange={(v) => onChange({ ...value, tracker: { ...value.tracker, placeholder_email: v } })} />
        </div>
        <Field label="Button label" value={value.tracker.button_label} onChange={(v) => onChange({ ...value, tracker: { ...value.tracker, button_label: v } })} />
        <TextArea label="Help text" value={value.tracker.help_text} onChange={(v) => onChange({ ...value, tracker: { ...value.tracker, help_text: v } })} rows={2} />
      </Section>
      <Section title="Tracking help FAQ">
        <Repeater
          items={value.faq ?? []}
          add={() => ({ q: "New question?", a: "Answer…" })}
          empty="No FAQ items."
          onChange={(faq) => onChange({ ...value, faq })}
          render={(it, _i, update) => (
            <div className="space-y-2">
              <Field label="Q" value={it.q} onChange={(v) => update({ q: v })} />
              <TextArea label="A" value={it.a} onChange={(v) => update({ a: v })} rows={3} />
            </div>
          )}
        />
      </Section>
    </>
  );
}

function LegalEditor({ value, onChange }: { value: LegalRichContent; onChange: (v: LegalRichContent) => void }) {
  return (
    <>
      <Section title="Sections">
        <p className="text-xs text-muted-foreground">Use tokens <code>{"{name}"}</code> and <code>{"{email}"}</code> to interpolate values from Settings.</p>
        <Repeater
          items={value.sections ?? []}
          add={() => ({ h: "New section", p: "" })}
          empty="No sections."
          onChange={(sections) => onChange({ ...value, sections })}
          render={(s, _i, update) => (
            <div className="space-y-2">
              <Field label="Heading" value={s.h} onChange={(v) => update({ h: v })} />
              <TextArea label="Body" value={s.p} onChange={(v) => update({ p: v })} rows={4} />
            </div>
          )}
        />
      </Section>
    </>
  );
}

/* Keep bundlers happy: reference PAGE_SLUGS so tree-shaking doesn't drop the union import. */
void PAGE_SLUGS;
