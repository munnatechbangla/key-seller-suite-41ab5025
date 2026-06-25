import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetKpisFn } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Users, Package, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSetupStatus } from "@/lib/setup";
import { useSettings } from "@/lib/cms/settings";
import { DeploymentChecklist } from "@/components/admin/DeploymentChecklist";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const fn = useServerFn(adminGetKpisFn);
  const { data, isLoading } = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fn() });
  const { data: setup } = useSetupStatus();
  const s = useSettings((x) => x.settings);
  const missing: string[] = [];
  if (!s.branding.name) missing.push("Brand name");
  if (!s.seo.site_url) missing.push("Site URL");
  if (!s.contact.support_email) missing.push("Support email");
  if (!s.payment.currency) missing.push("Currency");

  const k = data ?? { totalRevenue: 0, orders: 0, customers: 0, products: 0, conversion: 0 };
  const cards = [
    { label: "Total Revenue", value: `$${k.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Orders", value: k.orders, icon: ShoppingBag },
    { label: "Customers", value: k.customers, icon: Users },
    { label: "Products", value: k.products, icon: Package },
    { label: "Conversion", value: `${k.conversion}%`, icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Marketplace performance overview</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "…" : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DeploymentChecklist />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Setup status</CardTitle>
            {setup?.is_completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              {setup?.is_completed ? (
                <>
                  Completed
                  {setup.completed_at ? ` on ${new Date(setup.completed_at).toLocaleDateString()}` : ""}.
                </>
              ) : (
                <>Setup is not completed — public traffic is redirected to /setup.</>
              )}
            </div>
            <Link to="/admin/setup" className="inline-block text-xs text-primary underline">
              Open Setup Wizard
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configuration warnings</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${missing.length ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            {missing.length === 0 ? (
              <div className="text-sm text-muted-foreground">All required fields look good.</div>
            ) : (
              <ul className="text-sm list-disc pl-5 space-y-1">
                {missing.map((m) => (
                  <li key={m}>{m} is empty</li>
                ))}
              </ul>
            )}
            <Link to="/admin/settings" className="inline-block mt-2 text-xs text-primary underline">
              Go to Settings
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
