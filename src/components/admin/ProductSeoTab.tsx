import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Search, Facebook, Twitter, CheckCircle2, XCircle } from "lucide-react";
import { productSeoGetFn, productSeoUpdateFn } from "@/lib/product-seo.functions";
import { productBlocksListFn } from "@/lib/product-blocks.functions";
import { computeSeoScore } from "@/lib/cms/product-seo";
import type { Product, ProductSeo } from "@/lib/catalog";

type Draft = Partial<ProductSeo> & { product_id: string };

const EMPTY: Omit<ProductSeo, never> = {
  meta_title: "", meta_description: "", focus_keyword: "",
  secondary_keywords: [], canonical_url: "", robots: "index,follow",
  og_title: "", og_description: "", og_image: "",
  twitter_title: "", twitter_description: "", twitter_image: "",
  schema_enabled: true, faq_schema_enabled: true,
  breadcrumb_schema_enabled: true, product_schema_enabled: true,
} as unknown as ProductSeo;

export function ProductSeoTab({ productId }: { productId: string }) {
  const get = useServerFn(productSeoGetFn);
  const update = useServerFn(productSeoUpdateFn);
  const blocksList = useServerFn(productBlocksListFn);
  const qc = useQueryClient();

  const { data: row, isLoading } = useQuery({
    queryKey: ["admin-product-seo", productId],
    queryFn: () => get({ data: { product_id: productId } }),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["admin-blocks", productId],
    queryFn: () => blocksList({ data: { product_id: productId } }),
  });

  const [draft, setDraft] = useState<Draft>({ product_id: productId });
  const [secondaryInput, setSecondaryInput] = useState("");

  useEffect(() => {
    if (!row) return;
    setDraft({
      product_id: productId,
      meta_title: row.meta_title ?? "",
      meta_description: row.meta_description ?? "",
      focus_keyword: row.focus_keyword ?? "",
      secondary_keywords: Array.isArray(row.secondary_keywords) ? row.secondary_keywords : [],
      canonical_url: row.canonical_url ?? "",
      robots: row.robots ?? "index,follow",
      og_title: row.og_title ?? "",
      og_description: row.og_description ?? "",
      og_image: row.og_image ?? "",
      twitter_title: row.twitter_title ?? "",
      twitter_description: row.twitter_description ?? "",
      twitter_image: row.twitter_image ?? "",
      schema_enabled: row.schema_enabled ?? true,
      faq_schema_enabled: row.faq_schema_enabled ?? true,
      breadcrumb_schema_enabled: row.breadcrumb_schema_enabled ?? true,
      product_schema_enabled: row.product_schema_enabled ?? true,
    });
    setSecondaryInput((Array.isArray(row.secondary_keywords) ? row.secondary_keywords : []).join(", "));
  }, [row, productId]);

  const save = useMutation({
    mutationFn: (d: Draft) => update({ data: {
      ...d,
      secondary_keywords: secondaryInput.split(",").map((s) => s.trim()).filter(Boolean),
      canonical_url: d.canonical_url || null,
      meta_title: d.meta_title || null,
      meta_description: d.meta_description || null,
      focus_keyword: d.focus_keyword || null,
      og_title: d.og_title || null,
      og_description: d.og_description || null,
      og_image: d.og_image || null,
      twitter_title: d.twitter_title || null,
      twitter_description: d.twitter_description || null,
      twitter_image: d.twitter_image || null,
    } as any }),
    onSuccess: () => {
      toast.success("SEO saved");
      qc.invalidateQueries({ queryKey: ["admin-product-seo", productId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (isLoading || !row) return <div className="p-4 text-muted-foreground">Loading…</div>;

  const productForScore: Product = {
    id: row.id, slug: row.slug, name: row.title,
    category: "", emoji: "📦", price: 0, rating: 0, reviews: 0,
    delivery: "", short: "",
    thumbnailUrl: null,
  } as Product;

  const seoForScore: ProductSeo = {
    ...EMPTY,
    ...draft,
  } as ProductSeo;

  const score = computeSeoScore(productForScore, seoForScore, {
    blocksCount: (blocks as any[]).length,
    imagesTotal: 1, imagesWithAltCount: 1,
  });

  const title = draft.meta_title || row.title;
  const desc = draft.meta_description || "";
  const url = draft.canonical_url || `${typeof window !== "undefined" ? window.location.origin : ""}/products/${row.slug}`;
  const ogImage = draft.og_image || "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <div>
              <Label>Meta Title <span className="text-xs text-muted-foreground">({(draft.meta_title ?? "").length}/60)</span></Label>
              <Input value={draft.meta_title ?? ""} onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })} />
            </div>
            <div>
              <Label>Meta Description <span className="text-xs text-muted-foreground">({(draft.meta_description ?? "").length}/160)</span></Label>
              <Textarea rows={3} value={draft.meta_description ?? ""} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} />
            </div>
            <div>
              <Label>Focus Keyword</Label>
              <Input value={draft.focus_keyword ?? ""} onChange={(e) => setDraft({ ...draft, focus_keyword: e.target.value })} placeholder="e.g. windows 11 pro key" />
            </div>
            <div>
              <Label>Secondary Keywords <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input value={secondaryInput} onChange={(e) => setSecondaryInput(e.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <div className="space-y-3">
              <div className="font-medium text-sm">Open Graph (Facebook, LinkedIn)</div>
              <Input placeholder="og:title" value={draft.og_title ?? ""} onChange={(e) => setDraft({ ...draft, og_title: e.target.value })} />
              <Textarea rows={2} placeholder="og:description" value={draft.og_description ?? ""} onChange={(e) => setDraft({ ...draft, og_description: e.target.value })} />
              <Input placeholder="og:image URL" value={draft.og_image ?? ""} onChange={(e) => setDraft({ ...draft, og_image: e.target.value })} />
            </div>
            <div className="space-y-3">
              <div className="font-medium text-sm">Twitter Card (summary_large_image)</div>
              <Input placeholder="twitter:title" value={draft.twitter_title ?? ""} onChange={(e) => setDraft({ ...draft, twitter_title: e.target.value })} />
              <Textarea rows={2} placeholder="twitter:description" value={draft.twitter_description ?? ""} onChange={(e) => setDraft({ ...draft, twitter_description: e.target.value })} />
              <Input placeholder="twitter:image URL" value={draft.twitter_image ?? ""} onChange={(e) => setDraft({ ...draft, twitter_image: e.target.value })} />
            </div>
          </TabsContent>

          <TabsContent value="schema" className="space-y-3">
            {[
              ["schema_enabled", "Enable JSON-LD structured data"],
              ["product_schema_enabled", "Product schema"],
              ["breadcrumb_schema_enabled", "Breadcrumb schema"],
              ["faq_schema_enabled", "FAQ schema (from FAQ blocks)"],
            ].map(([key, label]) => (
              <div key={key as string} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="text-sm">{label}</div>
                <Switch
                  checked={Boolean((draft as any)[key as string])}
                  onCheckedChange={(v) => setDraft({ ...draft, [key as string]: v })}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-3">
            <div>
              <Label>Canonical URL</Label>
              <Input value={draft.canonical_url ?? ""} onChange={(e) => setDraft({ ...draft, canonical_url: e.target.value })} placeholder="https://…/products/slug" />
            </div>
            <div>
              <Label>Robots</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={draft.robots ?? "index,follow"}
                onChange={(e) => setDraft({ ...draft, robots: e.target.value })}
              >
                <option value="index,follow">index, follow</option>
                <option value="noindex,follow">noindex, follow</option>
                <option value="index,nofollow">index, nofollow</option>
                <option value="noindex,nofollow">noindex, nofollow</option>
              </select>
            </div>
          </TabsContent>
        </Tabs>

        <div>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save SEO"}
          </Button>
        </div>

        {/* Previews */}
        <div className="space-y-3">
          <div className="p-4 border rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Search className="h-3 w-3" /> Google Preview</div>
            <div className="text-blue-700 text-lg truncate">{title}</div>
            <div className="text-green-700 text-xs truncate">{url}</div>
            <div className="text-sm text-muted-foreground line-clamp-2">{desc || "No description set."}</div>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Facebook className="h-3 w-3" /> Facebook Preview</div>
            {ogImage && <img src={ogImage} alt="" className="w-full h-40 object-cover rounded" />}
            <div className="text-xs uppercase text-muted-foreground">{new URL(url || "https://example.com").hostname}</div>
            <div className="font-semibold text-sm">{draft.og_title || title}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{draft.og_description || desc}</div>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Twitter className="h-3 w-3" /> Twitter Preview</div>
            {(draft.twitter_image || ogImage) && <img src={draft.twitter_image || ogImage} alt="" className="w-full h-40 object-cover rounded" />}
            <div className="font-semibold text-sm">{draft.twitter_title || draft.og_title || title}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{draft.twitter_description || draft.og_description || desc}</div>
          </div>
        </div>
      </div>

      {/* Score panel */}
      <div className="space-y-3">
        <div className="p-4 border rounded-lg text-center">
          <div className="text-xs text-muted-foreground uppercase">SEO Score</div>
          <div className={`text-5xl font-bold ${score.score >= 85 ? "text-green-600" : score.score >= 70 ? "text-blue-600" : score.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
            {score.score}
          </div>
          <div className="text-xs capitalize text-muted-foreground">{score.grade}</div>
        </div>
        <div className="border rounded-lg divide-y">
          {score.checks.map((c) => (
            <div key={c.id} className="p-2 text-sm flex items-start gap-2">
              {c.pass
                ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                : <XCircle className="h-4 w-4 text-muted-foreground mt-0.5" />}
              <div className="flex-1">
                <div>{c.label}</div>
                {c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
              </div>
              <div className="text-xs text-muted-foreground">{c.weight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
