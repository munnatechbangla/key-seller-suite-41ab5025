import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrderCustomFieldsAuthFn, getOrderCustomFieldsGuestFn, type OrderCustomFieldValue } from "@/lib/order-custom-fields.functions";

export function OrderCustomFieldValues({
  orderId,
  email,
  authed,
  className,
  compact,
  isAdmin,
}: {
  orderId: string | undefined | null;
  email?: string;
  authed: boolean;
  className?: string;
  compact?: boolean;
  isAdmin?: boolean;
}) {
  const guestFn = useServerFn(getOrderCustomFieldsGuestFn);
  const authFn = useServerFn(getOrderCustomFieldsAuthFn);
  const q = useQuery({
    queryKey: ["order-custom-values", orderId, email, authed ? "u" : "g", isAdmin ? "admin" : "user"],
    queryFn: () => (isAdmin || authed ? authFn : guestFn)({ data: { orderId: orderId!, email } }),
    enabled: !!orderId,
  });
  const values = (q.data ?? []) as OrderCustomFieldValue[];
  if (values.length === 0) return null;

  // group by product
  const groups = new Map<string, OrderCustomFieldValue[]>();
  for (const v of values) {
    const k = v.product_slug ?? "product";
    const arr = groups.get(k) ?? [];
    arr.push(v);
    groups.set(k, arr);
  }

  return (
    <div className={className}>
      {!compact && <h3 className="font-bold text-lg mb-3">Customer Provided Information</h3>}
      {compact && <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Customer Provided Information</h4>}
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([slug, rows]) => (
          <div key={slug} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{slug}</div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {rows.map((r) => (
                <div key={r.id} className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{r.field_label}</dt>
                  <dd className="font-medium break-all">
                    {r.field_type === "password" ? "••••••••" : (r.value || <span className="text-muted-foreground italic">not provided</span>)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
