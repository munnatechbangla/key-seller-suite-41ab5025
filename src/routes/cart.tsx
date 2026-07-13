import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { useCart } from "@/lib/stores";
import { useCheckoutFields } from "@/components/checkout/CheckoutCustomFields";
import { resolveLineImage } from "@/lib/cart-image";
import { useFeatured, featuredQuery } from "@/lib/catalog";
import { validateCouponFn } from "@/lib/coupons.functions";
import { Trash2, Tag, ShoppingBag, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: `Shopping Cart — ${siteName()}` }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(featuredQuery()); },
  component: CartPage,
  errorComponent: () => <div className="p-8 text-center">Cart unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function CartPage() {
  const cart = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const validate = useServerFn(validateCouponFn);
  const crossSell = useFeatured().slice(0, 4);
  const cartSlugs = cart.items.map((i) => i.productSlug ?? i.slug);
  const fieldsQuery = useCheckoutFields(cartSlugs);
  const allFields = fieldsQuery.data ?? [];

  const apply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const r = await validate({
        data: { code: code.trim(), subtotal: cart.subtotal(), productSlugs: cart.items.map((i) => i.productSlug ?? i.slug) },
      });
      if (r.ok) {
        cart.setCoupon(r.code, r.discount);
        toast.success(`Saved $${r.discount.toFixed(2)}`);
        setCode("");
      } else {
        cart.clearCoupon();
        toast.error(couponReason(r.reason, r));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply coupon");
    } finally {
      setApplying(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <PageHero title="Your cart" crumbs={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="h-24 w-24 mx-auto rounded-3xl bg-muted grid place-items-center mb-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">Discover thousands of premium digital products.</p>
          <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            Browse products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Your cart" subtitle={`${cart.count()} items`} crumbs={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <div className="container mx-auto px-4 py-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <div className="min-w-0 space-y-3">
          {cart.items.map((it) => {
            const productSlug = it.productSlug ?? it.slug;
            const unit = it.variant
              ? (it.variant.sale_price != null && it.variant.sale_price > 0 ? it.variant.sale_price : it.variant.price)
              : it.product.price;
            return (
            <div key={it.slug} className="rounded-2xl bg-card border border-border p-3 sm:p-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 sm:gap-4 items-center">
              <Link to="/products/$slug" params={{ slug: productSlug }} className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 grid place-items-center overflow-hidden">
                {(() => {
                  const img = resolveLineImage(it.product, it.variant);
                  return img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl">{it.product.emoji}</span>
                  );
                })()}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to="/products/$slug" params={{ slug: productSlug }} className="font-semibold hover:text-primary line-clamp-1">{it.product.name}</Link>
                {it.variant && (
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground/80">{it.variant.variant_name}</span>
                    {it.variant.sku && <span>SKU: {it.variant.sku}</span>}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{it.variant?.delivery_type ?? it.product.delivery} delivery</div>
                {(() => {
                  const stored = (cart.productFieldValues ?? {})[productSlug] ?? {};
                  const rows = allFields
                    .filter((f) => f.product_slug === productSlug && (stored[f.id] ?? "").trim() !== "")
                    .map((f) => ({ label: f.label, value: f.field_type === "password" ? "••••••••" : stored[f.id] }));
                  if (rows.length === 0) return null;
                  return (
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {rows.map((r) => (
                        <div key={r.label} className="truncate"><span className="font-medium text-foreground/80">{r.label}:</span> {r.value}</div>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-3 mt-2">
                  <div className="inline-flex items-center rounded-lg border border-border">
                    <button onClick={() => cart.setQty(it.slug, it.qty - 1)} className="w-8 h-8 grid place-items-center hover:bg-muted">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{it.qty}</span>
                    <button onClick={() => cart.setQty(it.slug, it.qty + 1)} className="w-8 h-8 grid place-items-center hover:bg-muted">+</button>
                  </div>
                  <button onClick={() => { cart.remove(it.slug); toast("Removed"); }} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-primary">${(unit * it.qty).toFixed(2)}</div>
                {!it.variant && it.product.oldPrice && <div className="text-xs text-muted-foreground line-through">${(it.product.oldPrice * it.qty).toFixed(2)}</div>}
              </div>

            </div>
            );
          })}

          <div className="pt-6">
            <h3 className="text-lg font-bold mb-4">You may also like</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {crossSell.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="font-bold text-lg">Order summary</h3>
            <Row label="Subtotal" value={`$${cart.subtotal().toFixed(2)}`} />
            {cart.coupon && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground inline-flex items-center gap-1">Coupon ({cart.coupon})
                  <button onClick={() => cart.clearCoupon()} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
                <span className="text-accent font-semibold">-${cart.discount().toFixed(2)}</span>
              </div>
            )}
            <Row label="Delivery" value="Free" />
            <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${cart.total().toFixed(2)}</span>
            </div>
            <Link to="/checkout" className="block text-center w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">
              Proceed to checkout
            </Link>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="font-semibold flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Have a coupon?</div>
            <div className="flex min-w-0 gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TOPUP10" className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm outline-none focus:border-primary" />
              <button
                onClick={apply}
                disabled={applying}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >{applying ? "..." : "Apply"}</button>
            </div>
            <p className="text-xs text-muted-foreground">Enter your coupon code at checkout to save.</p>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-accent font-semibold" : "font-semibold"}>{value}</span>
    </div>
  );
}

export function couponReason(reason: string, extra?: { min?: number }): string {
  switch (reason) {
    case "not_found": return "Coupon not found";
    case "inactive": return "Coupon disabled";
    case "not_started": return "Coupon not yet active";
    case "expired": return "Coupon expired";
    case "limit_reached": return "Coupon usage limit reached";
    case "user_limit": return "You've already used this coupon";
    case "min_order": return `Minimum order $${(extra?.min ?? 0).toFixed(2)} required`;
    case "not_first_order": return "Only valid on your first order";
    case "no_matching_products": return "Not valid for items in your cart";
    default: return reason || "Invalid coupon";
  }
}
