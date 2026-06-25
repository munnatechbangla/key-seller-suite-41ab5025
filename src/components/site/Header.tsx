import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart, User, Search, Menu, X, GitCompare } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useWishlist, useCompare, useAuth } from "@/lib/stores";
import { primaryNav, announcementBar, resolveIcon } from "@/lib/cms";
import { useSettings } from "@/lib/cms/settings";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Logo } from "@/components/site/Logo";

const nav = primaryNav;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const cartCount = useCart((s) => s.count());
  const wishCount = useWishlist((s) => s.slugs.length);
  const cmpCount = useCompare((s) => s.slugs.length);
  const user = useAuth((s) => s.user);



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
      {announcementBar.enabled && (() => {
        const AnnouncementIcon = resolveIcon(announcementBar.icon);
        return (
          <div className="bg-gradient-primary text-primary-foreground text-xs sm:text-sm">
            <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center">
              <AnnouncementIcon className="h-3.5 w-3.5" />
              <span dangerouslySetInnerHTML={{ __html: announcementBar.html }} />
            </div>
          </div>
        );
      })()}

      <header className={`sticky top-0 z-50 transition-smooth ${scrolled ? "glass shadow-elegant" : "bg-background/80 backdrop-blur-sm"}`}>
        <div className="container mx-auto px-4 py-3 flex items-center gap-6">
          <Logo size="md" />


          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-smooth"
                activeProps={{ className: "text-primary bg-primary/10" }}
                activeOptions={{ exact: n.exact ?? false }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md ml-auto">
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

          <div className="flex items-center gap-1 ml-auto md:ml-0">
            <div className="hidden md:block mr-1"><ThemeToggle /></div>
            <IconLink to="/compare" label="Compare" badge={cmpCount}><GitCompare className="h-5 w-5" /></IconLink>
            <IconLink to="/wishlist" label="Wishlist" badge={wishCount}><Heart className="h-5 w-5" /></IconLink>
            <IconLink to={user ? "/account" : "/auth/login"} label="Account"><User className="h-5 w-5" /></IconLink>
            <IconLink to="/cart" label="Cart" badge={cartCount}><ShoppingCart className="h-5 w-5" /></IconLink>
            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth"
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
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted"
                  activeProps={{ className: "text-primary bg-primary/10" }}
                  activeOptions={{ exact: n.exact ?? false }}
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
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

function IconLink({ children, label, badge, to }: { children: React.ReactNode; label: string; badge?: number; to: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth"
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
