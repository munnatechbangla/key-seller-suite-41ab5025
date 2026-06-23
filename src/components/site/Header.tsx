import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, User, Search, Menu, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Announcement */}
      <div className="bg-gradient-primary text-primary-foreground text-xs sm:text-sm">
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center">
          <Zap className="h-3.5 w-3.5" />
          <span>Flash Sale — Up to <b>70% OFF</b> on premium digital products. Instant delivery 24/7.</span>
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 transition-smooth ${
          scrolled ? "glass shadow-elegant" : "bg-background/80 backdrop-blur-sm"
        }`}
      >
        <div className="container mx-auto px-4 py-3 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow group-hover:scale-105 transition-smooth">
              <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Topup<span className="text-gradient">Hut</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-smooth"
                activeProps={{ className: "text-primary bg-primary/10" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex flex-1 max-w-md ml-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search ChatGPT, Netflix, Canva…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-smooth"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto md:ml-0">
            <IconBtn label="Wishlist"><Heart className="h-5 w-5" /></IconBtn>
            <IconBtn label="Account"><User className="h-5 w-5" /></IconBtn>
            <IconBtn label="Cart" badge="3"><ShoppingCart className="h-5 w-5" /></IconBtn>
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
                  activeOptions={{ exact: n.to === "/" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

function IconBtn({ children, label, badge }: { children: React.ReactNode; label: string; badge?: string }) {
  return (
    <button
      aria-label={label}
      className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted transition-smooth"
    >
      {children}
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
          {badge}
        </span>
      )}
    </button>
  );
}
