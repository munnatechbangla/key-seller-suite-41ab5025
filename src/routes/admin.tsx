import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/stores";
import { LayoutDashboard, Package, ShoppingBag, Users, KeyRound, Loader2, Ticket, Settings as SettingsIcon, Mail, FileText, CreditCard, Wallet, Star, ScrollText, Wand2, HeartPulse, Database, BookOpen, ClipboardCheck, History, LayoutTemplate, Sparkles, Image as ImageIcon, Boxes, TrendingDown, Repeat, Bell, FileCode, Newspaper, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Admin error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Admin section not found.</div>,
});

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/homepage", label: "Homepage Builder", icon: LayoutTemplate },
  { to: "/admin/cms", label: "CMS", icon: FileCode },
  { to: "/admin/marketplace", label: "Marketplace", icon: Sparkles },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/pages", label: "Pages", icon: FileText },
  { to: "/admin/categories", label: "Categories", icon: FileText },
  { to: "/admin/media", label: "Media Library", icon: ImageIcon },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/licenses", label: "Licenses", icon: KeyRound },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/inventory-dashboard", label: "Inventory Dashboard", icon: TrendingDown },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: Repeat },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/health", label: "Health Check", icon: HeartPulse },
  { to: "/admin/demo", label: "Demo Data", icon: Database },
  { to: "/admin/docs", label: "Documentation", icon: BookOpen },
  { to: "/admin/audit", label: "Audit Report", icon: ClipboardCheck },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: History },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/payment-logs", label: "Payments", icon: CreditCard },
  { to: "/admin/gateways", label: "Gateways", icon: Wallet },
  { to: "/admin/emails", label: "Email Logs", icon: Mail },
  { to: "/admin/email-templates", label: "Templates", icon: FileText },
  { to: "/admin/legal", label: "Legal Pages", icon: ScrollText },
  { to: "/admin/setup", label: "Setup Wizard", icon: Wand2 },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function AdminLayout() {
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const init = useAuth((s) => s.init);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Preserve the requested admin route so successful sign-in returns to the admin panel.
      navigate({ to: "/auth/login", search: { returnTo: pathname } });
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) {
        navigate({ to: "/" });
        return;
      }
      setIsAdmin(true);
      setChecking(false);
    })();
  }, [authLoading, user, navigate]);

  if (authLoading || checking || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-muted/20">
      <div className="md:hidden sticky top-0 z-40 w-full self-start border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Logo size="sm" />
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav aria-label="Mobile admin navigation" className="max-h-[72dvh] overflow-y-auto border-t p-2">
            {items.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to as any}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </Link>
              );
            })}
            <div className="my-2 border-t pt-2">
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Blog</p>
              {[
                { to: "/admin/blog/categories", label: "Blog Categories" },
                { to: "/admin/blog/tags", label: "Blog Tags" },
              ].map((item) => (
                <Link key={item.to} to={item.to as any} onClick={() => setMobileMenuOpen(false)} className="flex min-h-10 items-center rounded-md px-3 pl-10 text-sm text-foreground hover:bg-muted">
                  {item.label}
                </Link>
              ))}
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Pages</p>
              {[
                { to: "/admin/pages/about", label: "About" },
                { to: "/admin/pages/contact", label: "Contact" },
                { to: "/admin/pages/faq", label: "FAQ" },
                { to: "/admin/pages/support", label: "Support Center" },
                { to: "/admin/pages/track-order", label: "Track Order" },
                { to: "/admin/pages/privacy", label: "Privacy Policy" },
                { to: "/admin/pages/terms", label: "Terms & Conditions" },
                { to: "/admin/pages/refund", label: "Refund Policy" },
              ].map((item) => (
                <Link key={item.to} to={item.to as any} onClick={() => setMobileMenuOpen(false)} className="flex min-h-10 items-center rounded-md px-3 pl-10 text-sm text-foreground hover:bg-muted">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t px-3 py-3 text-xs text-muted-foreground">{user?.email}</div>
          </nav>
        )}
      </div>
      <aside className="w-60 border-r bg-background hidden md:flex flex-col">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            const isBlog = it.to === "/admin/blog";
            const blogOpen = isBlog && pathname.startsWith("/admin/blog");
            const isPages = it.to === "/admin/pages";
            const pagesOpen = isPages && pathname.startsWith("/admin/pages");
            return (
              <div key={it.to}>
                <Link
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </Link>
                {blogOpen && (
                  <div className="ml-7 mt-1 space-y-0.5 border-l pl-3">
                    {[
                      { to: "/admin/blog", label: "All Posts" },
                      { to: "/admin/blog/categories", label: "Categories" },
                      { to: "/admin/blog/tags", label: "Tags" },
                    ].map((s) => {
                      const sActive = pathname === s.to;
                      return (
                        <Link
                          key={s.to}
                          to={s.to}
                          className={cn(
                            "block px-2 py-1 rounded text-xs transition-colors",
                            sActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {s.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {pagesOpen && (
                  <div className="ml-7 mt-1 space-y-0.5 border-l pl-3">
                    {[
                      { to: "/admin/pages/about", label: "About" },
                      { to: "/admin/pages/contact", label: "Contact" },
                      { to: "/admin/pages/faq", label: "FAQ" },
                      { to: "/admin/pages/support", label: "Support Center" },
                      { to: "/admin/pages/track-order", label: "Track Order" },
                      { to: "/admin/pages/privacy", label: "Privacy Policy" },
                      { to: "/admin/pages/terms", label: "Terms & Conditions" },
                      { to: "/admin/pages/refund", label: "Refund Policy" },
                    ].map((s) => {
                      const sActive = pathname === s.to;
                      return (
                        <Link
                          key={s.to}
                          to={s.to as any}
                          params={{ slug: s.to.split("/").pop()! } as any}
                          className={cn(
                            "block px-2 py-1 rounded text-xs transition-colors",
                            sActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {s.label}
                        </Link>
                      );
                    })}
                    <Link
                      to="/admin/pages"
                      search={{ new: 1 } as any}
                      className="block px-2 py-1 rounded text-xs text-primary hover:underline"
                    >
                      + New Page
                    </Link>
                  </div>
                )}

              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t text-xs text-muted-foreground">{user?.email}</div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
