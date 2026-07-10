import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart, User, Search, Menu, X, GitCompare } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useWishlist, useCompare, useAuth } from "@/lib/stores";
import { useHomepage } from "@/lib/cms/homepage";
import { AnnouncementBar } from "@/components/site/AnnouncementBar";

import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Logo } from "@/components/site/Logo";
import { MiniCart } from "@/components/site/MiniCart";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const cartCount = useCart((s) => s.count());
  const wishCount = useWishlist((s) => s.slugs.length);
  const cmpCount = useCompare((s) => s.slugs.length);
  const user = useAuth((s) => s.user);
  const nav = useHomepage((s) => s.config.headerNav.items.filter((i) => i.enabled));



  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
  };

  return (
    <>
      <AnnouncementBar />


      <header className={`sticky top-0 z-50 transition-smooth ${scrolled ? "glass shadow-elegant" : "bg-background/80 backdrop-blur-sm"}`}>
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0">
          <div className="shrink-0"><Logo size="md" /></div>

          <nav className="hidden lg:flex items-center gap-1 ml-4 min-w-0">
            {nav.map((n) => (
              <Link
                key={n.id}
                to={n.url as string}
                className="px-3 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-smooth"
                activeProps={{ className: "text-primary bg-primary/10" }}
                activeOptions={{ exact: n.exact ?? n.url === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md ml-auto min-w-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="Search ChatGPT, Netflix, Canva…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-smooth"
              />
            </div>
          </form>

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto md:ml-0 shrink-0">
            <div className="hidden md:block mr-1"><ThemeToggle /></div>
            <IconLink to="/compare" label="Compare" badge={cmpCount} className="hidden sm:grid"><GitCompare className="h-5 w-5" /></IconLink>
            <IconLink to="/wishlist" label="Wishlist" badge={wishCount} className="hidden sm:grid"><Heart className="h-5 w-5" /></IconLink>
            <IconLink to={user ? "/account" : "/auth/login"} label="Account"><User className="h-5 w-5" /></IconLink>
            <button
              type="button"
              onClick={() => setMiniCartOpen(true)}
              aria-label="Cart"
              className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth shrink-0"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount ? (
                <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth shrink-0"
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-border bg-card">
            <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <Link
                  key={n.id}
                  to={n.url as string}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted"
                  activeProps={{ className: "text-primary bg-primary/10" }}
                  activeOptions={{ exact: n.exact ?? n.url === "/" }}
                >
                  {n.label}
                </Link>
              ))}
              <form onSubmit={submitSearch} className="pt-2 md:hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    type="search"
                    placeholder="Search products…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border outline-none text-sm"
                  />
                </div>
              </form>
              <div className="flex sm:hidden items-center gap-2 pt-2">
                <Link to="/compare" onClick={() => setOpen(false)} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2">
                  <GitCompare className="h-4 w-4" /> Compare {cmpCount ? `(${cmpCount})` : ""}
                </Link>
                <Link to="/wishlist" onClick={() => setOpen(false)} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Wishlist {wishCount ? `(${wishCount})` : ""}
                </Link>
              </div>
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
                <span className="text-xs font-medium text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </header>
      <MiniCart open={miniCartOpen} onOpenChange={setMiniCartOpen} />
    </>
  );
}

function IconLink({ children, label, badge, to, className }: { children: React.ReactNode; label: string; badge?: number; to: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth shrink-0 ${className ?? ""}`}
    >
      {children}
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
