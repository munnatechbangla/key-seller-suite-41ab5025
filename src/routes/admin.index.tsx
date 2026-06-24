import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetKpisFn } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Users, Package, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const fn = useServerFn(adminGetKpisFn);
  const { data, isLoading } = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fn() });

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
    </div>
  );
}
