import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSubscriptionRenewalHistoryFn } from "@/lib/subscriptions.functions";

export type LifecycleSubscription = {
  assignment_id: string;
  product_name: string | null;
  provider: string | null;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  renewal_date: string | null;
  remaining_days: number | null;
  renewal_count: number | null;
  auto_renew: boolean | null;
  account_email: string | null;
};

export function expiryBadge(days: number | null, status: string) {
  if (status === "cancelled") return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
  if (status === "suspended") return { label: "Suspended", cls: "bg-amber-500/15 text-amber-600" };
  if (status === "replaced") return { label: "Replaced", cls: "bg-muted text-muted-foreground" };
  if (status === "expired" || (days !== null && days <= 0))
    return { label: "Expired", cls: "bg-red-500/15 text-red-600" };
  if (days === null) return { label: "Active", cls: "bg-green-500/15 text-green-600" };
  if (days <= 3) return { label: `${days}d left`, cls: "bg-red-500/15 text-red-600" };
  if (days <= 7) return { label: `${days}d left`, cls: "bg-red-500/10 text-red-500" };
  if (days <= 15) return { label: `${days}d left`, cls: "bg-orange-500/15 text-orange-600" };
  if (days <= 30) return { label: `${days}d left`, cls: "bg-orange-500/10 text-orange-500" };
  return { label: `${days}d left`, cls: "bg-green-500/15 text-green-600" };
}

function RenewalHistory({ id }: { id: string }) {
  const fn = useServerFn(getSubscriptionRenewalHistoryFn);
  const { data = [] } = useQuery({
    queryKey: ["sub-renewal-history", id],
    queryFn: () => fn({ data: { id } }) as Promise<any[]>,
  });
  if (data.length === 0)
    return <p className="text-xs text-muted-foreground">No renewal history yet.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {data.map((h: any) => (
        <li key={h.id} className="flex justify-between border-b border-border/60 pb-1">
          <span className="capitalize">{h.renewal_type}</span>
          <span className="text-muted-foreground">
            {h.new_expiry ? new Date(h.new_expiry).toLocaleDateString() : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SubscriptionLifecycleCard({ item }: { item: LifecycleSubscription }) {
  const badge = expiryBadge(item.remaining_days, item.status);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">
            {item.product_name ?? item.provider ?? "Subscription"}
          </div>
          {item.account_email && (
            <div className="text-xs text-muted-foreground">{item.account_email}</div>
          )}
        </div>
        <Badge className={badge.cls}>{badge.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Activated:</span>{" "}
          {item.activated_at ? new Date(item.activated_at).toLocaleDateString() : "—"}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Expires:</span>{" "}
          {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Renewal:</span>{" "}
          {item.renewal_date ? new Date(item.renewal_date).toLocaleDateString() : "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Renewals:</span> {item.renewal_count ?? 0}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled className="gap-1">
          <RefreshCw className="h-3 w-3" /> Renew
        </Button>
        <span className="text-[10px] text-muted-foreground">Contact support to renew</span>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Renewal history
        </summary>
        <div className="pt-2">
          <RenewalHistory id={item.assignment_id} />
        </div>
      </details>
    </div>
  );
}
