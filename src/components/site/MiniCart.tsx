import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useCart } from "@/lib/stores";
import { Trash2, ShoppingBag, ArrowRight, Tag } from "lucide-react";

export function MiniCart({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const cart = useCart();
  const close = () => onOpenChange(false);

  // ESC handled by Sheet; outside click handled by Sheet overlay.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex min-w-0 items-center gap-2 text-base pr-8">
            <ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">Your Cart ({cart.count()})</span>
          </SheetTitle>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-muted grid place-items-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold">Your cart is empty</div>
              <p className="text-sm text-muted-foreground mt-1">Add a few products to get started.</p>
            </div>
            <Link
              to="/products"
              onClick={close}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow"
            >
              Browse products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {cart.items.map((it) => (
                <div key={it.slug} className="flex min-w-0 gap-3 p-3 rounded-xl border border-border bg-card">
                  <Link
                    to="/products/$slug"
                    params={{ slug: it.slug }}
                    onClick={close}
                    className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 grid place-items-center text-2xl overflow-hidden"
                  >
                    {it.product.thumbnailUrl ? (
                      <img src={it.product.thumbnailUrl} alt={it.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{it.product.emoji}</span>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/products/$slug"
                      params={{ slug: it.slug }}
                      onClick={close}
                      className="font-semibold text-sm line-clamp-1 hover:text-primary"
                    >
                      {it.product.name}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">{it.product.delivery}</div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center rounded-lg border border-border">
                        <button
                          onClick={() => cart.setQty(it.slug, it.qty - 1)}
                          className="w-7 h-7 grid place-items-center hover:bg-muted text-sm"
                          aria-label="Decrease"
                        >−</button>
                        <span className="w-7 text-center text-sm font-semibold">{it.qty}</span>
                        <button
                          onClick={() => cart.setQty(it.slug, it.qty + 1)}
                          className="w-7 h-7 grid place-items-center hover:bg-muted text-sm"
                          aria-label="Increase"
                        >+</button>
                      </div>
                    <div className="shrink-0 text-sm font-bold text-primary">
                        ${(it.product.price * it.qty).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => cart.remove(it.slug)}
                    className="text-muted-foreground hover:text-destructive p-1 h-fit"
                    aria-label={`Remove ${it.product.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 border-t border-border px-5 py-4 sm:flex-col sm:space-x-0">
              <div className="w-full space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${cart.subtotal().toFixed(2)}</span>
                </div>
                {cart.coupon && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {cart.coupon}</span>
                    <span>−${cart.discount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                  <span>Estimated total</span>
                  <span className="text-primary">${cart.total().toFixed(2)}</span>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 w-full">
                <Link
                  to="/cart"
                  onClick={close}
                  className="h-11 grid place-items-center rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                >
                  View Cart
                </Link>
                <Link
                  to="/checkout"
                  onClick={close}
                  className="h-11 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow"
                >
                  Checkout
                </Link>
              </div>
              <button
                onClick={close}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
              >
                Continue shopping
              </button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
