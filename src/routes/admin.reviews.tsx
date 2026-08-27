// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adminListReviewsFn,
  adminSetReviewStatusFn,
  adminReplyReviewFn,
  adminDeleteReviewFn,
} from "@/lib/reviews.functions";
import { Loader2, Star, ShieldCheck, Trash2, Check, X, Reply } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reviews")({ component: AdminReviewsPage });

type StatusFilter = "all" | "pending" | "approved" | "rejected";

function AdminReviewsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListReviewsFn);
  const setStatus = useServerFn(adminSetReviewStatusFn);
  const reply = useServerFn(adminReplyReviewFn);
  const del = useServerFn(adminDeleteReviewFn);

  const [status, setStatusF] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", status, search],
    queryFn: () => list({ data: { status, search, limit: 200 } }),
  });

  const rows = data ?? [];
  const allChecked = useMemo(() => rows.length > 0 && rows.every((r) => selected.has(r.id)), [rows, selected]);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }
  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    setSelected(new Set());
  }

  async function bulk(target: "approved" | "rejected") {
    if (selected.size === 0) return;
    await setStatus({ data: { ids: Array.from(selected), status: target } });
    toast.success(`${selected.size} review(s) ${target}`);
    refresh();
  }

  async function single(id: string, target: "approved" | "rejected") {
    await setStatus({ data: { ids: [id], status: target } });
    toast.success(`Review ${target}`);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    refresh();
  }

  async function replyTo(id: string, current: string | null) {
    const text = prompt("Reply to this review (leave blank to clear):", current ?? "");
    if (text === null) return;
    await reply({ data: { id, reply: text } });
    toast.success("Reply saved");
    refresh();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">Moderate customer reviews. Approved reviews appear on product pages and feed the rating engine.</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusF(s); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-md text-sm capitalize border ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title / body…"
          className="ml-auto px-3 py-1.5 rounded-md text-sm border border-border bg-background min-w-[200px]"
        />
        <button onClick={() => bulk("approved")} disabled={selected.size === 0} className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 text-white disabled:opacity-50 inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Approve ({selected.size})</button>
        <button onClick={() => bulk("rejected")} disabled={selected.size === 0} className="px-3 py-1.5 rounded-md text-sm bg-destructive text-destructive-foreground disabled:opacity-50 inline-flex items-center gap-1.5"><X className="h-4 w-4" /> Reject ({selected.size})</button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading reviews…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No reviews match this filter.</td></tr>
            )}
            {rows.map((r) => {
              const prod = (r as unknown as { products?: { title?: string; slug?: string } }).products;
              const prof = (r as unknown as { profiles?: { full_name?: string; email?: string } }).profiles;
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-3 py-3 max-w-md">
                    <div className="flex items-center gap-2">
                      {[...Array(5)].map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`} />)}
                      {r.is_verified && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600"><ShieldCheck className="h-3 w-3" />Verified</span>}
                    </div>
                    {r.title && <div className="font-semibold mt-1">{r.title}</div>}
                    {r.body && <div className="text-muted-foreground text-xs mt-1 line-clamp-3">{r.body}</div>}
                    {r.admin_reply && <div className="mt-2 text-xs bg-muted/40 rounded p-2"><b>Reply:</b> {r.admin_reply}</div>}
                  </td>
                  <td className="px-3 py-3">{prod?.title ?? "—"}</td>
                  <td className="px-3 py-3 text-xs">{prof?.full_name ?? prof?.email ?? r.display_name ?? "—"}</td>
                  <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${r.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {r.status !== "approved" && <button onClick={() => single(r.id, "approved")} className="p-1.5 rounded hover:bg-muted text-emerald-600" title="Approve"><Check className="h-4 w-4" /></button>}
                    {r.status !== "rejected" && <button onClick={() => single(r.id, "rejected")} className="p-1.5 rounded hover:bg-muted text-amber-600" title="Reject"><X className="h-4 w-4" /></button>}
                    <button onClick={() => replyTo(r.id, r.admin_reply)} className="p-1.5 rounded hover:bg-muted" title="Reply"><Reply className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
