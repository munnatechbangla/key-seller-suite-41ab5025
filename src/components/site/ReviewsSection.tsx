// @ts-nocheck
import { useMemo, useState } from "react";
import { Star, ShieldCheck, Loader2 } from "lucide-react";
import { useApprovedReviews, computeBreakdown } from "@/lib/reviews";
import { useAuth } from "@/lib/stores";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getReviewableItemsFn, submitReviewFn } from "@/lib/reviews.functions";
import { toast } from "sonner";

function StarRow({ value, size = 4 }: { value: number; size?: number }) {
  return (
    <div className="flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`h-${size} w-${size} ${i < Math.round(value) ? "fill-accent text-accent" : "text-muted"}`} />
      ))}
    </div>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const reviews = useApprovedReviews(productId);
  const breakdown = useMemo(() => computeBreakdown(reviews), [reviews]);
  const user = useAuth((s) => s.user);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-8 max-w-4xl">
      <aside className="space-y-3">
        <div className="rounded-2xl bg-card border border-border p-5 text-center">
          <div className="text-4xl font-bold">{breakdown.average.toFixed(1)}</div>
          <div className="mt-1 flex justify-center"><StarRow value={breakdown.average} /></div>
          <div className="text-xs text-muted-foreground mt-1">{breakdown.total} review{breakdown.total === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const k = star as 1 | 2 | 3 | 4 | 5;
            const c = breakdown.counts[k];
            const pct = breakdown.total ? Math.round((c / breakdown.total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-6 font-semibold">{star}★</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{c}</span>
              </div>
            );
          })}
        </div>
        {user ? (
          <WriteReviewBox productId={productId} />
        ) : (
          <Link to="/auth/login" className="block text-center text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold">Sign in to write a review</Link>
        )}
      </aside>

      <div className="space-y-4">
        {reviews.length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-6 text-sm text-muted-foreground text-center">
            No reviews yet — be the first to share your experience.
          </div>
        )}
        {reviews.map((rv) => {
          const name = rv.display_name || "Verified Customer";
          return (
            <div key={rv.id} className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {rv.avatar_url ? (
                    <img src={rv.avatar_url} alt={name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold">{name[0]?.toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      <span className="truncate">{name}</span>
                      {rv.is_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                          <ShieldCheck className="h-3 w-3" /> Verified Purchase
                        </span>
                      )}
                    </div>
                    <StarRow value={rv.rating} size={3} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(rv.created_at).toLocaleDateString()}</span>
              </div>
              {rv.title && <div className="font-semibold mt-3">{rv.title}</div>}
              {rv.body && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{rv.body}</p>}
              {rv.admin_reply && (
                <div className="mt-4 rounded-xl bg-muted/50 border border-border p-3 text-sm">
                  <div className="font-semibold text-xs mb-1">Store reply</div>
                  <p className="text-muted-foreground whitespace-pre-line">{rv.admin_reply}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WriteReviewBox({ productId }: { productId: string }) {
  const submit = useServerFn(submitReviewFn);
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["reviewable-items"], queryFn: () => useServerFn(getReviewableItemsFn) }); // not used directly, see below
  const reviewable = useQuery({
    queryKey: ["reviewable-items", productId],
    queryFn: async () => {
      const list = await getReviewableItemsFn();
      return list.filter((i) => i.product_id === productId);
    },
  });
  void items;

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canReview = (reviewable.data ?? []).length > 0;
  const orderItemId = reviewable.data?.[0]?.id ?? null;

  if (reviewable.isLoading) {
    return <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!canReview) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        Only customers who purchased this product can leave a review.
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submit({ data: { productId, rating, title: title || null, body: body || null, orderItemId } });
      toast.success("Review submitted — pending moderation");
      setTitle(""); setBody(""); setRating(5);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["reviewable-items"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="text-sm font-semibold">Write a review</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button type="button" key={s} onClick={() => setRating(s)} aria-label={`${s} stars`}>
            <Star className={`h-6 w-6 ${s <= rating ? "fill-accent text-accent" : "text-muted"}`} />
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title (optional)" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={4} placeholder="Share your experience…" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
      <button type="submit" disabled={submitting} className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit Review
      </button>
    </form>
  );
}
