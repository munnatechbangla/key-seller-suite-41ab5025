// Phase 1.1 — Manual License Assignment
// Reuses existing license_pools / license_keys / license_assignments tables.
// Rendered inside the admin order details expansion.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  adminListAssignableLicenseItemsFn,
  adminListAvailableLicenseKeysFn,
  adminAssignLicenseKeyFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type AssignableItem = {
  order_item_id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  license_pool_id_snapshot: string | null;
  assigned_count: number;
  remaining: number;
  assignments: Array<{
    id: string;
    revoked_at: string | null;
    assigned_at: string | null;
    license_keys: { key_value: string | null } | null;
  }>;
  can_assign: boolean;
};

export function LicenseAssignmentPanel({ orderId }: { orderId: string }) {
  const listItems = useServerFn(adminListAssignableLicenseItemsFn);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-license-assign", orderId],
    queryFn: () => listItems({ data: { orderId } }),
  });

  const [picker, setPicker] = useState<AssignableItem | null>(null);

  if (q.isLoading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading license items…
      </div>
    );
  }

  const items = (q.data?.items ?? []) as AssignableItem[];
  if (!items.length) return null;

  const paid = q.data?.order.paid ?? false;

  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">License Keys</h4>
        {!paid && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-3 w-3" /> Order not paid — assignment disabled
          </span>
        )}
      </div>

      {items.map((it) => {
        const active = it.assignments.filter((a) => !a.revoked_at);
        const full = it.assigned_count >= it.quantity;
        return (
          <div key={it.order_item_id} className="rounded-lg border border-border/70 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm font-medium">{it.product_name ?? "Product"}</div>
                <div className="text-[11px] text-muted-foreground">
                  Qty {it.quantity} • Assigned {it.assigned_count}/{it.quantity}
                </div>
              </div>
              <Button
                size="sm"
                variant={full ? "outline" : "default"}
                disabled={!it.can_assign}
                onClick={() => setPicker(it)}
              >
                <KeyRound className="h-3.5 w-3.5 mr-1" />
                {full ? "Fully assigned" : "Assign License"}
              </Button>
            </div>

            {active.length > 0 && (
              <ul className="space-y-1 pt-1">
                {active.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-xs font-mono rounded bg-muted/50 px-2 py-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{a.license_keys?.key_value ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <AssignDialog
        item={picker}
        onClose={() => setPicker(null)}
        onAssigned={() => {
          setPicker(null);
          qc.invalidateQueries({ queryKey: ["admin-license-assign", orderId] });
          qc.invalidateQueries({ queryKey: ["order-fulfillments", orderId] });
          qc.invalidateQueries({ queryKey: ["admin-pools"] });
          qc.invalidateQueries({ queryKey: ["my-deliveries"] });
        }}
      />
    </div>
  );
}

function AssignDialog({
  item,
  onClose,
  onAssigned,
}: {
  item: AssignableItem | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const listKeys = useServerFn(adminListAvailableLicenseKeysFn);
  const assign = useServerFn(adminAssignLicenseKeyFn);
  const [selected, setSelected] = useState<string>("");

  const q = useQuery({
    queryKey: ["admin-available-license-keys", item?.product_id, item?.license_pool_id_snapshot],
    queryFn: () =>
      listKeys({
        data: {
          productId: item!.product_id,
          poolId: item?.license_pool_id_snapshot ?? undefined,
        },
      }),
    enabled: !!item,
  });

  const mut = useMutation({
    mutationFn: (licenseKeyId: string) =>
      assign({ data: { orderItemId: item!.order_item_id, licenseKeyId } }),
    onSuccess: () => {
      toast.success("License key assigned");
      setSelected("");
      onAssigned();
    },
    onError: (e: any) => toast.error(e?.message ?? "Assignment failed"),
  });

  const keys = (q.data ?? []) as Array<{
    id: string;
    key_value: string;
    license_pools: { name: string | null } | null;
  }>;

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign License Key</DialogTitle>
          <DialogDescription>
            {item?.product_name ?? "Product"} — {item?.remaining ?? 0} remaining of {item?.quantity ?? 0}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading available keys…
          </div>
        ) : keys.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No available keys{item?.license_pool_id_snapshot ? " in the snapshotted pool" : ""} for this product.
            Import more keys from the License Pools page.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {keys.map((k) => (
              <label
                key={k.id}
                className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="license-key"
                  value={k.id}
                  checked={selected === k.id}
                  onChange={() => setSelected(k.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{k.key_value}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Pool: {k.license_pools?.name ?? "—"}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!selected || mut.isPending}
            onClick={() => mut.mutate(selected)}
          >
            {mut.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Assigning…
              </>
            ) : (
              "Assign selected key"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
