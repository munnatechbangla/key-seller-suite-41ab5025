import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { useWishlist, useCart } from "@/lib/stores";
import { useProductsBySlugs } from "@/lib/catalog";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: `My Wishlist — ${siteName()}` }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const wish = useWishlist();
  const cart = useCart();
  const items = useProductsBySlugs(wish.slugs);

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="My Wishlist" subtitle={`${items.length} saved items`} crumbs={[{ label: "Home", to: "/" }, { label: "Wishlist" }]} />
      <div className="container mx-auto px-4 py-10">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-5">Save items you love to come back later.</p>
            <Link to="/products" className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Browse products</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {items.map((p) => p && (
                <div key={p.slug} className="relative">
                  <ProductCard product={p} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { cart.add(p); toast.success("Added to cart"); }} className="flex-1 text-xs py-2 rounded-lg bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-1">
                      <ShoppingCart className="h-3.5 w-3.5" /> Move to cart
                    </button>
                    <button onClick={() => wish.remove(p.slug)} className="px-2 py-2 rounded-lg border border-border hover:bg-muted">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => wish.clear()} className="mt-8 text-sm text-muted-foreground hover:text-destructive">Clear wishlist</button>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
