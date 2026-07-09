import type { ProductSectionCommonStyle } from "@/lib/cms/product-section-types";
import { cn } from "@/lib/utils";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { ProductCard } from "@/components/site/ProductCard";
import { Breadcrumbs } from "@/components/site/PageHero";
import { useCart, useRecent } from "@/lib/stores";
import { useProductsBySlugs, relatedQuery } from "@/lib/catalog";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Star, ShieldCheck, Truck, Lock, ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export type ProductLayoutSection = {
  id: string;
  section_key: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  json_content: any;
  sort_order: number;
  enabled: boolean;
};

function wrapperStyle(style?: ProductSectionCommonStyle): React.CSSProperties {
  if (!style) return {};
  return {
    backgroundColor: style.background_color || undefined,
    backgroundImage: style.background_image ? `url(${style.background_image})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    padding: style.padding || undefined,
    margin: style.margin || undefined,
  };
}

function containerClass(w?: ProductSectionCommonStyle["container_width"]) {
  switch (w) {
    case "sm": return "max-w-3xl mx-auto px-4";
    case "md": return "max-w-5xl mx-auto px-4";
    case "lg": return "max-w-6xl mx-auto px-4";
    case "xl": return "max-w-7xl mx-auto px-4";
    case "full": return "w-full px-4";
    default: return "container mx-auto px-4";
  }
}

function visibilityClass(v?: ProductSectionCommonStyle["visibility"]) {
  if (!v) return "";
  const cls: string[] = [];
  if (v.desktop === false) cls.push("lg:hidden");
  if (v.tablet === false) cls.push("hidden md:max-lg:hidden");
  if (v.mobile === false) cls.push("max-md:hidden");
  return cls.join(" ");
}

function SectionWrap({ style, children }: { style?: ProductSectionCommonStyle; children: React.ReactNode }) {
  return (
    <section
      className={cn("py-6", visibilityClass(style?.visibility), style?.custom_class)}
      style={wrapperStyle(style)}
    >
      <div className={containerClass(style?.container_width)}>{children}</div>
    </section>
  );
}

export function ProductLayoutRenderer({ product, sections }: { product: any; sections: ProductLayoutSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <RenderProductSection key={s.id} section={s} product={product} />
      ))}
    </>
  );
}

function RenderProductSection({ section, product }: { section: ProductLayoutSection; product: any }) {
  const c = section.json_content ?? {};
  const style: ProductSectionCommonStyle = c.style ?? {};

  switch (section.section_type) {
    case "breadcrumb":
      return (
        <SectionWrap style={style}>
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Products", to: "/products" }, { label: product.name }]} />
        </SectionWrap>
      );

    case "gallery":
      return (
        <SectionWrap style={style}>
          <div className="grid md:grid-cols-2 gap-6">
            <img src={product.thumbnailUrl || product.image} alt={product.name} className="w-full rounded-xl object-cover" />
            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              {product.short && <p className="text-muted-foreground mt-2">{product.short}</p>}
            </div>
          </div>
        </SectionWrap>
      );

    case "title":
      return (
        <SectionWrap style={style}>
          <h1 className="text-3xl md:text-4xl font-bold">{product.name}</h1>
          {c.show_rating && product.rating > 0 && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold">{product.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({product.reviews ?? 0} reviews)</span>
            </div>
          )}
        </SectionWrap>
      );

    case "price":
      return (
        <SectionWrap style={style}>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">${product.price.toFixed(2)}</span>
            {c.show_old_price && product.oldPrice && (
              <>
                <span className="text-muted-foreground line-through">${product.oldPrice.toFixed(2)}</span>
                <span className="text-sm font-semibold text-green-600">
                  {Math.round((1 - product.price / product.oldPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>
        </SectionWrap>
      );

    case "purchase_card":
      return <SectionWrap style={style}><PurchaseCard product={product} config={c} /></SectionWrap>;

    case "stock_status": {
      const inStock = (product.stock ?? 1) > 0;
      return (
        <SectionWrap style={style}>
          <span className={cn("inline-flex items-center gap-1 text-sm font-medium", inStock ? "text-green-600" : "text-red-600")}>
            <Check className="h-4 w-4" /> {inStock ? "In stock" : "Out of stock"}
          </span>
        </SectionWrap>
      );
    }

    case "delivery_info":
      return (
        <SectionWrap style={style}>
          <div className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4" /> {c.text ?? "Instant delivery"}</div>
        </SectionWrap>
      );

    case "description":
      return (
        <SectionWrap style={style}>
          {section.title && <h2 className="text-2xl font-bold mb-3">{section.title}</h2>}
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: product.description ?? product.short ?? "" }} />
        </SectionWrap>
      );

    case "highlights":
    case "whats_included":
    case "requirements":
    case "compatibility":
    case "features": {
      const items: string[] = c.items ?? [];
      return (
        <SectionWrap style={style}>
          {section.title && <h2 className="text-2xl font-bold mb-3">{section.title}</h2>}
          <ul className="grid md:grid-cols-2 gap-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2"><Check className="h-4 w-4 mt-1 text-primary shrink-0" /><span>{it}</span></li>
            ))}
          </ul>
        </SectionWrap>
      );
    }

    case "specifications": {
      const items: Array<{ label: string; value: string }> = c.items ?? [];
      return (
        <SectionWrap style={style}>
          {section.title && <h2 className="text-2xl font-bold mb-3">{section.title}</h2>}
          <dl className="divide-y border rounded-md">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 p-3">
                <dt className="font-medium">{it.label}</dt>
                <dd className="text-muted-foreground">{it.value}</dd>
              </div>
            ))}
          </dl>
        </SectionWrap>
      );
    }

    case "faq": {
      const items: Array<{ q: string; a: string }> = c.items ?? product.faqs ?? [];
      return (
        <SectionWrap style={style}>
          {section.title && <h2 className="text-2xl font-bold mb-3">{section.title}</h2>}
          <div className="space-y-2">
            {items.map((f, i) => (
              <details key={i} className="border rounded-md p-3"><summary className="font-medium cursor-pointer">{f.q}</summary><p className="mt-2 text-muted-foreground">{f.a}</p></details>
            ))}
          </div>
        </SectionWrap>
      );
    }

    case "reviews":
      return (
        <SectionWrap style={style}>
          {section.title && <h2 className="text-2xl font-bold mb-3">{section.title}</h2>}
          <ReviewsSection productId={product.id} />
        </SectionWrap>
      );

    case "related_products":
      return <SectionWrap style={style}><RelatedProductsBlock slug={product.slug} title={section.title} limit={c.limit ?? 4} /></SectionWrap>;

    case "recently_viewed":
      return <SectionWrap style={style}><RecentlyViewedBlock currentSlug={product.slug} title={section.title} limit={c.limit ?? 4} /></SectionWrap>;

    case "support_card":
      return (
        <SectionWrap style={style}>
          <div className="border rounded-lg p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div><div className="font-semibold">{c.title ?? "Need help?"}</div><div className="text-sm text-muted-foreground">{c.text ?? "We're here for you."}</div></div>
          </div>
        </SectionWrap>
      );

    case "trust_badges": {
      const items: string[] = c.items ?? [];
      return (
        <SectionWrap style={style}>
          <div className="flex flex-wrap gap-4 justify-center">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />{it}</div>
            ))}
          </div>
        </SectionWrap>
      );
    }

    case "cta":
      return (
        <SectionWrap style={style}>
          <div className="rounded-lg border p-8 text-center">
            <h3 className="text-2xl font-bold">{c.title ?? section.title}</h3>
            {c.button?.label && <a href={c.button.href || "#"}><Button className="mt-4">{c.button.label}</Button></a>}
          </div>
        </SectionWrap>
      );

    case "custom_html":
      return <SectionWrap style={style}><div dangerouslySetInnerHTML={{ __html: c.html ?? "" }} /></SectionWrap>;

    case "spacer":
      return <div style={{ height: c.height ?? 48 }} />;

    case "divider":
      return <hr style={{ borderTopWidth: c.thickness ?? 1, borderColor: c.color || undefined }} className="my-6" />;

    default:
      return null;
  }
}

function PurchaseCard({ product, config }: { product: any; config: any }) {
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const addToCart = () => { cart.add(product, qty); toast.success(`${product.name} added to cart`); };
  const buyNow = () => { cart.add(product, qty); window.location.href = "/checkout"; };
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setQty(Math.max(1, qty - 1))}>−</Button>
        <span className="w-10 text-center font-semibold">{qty}</span>
        <Button variant="outline" size="sm" onClick={() => setQty(qty + 1)}>+</Button>
      </div>
      <Button className="w-full" onClick={buyNow}>Buy now</Button>
      <Button variant="outline" className="w-full" onClick={addToCart}><ShoppingCart className="h-4 w-4 mr-1" /> Add to cart</Button>
    </div>
  );
}

function RelatedProductsBlock({ slug, title, limit }: { slug: string; title: string | null; limit: number }) {
  const items = useQuery(relatedQuery(slug, limit)).data ?? [];
  if (!items.length) return null;
  return (
    <>
      <h2 className="text-2xl font-bold mb-4">{title ?? "Related products"}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((p: any) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </>
  );
}

function RecentlyViewedBlock({ currentSlug, title, limit }: { currentSlug: string; title: string | null; limit: number }) {
  const recent = useRecent((s) => s.slugs).filter((s) => s !== currentSlug).slice(0, limit);
  const items = useProductsBySlugs(recent);
  if (!items?.length) return null;
  return (
    <>
      <h2 className="text-2xl font-bold mb-4">{title ?? "Recently viewed"}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((p: any) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </>
  );
}
