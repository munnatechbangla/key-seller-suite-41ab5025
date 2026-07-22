// Manual License Delivery — admin editor rendered inside admin order details.
// Independent of License Pool assignments; admin types license info manually.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import {
  adminListManualLicenseDeliveriesFn,
  adminSaveManualLicenseDeliveryFn,
} from "@/lib/manual-license.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  order_item_id: string;
  product_id: string | null;
  product_name: string | null;
  qty: number;
  delivery: {
    id: string;
    license_name: string;
    license_key: string;
    expiry_date: string | null;
    platform: string | null;
    instructions: string | null;
    delivered_at: string;
  } | null;
};

export function ManualLicenseDeliveryPanel({ orderId }: { orderId: string }) {
  const list = useServerFn(adminListManualLicenseDeliveriesFn);
  const q = useQuery({
    queryKey: ["admin-manual-license", orderId],
    queryFn: () => list({ data: { orderId } }),
  });

  if (q.isLoading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading license items…
      </div>
    );
  }

  const items = (q.data?.items ?? []) as Item[];
  if (!items.length) return null;

  const eligible = q.data?.order.eligible ?? false;

  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Manual License Delivery</h4>
        {!eligible && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-3 w-3" /> Order not paid — delivery disabled
          </span>
        )}
      </div>

      {items.map((it) => (
        <ManualLicenseRow key={it.order_item_id} orderId={orderId} item={it} disabled={!eligible} />
      ))}
    </div>
  );
}

function ManualLicenseRow({
  orderId,
  item,
  disabled,
}: {
  orderId: string;
  item: Item;
  disabled: boolean;
}) {
  const save = useServerFn(adminSaveManualLicenseDeliveryFn);
  const qc = useQueryClient();

  const [licenseName, setLicenseName] = useState(item.delivery?.license_name ?? item.product_name ?? "");
  const [licenseKey, setLicenseKey] = useState(item.delivery?.license_key ?? "");
  const [expiryDate, setExpiryDate] = useState(item.delivery?.expiry_date ?? "");
  const [platform, setPlatform] = useState(item.delivery?.platform ?? "");
  const [instructions, setInstructions] = useState(item.delivery?.instructions ?? "");

  useEffect(() => {
    if (item.delivery) {
      setLicenseName(item.delivery.license_name);
      setLicenseKey(item.delivery.license_key);
      setExpiryDate(item.delivery.expiry_date ?? "");
      setPlatform(item.delivery.platform ?? "");
      setInstructions(item.delivery.instructions ?? "");
    }
  }, [item.delivery?.id]);

  const mut = useMutation({
    mutationFn: (deliver: boolean) =>
      save({
        data: {
          orderItemId: item.order_item_id,
          licenseName,
          licenseKey,
          expiryDate: expiryDate || null,
          platform: platform || null,
          instructions: instructions || null,
          deliver,
        },
      }),
    onSuccess: (r: any) => {
      if (r?.draft) toast.success("Draft saved");
      else toast.success(r?.notified ? "Delivered & customer notified" : "License delivery saved");
      qc.invalidateQueries({ queryKey: ["admin-manual-license", orderId] });
      qc.invalidateQueries({ queryKey: ["order-fulfillments", orderId] });
      qc.invalidateQueries({ queryKey: ["fulfillment-timeline"] });
      qc.invalidateQueries({ queryKey: ["my-deliveries"] });
      qc.invalidateQueries({ queryKey: ["my-manual-licenses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const canSubmit = licenseName.trim().length > 0 && licenseKey.trim().length > 0 && !mut.isPending;
  const canSave = !disabled && canSubmit;

  return (
    <div className="rounded-lg border border-border/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-medium">{item.product_name ?? "Product"}</div>
          <div className="text-[11px] text-muted-foreground">Qty {item.qty}</div>
        </div>
        {item.delivery && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Delivered {new Date(item.delivery.delivered_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">License Name *</Label>
          <Input value={licenseName} onChange={(e) => setLicenseName(e.target.value)} disabled={disabled} placeholder="e.g. Windows 11 Pro" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">License Key *</Label>
          <Input value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} disabled={disabled} placeholder="XXXX-XXXX-XXXX" className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Expiry Date</Label>
          <Input type="date" value={expiryDate ?? ""} onChange={(e) => setExpiryDate(e.target.value)} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Platform</Label>
          <Input value={platform} onChange={(e) => setPlatform(e.target.value)} disabled={disabled} placeholder="Windows / Mac / Web" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Instructions / Notes</Label>
          <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={disabled} placeholder="Activation steps or notes for the customer" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => mut.mutate(false)} disabled={!canSave}>
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button size="sm" onClick={() => mut.mutate(true)} disabled={!canSave}>
          {mut.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</>
          ) : item.delivery ? "Update & Redeliver" : "Deliver License"}
        </Button>
      </div>
    </div>
  );
}

