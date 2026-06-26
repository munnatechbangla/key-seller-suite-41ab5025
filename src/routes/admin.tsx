import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/stores";
import { LayoutDashboard, Package, ShoppingBag, Users, KeyRound, Loader2, Ticket, Settings as SettingsIcon, Mail, FileText, CreditCard, Wallet, Star, ScrollText, Wand2, HeartPulse, Database, BookOpen, ClipboardCheck, History, LayoutTemplate } from "lucide-react";
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
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/licenses", label: "Licenses", icon: KeyRound },
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
  

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth/login" });
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
    <div className="min-h-screen flex w-full bg-muted/20">
      <aside className="w-60 border-r bg-background hidden md:flex flex-col">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
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
