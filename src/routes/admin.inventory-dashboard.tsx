import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getInventoryDashboardSummaryFn,
  getInventoryPoolStatsFn,
  getInventoryRecentActivityFn,
} from "@/lib/inventory.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Boxes,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Ban,
  TrendingDown,
  Package,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inventory-dashboard")({
  component: InventoryDashboard,
});

type PoolStat = {
  pool_id: string;
  pool_name: string;
  inventory_type: string;
  product_id: string | null;
  product_name: string | null;
  low_stock_threshold: number;
  is_active: boolean;
  available: number;
  assigned: number;
  reserved: number;
  disabled: number;
  expired: number;
  total: number;
  last_assignment_at: string | null;
  last_updated_at: string | null;
  status: "healthy" | "low_stock" | "out_of_stock" | "disabled";
};

const STATUS_META: Record<PoolStat["status"], { label: string; className: string; icon: any }> = {
  healthy: { label: "Healthy", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", icon: CheckCircle2 },
  low_stock: { label: "Low Stock", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30", icon: AlertTriangle },
  out_of_stock: { label: "Out of Stock", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", icon: AlertCircle },
  disabled: { label: "Disabled", className: "bg-muted text-muted-foreground border-border", icon: Ban },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function InventoryDashboard() {
  const summaryFn = useServerFn(getInventoryDashboardSummaryFn);
  const poolsFn = useServerFn(getInventoryPoolStatsFn);
  const activityFn = useServerFn(getInventoryRecentActivityFn);

  const summaryQ = useQuery({ queryKey: ["inv-dash-summary"], queryFn: () => summaryFn() });
  const poolsQ = useQuery({ queryKey: ["inv-dash-pools"], queryFn: () => poolsFn() });
  const activityQ = useQuery({
    queryKey: ["inv-dash-activity"],
    queryFn: () => activityFn({ data: { limit: 30 } }),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const pools: PoolStat[] = (poolsQ.data as PoolStat[]) ?? [];

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return pools.filter((p) => {
      if (typeFilter !== "all" && p.inventory_type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        p.pool_name.toLowerCase().includes(s) ||
        (p.product_name ?? "").toLowerCase().includes(s) ||
        p.inventory_type.toLowerCase().includes(s)
      );
    });
  }, [pools, search, typeFilter, statusFilter]);

  const lowestPools = useMemo(
    () => [...pools].filter((p) => p.is_active).sort((a, b) => a.available - b.available).slice(0, 10),
    [pools],
  );

  const totals = summaryQ.data ?? {};
  const summaryCards = [
    { label: "Total Items", value: totals.total ?? 0, icon: Boxes, tone: "text-foreground" },
    { label: "Available", value: totals.available ?? 0, icon: CheckCircle2, tone: "text-green-600" },
    { label: "Assigned", value: totals.assigned ?? 0, icon: Package, tone: "text-blue-600" },
    { label: "Reserved", value: totals.reserved ?? 0, icon: Clock, tone: "text-amber-600" },
    { label: "Disabled", value: totals.disabled ?? 0, icon: Ban, tone: "text-muted-foreground" },
    { label: "Expired", value: totals.expired ?? 0, icon: AlertCircle, tone: "text-red-600" },
    { label: "Low Stock Pools", value: totals.low_stock_pools ?? 0, icon: AlertTriangle, tone: "text-orange-600" },
    { label: "Out of Stock", value: totals.out_of_stock_pools ?? 0, icon: TrendingDown, tone: "text-red-600" },
  ];

  const assignedToday = useMemo(() => {
    const today = new Date().toDateString();
    return (activityQ.data ?? []).filter(
      (a: any) => a.action?.startsWith("assign") && new Date(a.created_at).toDateString() === today,
    ).length;
  }, [activityQ.data]);

  const warnings = [
    { show: (totals.out_of_stock_pools ?? 0) > 0, label: `${totals.out_of_stock_pools} pool(s) out of stock`, tone: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400" },
    { show: (totals.low_stock_pools ?? 0) > 0, label: `${totals.low_stock_pools} pool(s) running low`, tone: "border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-400" },
    { show: (totals.disabled_pools ?? 0) > 0, label: `${totals.disabled_pools} disabled pool(s)`, tone: "border-muted bg-muted/30 text-muted-foreground" },
    { show: assignedToday === 0 && (totals.total ?? 0) > 0, label: "No inventory assigned today", tone: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400" },
  ].filter((w) => w.show);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time monitoring of every inventory pool.</p>
        </div>
        <Link to="/admin/inventory">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Inventory
          </Button>
        </Link>
      </div>

      {/* Warning cards */}
      {warnings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {warnings.map((w, i) => (
            <div key={i} className={cn("border rounded-md px-4 py-3 text-sm flex items-center gap-2", w.tone)}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {w.label}
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className={cn("h-4 w-4", c.tone)} />
              </div>
              <div className={cn("text-2xl font-semibold mt-1", c.tone)}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Lowest Inventory Pools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowestPools.length === 0 && <p className="text-sm text-muted-foreground">No pools yet.</p>}
            {lowestPools.map((p) => {
              const pct = p.total > 0 ? Math.round((p.available / p.total) * 100) : 0;
              const bar =
                p.available === 0
                  ? "bg-red-500"
                  : p.available <= p.low_stock_threshold
                    ? "bg-orange-500"
                    : "bg-green-500";
              return (
                <div key={p.pool_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.pool_name}</span>
                    <span className="text-muted-foreground">
                      {p.available} / {p.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className={cn("h-full", bar)} style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-auto">
              {(activityQ.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
              {(activityQ.data ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                  <div className="min-w-0">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-muted-foreground"> · {a.pool_name ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search pool, product, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Inventory Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="license_key">License Key</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="download_token">Download Token</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="gift_code">Gift Code</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Avail</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Disabled</TableHead>
                  <TableHead className="text-right">Expired</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Last Assignment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolsQ.isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!poolsQ.isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                      No pools match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => {
                  const meta = STATUS_META[p.status];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={p.pool_id}>
                      <TableCell className="font-medium">{p.pool_name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.product_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.inventory_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{p.available}</TableCell>
                      <TableCell className="text-right">{p.assigned}</TableCell>
                      <TableCell className="text-right">{p.reserved}</TableCell>
                      <TableCell className="text-right">{p.disabled}</TableCell>
                      <TableCell className="text-right">{p.expired}</TableCell>
                      <TableCell className="text-right">{p.total}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.last_assignment_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", meta.className)}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
