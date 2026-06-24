import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useAuth, useWishlist } from "@/lib/stores";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingBag, Download, Heart, Bell, Settings,
  MapPin, LifeBuoy, KeyRound, LogOut, Package, DollarSign, CheckCircle2, TrendingUp, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useProductsBySlugs, featuredQuery } from "@/lib/catalog";
import { getMyOrdersFn, getMyDownloadsFn, getMyLicensesFn } from "@/lib/orders.functions";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account — TopupHut" }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(featuredQuery()); },
  component: AccountPage,
  errorComponent: () => <div className="p-8 text-center">Account unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

const tabs = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "orders", label: "Orders", Icon: ShoppingBag },
  { id: "downloads", label: "Downloads", Icon: Download },
  { id: "wishlist", label: "Wishlist", Icon: Heart },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "profile", label: "Profile", Icon: Settings },
  { id: "addresses", label: "Addresses", Icon: MapPin },
  { id: "support", label: "Support tickets", Icon: LifeBuoy },
  { id: "password", label: "Change password", Icon: KeyRound },
] as const;

type Tab = typeof tabs[number]["id"];

function AccountPage() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [active, setActive] = useState<Tab>("dashboard");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth/login" }); }, [user, loading, navigate]);
  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={`Hi, ${user.name} 👋`} subtitle="Manage your orders, downloads and profile" crumbs={[{ label: "Home", to: "/" }, { label: "Account" }]} />
      <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="lg:sticky lg:top-24 self-start space-y-2">
          <div className="rounded-2xl bg-card border border-border p-5 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold text-xl">{user.name[0].toUpperCase()}</div>
            <div className="font-bold mt-3">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <nav className="rounded-2xl bg-card border border-border p-2">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${active === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                <t.Icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
            <button onClick={() => { logout(); toast("Signed out"); navigate({ to: "/" }); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </aside>

        <section>
          {active === "dashboard" && <DashboardTab user={user} />}
          {active === "orders" && <OrdersTab />}
          {active === "downloads" && <DownloadsTab />}
          {active === "wishlist" && <WishlistTab />}
          {active === "notifications" && <NotificationsTab />}
          {active === "profile" && <ProfileTab user={user} />}
          {active === "addresses" && <AddressesTab />}
          {active === "support" && <SupportTab />}
          {active === "password" && <PasswordTab />}
        </section>
      </div>
      <Footer />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-card border border-border p-5 ${className}`}>{children}</div>;
}

function DashboardTab({ user }: { user: { name: string; email: string } }) {
  const stats = [
    { label: "Total orders", value: "12", Icon: Package, color: "text-primary bg-primary/10" },
    { label: "Total spent", value: "$248", Icon: DollarSign, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Active subs", value: "5", Icon: CheckCircle2, color: "text-accent bg-accent/10" },
    { label: "Loyalty pts", value: "1,240", Icon: TrendingUp, color: "text-secondary bg-secondary/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className={`h-10 w-10 rounded-xl ${s.color} grid place-items-center mb-3`}><s.Icon className="h-5 w-5" /></div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>
      <Card>
        <h3 className="font-bold mb-4">Recent orders</h3>
        <OrdersList limit={3} />
      </Card>
    </div>
  );
}

const sampleOrders = [
  { id: "TH-A1B2C", date: "Jun 20, 2026", items: 2, total: 17.98, status: "Delivered" },
  { id: "TH-X7Y2K", date: "Jun 12, 2026", items: 1, total: 39.99, status: "Delivered" },
  { id: "TH-M9P3Q", date: "May 28, 2026", items: 3, total: 56.97, status: "Processing" },
];

function OrdersList({ limit }: { limit?: number }) {
  const list = limit ? sampleOrders.slice(0, limit) : sampleOrders;
  return (
    <div className="space-y-2">
      {list.map((o) => (
        <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-smooth">
          <Package className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">#{o.id}</div>
            <div className="text-xs text-muted-foreground">{o.date} · {o.items} item{o.items !== 1 ? "s" : ""}</div>
          </div>
          <div className="text-right">
            <div className="font-bold">${o.total}</div>
            <div className={`text-xs ${o.status === "Delivered" ? "text-emerald-600" : "text-accent"}`}>{o.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersTab() { return <Card><h3 className="font-bold mb-4">All orders</h3><OrdersList /></Card>; }

function DownloadsTab() {
  const items = useFeatured().slice(0, 3);
  return (
    <Card>
      <h3 className="font-bold mb-4">Your downloads</h3>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.slug} className="flex items-center gap-3 p-3 rounded-xl border border-border">
            <span className="text-3xl">{p.emoji}</span>
            <div className="flex-1"><div className="font-semibold text-sm">{p.name}</div><div className="text-xs text-muted-foreground">Available · expires never</div></div>
            <button className="px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WishlistTab() {
  const wish = useWishlist();
  const items = useProductsBySlugs(wish.slugs);
  return (
    <Card>
      <h3 className="font-bold mb-4">Saved items ({items.length})</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No saved items yet. <Link to="/products" className="text-primary">Browse products</Link></p> :
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((p) => p && (
            <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary transition-smooth">
              <span className="text-3xl">{p.emoji}</span>
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{p.name}</div><div className="text-primary font-bold text-sm">${p.price}</div></div>
            </Link>
          ))}
        </div>}
    </Card>
  );
}

function NotificationsTab() {
  const list = [
    { t: "Your order #TH-A1B2C has been delivered", d: "2 hours ago", new: true },
    { t: "Flash sale: 25% off on all AI tools", d: "Yesterday", new: true },
    { t: "Welcome to TopupHut! Here's 10% off", d: "3 days ago" },
  ];
  return (
    <Card>
      <h3 className="font-bold mb-4">Notifications</h3>
      <div className="space-y-2">
        {list.map((n, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${n.new ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <Bell className={`h-4 w-4 mt-0.5 ${n.new ? "text-primary" : "text-muted-foreground"}`} />
            <div className="flex-1"><div className="text-sm">{n.t}</div><div className="text-xs text-muted-foreground">{n.d}</div></div>
            {n.new && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">NEW</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProfileTab({ user }: { user: { name: string; email: string } }) {
  return (
    <Card>
      <h3 className="font-bold mb-4">Profile settings</h3>
      <form onSubmit={(e) => { e.preventDefault(); toast.success("Profile updated"); }} className="space-y-4 max-w-xl">
        <Field label="Full name" defaultValue={user.name} />
        <Field label="Email" type="email" defaultValue={user.email} />
        <Field label="Phone" type="tel" placeholder="+880 1XXXXXXXXX" />
        <button className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Save changes</button>
      </form>
    </Card>
  );
}

function AddressesTab() {
  return (
    <Card>
      <h3 className="font-bold mb-4">Addresses</h3>
      <p className="text-sm text-muted-foreground mb-4">Digital products are delivered via email — addresses are optional.</p>
      <form onSubmit={(e) => { e.preventDefault(); toast.success("Address saved"); }} className="space-y-4 max-w-xl">
        <Field label="Country" defaultValue="Bangladesh" />
        <Field label="City" placeholder="Dhaka" />
        <Field label="Street address" placeholder="Road, House" />
        <button className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Save</button>
      </form>
    </Card>
  );
}

function SupportTab() {
  return (
    <Card>
      <h3 className="font-bold mb-4">Support tickets</h3>
      <div className="space-y-2 mb-4">
        {[{ id: "#5421", subj: "Activation issue", status: "Resolved" }, { id: "#5318", subj: "Refund request", status: "Open" }].map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <div className="flex-1"><div className="font-semibold text-sm">{t.subj}</div><div className="text-xs text-muted-foreground">Ticket {t.id}</div></div>
            <span className={`text-xs font-semibold ${t.status === "Resolved" ? "text-emerald-600" : "text-accent"}`}>{t.status}</span>
          </div>
        ))}
      </div>
      <Link to="/support" className="text-sm text-primary font-semibold hover:underline">Create new ticket →</Link>
    </Card>
  );
}

function PasswordTab() {
  return (
    <Card>
      <h3 className="font-bold mb-4">Change password</h3>
      <form onSubmit={(e) => { e.preventDefault(); toast.success("Password updated"); }} className="space-y-4 max-w-xl">
        <Field label="Current password" type="password" />
        <Field label="New password" type="password" />
        <Field label="Confirm new password" type="password" />
        <button className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Update password</button>
      </form>
    </Card>
  );
}

function Field({ label, type = "text", defaultValue, placeholder }: { label: string; type?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold block mb-1.5">{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
    </div>
  );
}
