import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { useCart } from "@/lib/stores";
import { useFeatured, featuredQuery } from "@/lib/catalog";
import { Trash2, Tag, ShoppingBag, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Shopping Cart — TopupHut" }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(featuredQuery()); },
  component: CartPage,
  errorComponent: () => <div className="p-8 text-center">Cart unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function CartPage() {
  const cart = useCart();
  const [code, setCode] = useState("");
  const crossSell = useFeatured().slice(0, 4);

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
      <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-3">
          {cart.items.map((it) => (
            <div key={it.slug} className="rounded-2xl bg-card border border-border p-4 flex gap-4 items-center">
              <Link to="/products/$slug" params={{ slug: it.slug }} className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 grid place-items-center text-4xl">
                {it.product.emoji}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to="/products/$slug" params={{ slug: it.slug }} className="font-semibold hover:text-primary line-clamp-1">{it.product.name}</Link>
                <div className="text-xs text-muted-foreground mt-1">{it.product.delivery} delivery</div>
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
              <div className="text-right">
                <div className="font-bold text-primary">${(it.product.price * it.qty).toFixed(2)}</div>
                {it.product.oldPrice && <div className="text-xs text-muted-foreground line-through">${(it.product.oldPrice * it.qty).toFixed(2)}</div>}
              </div>
            </div>
          ))}

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
            {cart.coupon && <Row label={`Coupon (${cart.coupon})`} value={`-$${cart.discount().toFixed(2)}`} accent />}
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
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TOPUP10" className="flex-1 px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm outline-none focus:border-primary" />
              <button
                onClick={() => { const ok = cart.applyCoupon(code); ok ? toast.success("Coupon applied!") : toast.error("Invalid coupon"); }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
              >Apply</button>
            </div>
            <p className="text-xs text-muted-foreground">Try: TOPUP10, WELCOME15, FLASH25</p>
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
