import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Star, ShieldCheck, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getMyReviewsFn, updateMyReviewFn, deleteMyReviewFn, getReviewableItemsFn, submitReviewFn } from "@/lib/reviews.functions";

export function MyReviewsTab() {
  const qc = useQueryClient();
  const myFn = useServerFn(getMyReviewsFn);
  const updateFn = useServerFn(updateMyReviewFn);
  const delFn = useServerFn(deleteMyReviewFn);
  const itemsFn = useServerFn(getReviewableItemsFn);
  const submit = useServerFn(submitReviewFn);

  const mine = useQuery({ queryKey: ["my-reviews"], queryFn: () => myFn() });
  const items = useQuery({ queryKey: ["reviewable-items"], queryFn: () => itemsFn() });

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ rating: number; title: string; body: string }>({ rating: 5, title: "", body: "" });

  function startEdit(r: { id: string; rating: number; title: string | null; body: string | null }) {
    setEditing(r.id);
    setDraft({ rating: r.rating, title: r.title ?? "", body: r.body ?? "" });
  }
  async function saveEdit(id: string) {
    await updateFn({ data: { id, rating: draft.rating, title: draft.title || null, body: draft.body || null } });
    toast.success("Updated — pending re-moderation");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["my-reviews"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    await delFn({ data: { id } });
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["my-reviews"] });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-3">Items waiting for your review</h2>
        {items.isLoading && <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {!items.isLoading && (items.data ?? []).length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-5 text-sm text-muted-foreground">You've reviewed every purchased product. Thanks!</div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {(items.data ?? []).map((it) => (
            <NewReviewCard
              key={it.id}
              item={it}
              onSubmit={async (rating, title, body) => {
                await submit({ data: { productId: it.product_id!, rating, title: title || null, body: body || null, orderItemId: it.id } });
                toast.success("Submitted — pending moderation");
                qc.invalidateQueries({ queryKey: ["reviewable-items"] });
                qc.invalidateQueries({ queryKey: ["my-reviews"] });
              }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">My reviews</h2>
        {mine.isLoading && <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {!mine.isLoading && (mine.data ?? []).length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-5 text-sm text-muted-foreground">You haven't written any reviews yet.</div>
        )}
        <div className="space-y-3">
          {(mine.data ?? []).map((r: any) => {
            const prod = (r as any).products;
            return (
              <div key={r.id} className="rounded-2xl bg-card border border-border p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <Link to="/products/$slug" params={{ slug: prod?.slug ?? "" }} className="font-semibold hover:text-primary">{prod?.emoji} {prod?.title}</Link>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`} />)}</div>
                      {r.is_verified && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600"><ShieldCheck className="h-3 w-3" /> Verified</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${r.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>{r.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {editing === r.id ? (
                      <>
                        <button onClick={() => saveEdit(r.id)} className="p-1.5 rounded hover:bg-muted text-emerald-600" title="Save"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-muted" title="Cancel"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-muted" title="Edit"><Pencil className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {editing === r.id ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} type="button" onClick={() => setDraft((d) => ({ ...d, rating: s }))}>
                          <Star className={`h-5 w-5 ${s <= draft.rating ? "fill-accent text-accent" : "text-muted"}`} />
                        </button>
                      ))}
                    </div>
                    <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Title" />
                    <textarea value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Body" />
                  </div>
                ) : (
                  <>
                    {r.title && <div className="font-semibold mt-3">{r.title}</div>}
                    {r.body && <p className="text-sm text-muted-foreground mt-1">{r.body}</p>}
                    {r.admin_reply && <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm"><b className="text-xs">Store reply:</b> {r.admin_reply}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NewReviewCard({
  item,
  onSubmit,
}: {
  item: { id: string; product_id: string | null; product_name: string; product_slug: string };
  onSubmit: (rating: number, title: string, body: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  if (!item.product_id) return null;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try { await onSubmit(rating, title, body); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
      }}
      className="rounded-2xl bg-card border border-border p-4 space-y-2"
    >
      <div className="text-sm font-semibold">{item.product_name}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" onClick={() => setRating(s)}>
            <Star className={`h-5 w-5 ${s <= rating ? "fill-accent text-accent" : "text-muted"}`} />
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title (optional)" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} placeholder="Share your experience…" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
      <button disabled={busy} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit
      </button>
    </form>
  );
}
