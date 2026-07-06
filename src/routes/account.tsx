import { siteName } from "@/lib/cms/seo";
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
  MapPin, LifeBuoy, KeyRound, LogOut, Package, DollarSign, CheckCircle2, TrendingUp, Loader2, Receipt, Star,
} from "lucide-react";
import { toast } from "sonner";
import { useProductsBySlugs, featuredQuery } from "@/lib/catalog";
import { getMyOrdersFn, getMyDownloadsFn, getMyLicensesFn } from "@/lib/orders.functions";
import { getMySubmissionsFn } from "@/lib/payments/gateways.functions";
import { MyReviewsTab } from "@/components/site/MyReviewsTab";
import { OrderCustomFieldValues } from "@/components/orders/OrderCustomFieldValues";
import { DeliveryPanel } from "@/components/delivery/DeliveryPanel";
import { getMyDeliveriesFn } from "@/lib/delivery.functions";
import { SubscriptionDeliveryPanel, type SubscriptionDeliveryItem } from "@/components/subscriptions/SubscriptionDeliveryPanel";
import { SubscriptionLifecycleCard, type LifecycleSubscription } from "@/components/subscriptions/SubscriptionLifecycleCard";
import { getOrderSubscriptionDeliveryAuthedFn, getMySubscriptionsFn } from "@/lib/subscriptions.functions";

function OrderSubscriptionSection({ orderId }: { orderId: string }) {
  const fn = useServerFn(getOrderSubscriptionDeliveryAuthedFn);
  const { data } = useQuery({
    queryKey: ["sub-delivery", orderId],
    queryFn: () => fn({ data: { orderId } }) as Promise<SubscriptionDeliveryItem[]>,
  });
  if (!data || data.length === 0) return null;
  return <SubscriptionDeliveryPanel items={data} />;
}

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: `My Account — ${siteName()}` }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(featuredQuery()); },
  component: AccountPage,
  errorComponent: () => <div className="p-8 text-center">Account unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

const tabs = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "orders", label: "My Orders", Icon: ShoppingBag },
  { id: "subscriptions", label: "Subscriptions", Icon: KeyRound },
  { id: "downloads", label: "My Downloads", Icon: Download },
  { id: "licenses", label: "My Licenses", Icon: KeyRound },
  { id: "submissions", label: "Manual Payments", Icon: Receipt },
  { id: "reviews", label: "My Reviews", Icon: Star },
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
      <div className="container mx-auto px-4 py-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
        <aside className="min-w-0 lg:sticky lg:top-24 self-start space-y-2">
          <div className="rounded-2xl bg-card border border-border p-5 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold text-xl">{user.name[0].toUpperCase()}</div>
            <div className="font-bold mt-3 truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground break-all">{user.email}</div>
          </div>
          <nav className="rounded-2xl bg-card border border-border p-2">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)} className={`w-full flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${active === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                <t.Icon className="h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">{t.label}</span>
              </button>
            ))}
            <button onClick={() => { logout(); toast("Signed out"); navigate({ to: "/" }); }} className="w-full flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">Logout</span>
            </button>
          </nav>
        </aside>

        <section className="min-w-0">
          {active === "dashboard" && <DashboardTab />}
          {active === "orders" && <OrdersTab />}
          {active === "downloads" && <DownloadsTab />}
          {active === "licenses" && <LicensesTab />}
          {active === "submissions" && <SubmissionsTab />}
          {active === "reviews" && <MyReviewsTab />}
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

function useMyOrders() {
  const fn = useServerFn(getMyOrdersFn);
  return useQuery({ queryKey: ["my-orders"], queryFn: () => fn({}) });
}
function useMyDownloads() {
  const fn = useServerFn(getMyDownloadsFn);
  return useQuery({ queryKey: ["my-downloads"], queryFn: () => fn({}) });
}
function useMyLicenses() {
  const fn = useServerFn(getMyLicensesFn);
  return useQuery({ queryKey: ["my-licenses"], queryFn: () => fn({}) });
}

function Loader() {
  return <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</div>;
}

function DashboardTab() {
  const orders = useMyOrders();
  const list = orders.data ?? [];
  const totalSpent = list.filter((o) => o.status === "paid" || o.status === "completed").reduce((s, o) => s + Number(o.total), 0);
  const stats = [
    { label: "Total orders", value: String(list.length), Icon: Package, color: "text-primary bg-primary/10" },
    { label: "Total spent", value: `$${totalSpent.toFixed(2)}`, Icon: DollarSign, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Active orders", value: String(list.filter((o) => o.status === "paid" || o.status === "processing").length), Icon: CheckCircle2, color: "text-accent bg-accent/10" },
    { label: "Loyalty pts", value: String(Math.floor(totalSpent * 5)), Icon: TrendingUp, color: "text-secondary bg-secondary/10" },
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
        {orders.isLoading ? <Loader /> : <OrdersList orders={list.slice(0, 3)} />}
      </Card>
    </div>
  );
}

type OrderRow = NonNullable<ReturnType<typeof useMyOrders>["data"]>[number];

function OrdersList({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">No orders yet. <Link to="/products" className="text-primary">Browse products</Link></p>;
  const palette: Record<string, string> = {
    paid: "text-emerald-600 bg-emerald-500/10",
    completed: "text-emerald-600 bg-emerald-500/10",
    pending: "text-amber-600 bg-amber-500/10",
    processing: "text-amber-600 bg-amber-500/10",
    failed: "text-rose-600 bg-rose-500/10",
    cancelled: "text-muted-foreground bg-muted",
    refunded: "text-secondary bg-secondary/10",
  };
  return (
    <div className="space-y-2">
      {orders.map((o) => {
        const itemCount = o.order_items?.length ?? 0;
        const date = new Date(o.created_at).toLocaleDateString();
        const payStatus = (o as { payments?: { status: string }[] }).payments?.[0]?.status ?? "pending";
        return (
          <details key={o.id} className="rounded-xl border border-border hover:bg-muted/40 transition-smooth group">
            <summary className="flex items-center gap-3 p-3 cursor-pointer list-none">
              <Package className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">#{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{date} · {itemCount} item{itemCount !== 1 ? "s" : ""}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="font-bold">${Number(o.total).toFixed(2)}</div>
                <div className="flex gap-1 justify-end">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${palette[o.status] ?? palette.pending}`}>{o.status}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${palette[payStatus] ?? palette.pending}`}>{payStatus}</span>
                </div>
              </div>
            </summary>
            <div className="border-t border-border p-3 space-y-3">
              <OrderCustomFieldValues orderId={o.id} authed={true} compact />
              <OrderSubscriptionSection orderId={o.id} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function OrdersTab() {
  const orders = useMyOrders();
  return <Card><h3 className="font-bold mb-4">All orders</h3>{orders.isLoading ? <Loader /> : <OrdersList orders={orders.data ?? []} />}</Card>;
}

function DownloadsTab() {
  const fn = useServerFn(getMyDeliveriesFn);
  const q = useQuery({ queryKey: ["my-deliveries"], queryFn: () => fn({}) });
  const items = q.data ?? [];
  return (
    <Card>
      <h3 className="font-bold mb-1">Download Center</h3>
      <p className="text-xs text-muted-foreground mb-4">All your delivered products — downloads, licenses, accounts and more.</p>
      {q.isLoading ? <Loader /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivered items yet. Purchases will appear here once payment is confirmed.</p>
      ) : (
        <DeliveryPanel items={items} showHeader={false} />
      )}
    </Card>
  );
}

function LicensesTab() {
  const lic = useMyLicenses();
  const items = lic.data ?? [];
  return (
    <Card>
      <h3 className="font-bold mb-4">Your license keys</h3>
      {lic.isLoading ? <Loader /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No licenses yet. Licenses appear after a successful order.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const name = (a as { order_items: { product_name: string } | null }).order_items?.product_name ?? "Product";
            const key = (a as { license_keys: { key_value: string } | null }).license_keys?.key_value ?? "";
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                <KeyRound className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{name}</div>
                  <code className="text-xs text-muted-foreground font-mono break-all">{key}</code>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(key); toast.success("Copied"); }} className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted">Copy</button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SubmissionsTab() {
  const fn = useServerFn(getMySubmissionsFn);
  const q = useQuery({ queryKey: ["my-submissions"], queryFn: () => fn() });
  const items = q.data ?? [];
  const palette: Record<string, string> = {
    pending: "text-amber-600 bg-amber-500/10",
    approved: "text-emerald-600 bg-emerald-500/10",
    rejected: "text-rose-600 bg-rose-500/10",
  };
  return (
    <Card>
      <h3 className="font-bold mb-4">Manual payment submissions</h3>
      {q.isLoading ? <Loader /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No manual payments submitted yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const ord = (s as { orders: { order_number: string } | null }).orders;
            const date = new Date(s.created_at).toLocaleString();
            const reviewed = s.reviewed_at ? new Date(s.reviewed_at).toLocaleString() : null;
            return (
              <div key={s.id} className="p-3 rounded-xl border border-border space-y-1.5">
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">#{ord?.order_number ?? "—"} · <span className="capitalize">{s.gateway_slug}</span></div>
                    <div className="text-xs text-muted-foreground">Submitted {date}{s.transaction_id ? ` · Txn ${s.transaction_id}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">${Number(s.amount ?? 0).toFixed(2)}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${palette[s.status] ?? palette.pending}`}>{s.status}</span>
                  </div>
                </div>
                {s.status === "rejected" && s.admin_note && (
                  <div className="text-xs text-rose-600 pl-7">Reason: {s.admin_note}</div>
                )}
                {s.status === "approved" && reviewed && (
                  <div className="text-xs text-emerald-600 pl-7">Approved on {reviewed}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
    { t: "Welcome! Here's 10% off your first order", d: "3 days ago" },
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
