import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, ShieldCheck, User2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SubscriptionDeliveryItem = {
  assignment_id: string;
  status: string;
  assigned_at: string;
  expires_at: string | null;
  renewal_required: boolean;
  account_email: string | null;
  account_password: string | null;
  provider: string | null;
  two_factor_enabled: boolean;
  subscription_mode: string | null;
  product_name: string | null;
  profile_name: string | null;
  profile_pin: string | null;
  profile_avatar: string | null;
  profile_slot: number | null;
};

function CopyableField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
      <div className="text-xs text-muted-foreground w-24 shrink-0">{label}</div>
      <div className="font-mono text-sm flex-1 truncate">
        {show ? value : "••••••••"}
      </div>
      {secret && (
        <Button variant="ghost" size="icon" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copied`);
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SubscriptionDeliveryPanel({ items }: { items: SubscriptionDeliveryItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-bold text-sm">Your subscription access</h3>
      </div>
      {items.map((it) => {
        const isProfile =
          it.subscription_mode === "shared_account" || it.subscription_mode === "profile_based";
        return (
          <div key={it.assignment_id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-sm flex items-center gap-2">
                <User2 className="h-4 w-4 text-primary" />
                {it.product_name ?? it.provider ?? "Subscription"}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{it.status}</Badge>
                {it.two_factor_enabled && <Badge className="bg-orange-500/15 text-orange-600">2FA</Badge>}
              </div>
            </div>

            {isProfile && it.profile_name && (
              <CopyableField label="Profile" value={it.profile_name} />
            )}
            {isProfile && it.profile_pin && (
              <CopyableField label="PIN" value={it.profile_pin} secret />
            )}
            {it.account_email && <CopyableField label="Email" value={it.account_email} />}
            {it.account_password && (
              <CopyableField label="Password" value={it.account_password} secret />
            )}

            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
              {it.expires_at && (
                <span>Expires: {new Date(it.expires_at).toLocaleDateString()}</span>
              )}
              {it.renewal_required && (
                <span className="text-orange-600 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Renewal required
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
