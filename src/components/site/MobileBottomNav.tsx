import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Grid3x3, ShoppingCart, Heart, User } from "lucide-react";
import { useCart, useWishlist, useAuth } from "@/lib/stores";

const items = [
  { to: "/", label: "Home", Icon: Home, exact: true },
  { to: "/categories", label: "Browse", Icon: Grid3x3 },
  { to: "/cart", label: "Cart", Icon: ShoppingCart, badge: "cart" as const },
  { to: "/wishlist", label: "Saved", Icon: Heart, badge: "wish" as const },
  { to: "/account", label: "Me", Icon: User, auth: true },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useCart((s) => s.count());
  const wishCount = useWishlist((s) => s.slugs.length);
  const user = useAuth((s) => s.user);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const badge = it.badge === "cart" ? cartCount : it.badge === "wish" ? wishCount : 0;
          const to = it.auth && !user ? "/auth/login" : it.to;
          return (
            <li key={it.label}>
              <Link
                to={to}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-smooth ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <it.Icon className="h-5 w-5" />
                {it.label}
                {badge ? (
                  <span className="absolute top-1 right-[28%] h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-bold grid place-items-center">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
