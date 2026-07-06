import { useMemo } from "react";
import { Download, KeyRound, ExternalLink, Copy, User as UserIcon, Lock, Calendar, Clock, Package, Receipt, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/cms/settings";
import type { DeliveryItem } from "@/lib/delivery.functions";

function formatBytes(size: number | null): string | null {
  if (!size || size <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let s = size, i = 0;
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(s >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function copyText(v: string, label = "Copied") {
  try { await navigator.clipboard.writeText(v); toast.success(label); } catch { toast.error("Copy failed"); }
}

function pickCF(item: DeliveryItem, ...names: string[]): string | null {
  for (const n of names) {
    const f = item.custom_fields.find((f) => f.field_name.toLowerCase() === n.toLowerCase());
    if (f?.value) return f.value;
  }
  return null;
}

function WhatsAppButton() {
  const s = useSettings((x) => x.settings);
  const num = s.whatsapp?.replace(/\D+/g, "");
  if (!num) return null;
  return (
    <a
      href={`https://wa.me/${num}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
    >
      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Support
    </a>
  );
}

export function DeliveryPanel({
  items,
  showHeader = true,
  showInvoice = true,
}: {
  items: DeliveryItem[];
  showHeader?: boolean;
  showInvoice?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-4">
      {showHeader && <h3 className="font-bold text-lg">Your delivery</h3>}
      {items.map((it) => (
        <DeliveryCard key={it.order_item_id} item={it} showInvoice={showInvoice} />
      ))}
    </div>
  );
}

function DeliveryCard({ item, showInvoice }: { item: DeliveryItem; showInvoice: boolean }) {
  // Pick renderer by delivery_type first, then product_type as fallback.
  const type = item.product.delivery_type || item.product.product_type;
  const purchased = useMemo(
    () => (item.order_created_at ? new Date(item.order_created_at).toLocaleDateString() : ""),
    [item.order_created_at],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <header className="flex items-start gap-3">
        {item.product.thumbnail_url ? (
          <img src={item.product.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center"><Package className="h-6 w-6 text-primary" /></div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{item.product.name}</div>
          <div className="text-xs text-muted-foreground">
            Order #{item.order_number} · Purchased {purchased} · Qty {item.qty}
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary uppercase whitespace-nowrap">{type.replace("_", " ")}</span>
      </header>

      {renderBody(item, type)}

      {item.custom_fields.length > 0 && <CustomFieldsBlock item={item} />}

      <footer className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        {showInvoice && (
          <button
            type="button"
            onClick={() => toast.info("Invoice download will be available soon")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
          >
            <Receipt className="h-3.5 w-3.5" /> Download invoice
          </button>
        )}
        <WhatsAppButton />
      </footer>
    </div>
  );
}

function renderBody(item: DeliveryItem, type: string) {
  switch (type) {
    case "download":
    case "downloadable":
      return <DownloadBody item={item} />;
    case "license_key":
      return <LicenseBody item={item} />;
    case "subscription":
      return <SubscriptionBody item={item} />;
    case "account":
      return <AccountBody item={item} />;
    case "external":
    case "external_url":
      return <ExternalBody item={item} />;
    case "manual":
      return <ManualBody item={item} />;
    default:
      return <DownloadBody item={item} />;
  }
}

function DownloadBody({ item }: { item: DeliveryItem }) {
  if (item.downloads.length === 0) {
    return <EmptyNote text="Files will appear here once uploaded by our team." />;
  }
  return (
    <div className="space-y-2">
      {item.downloads.map((d) => (
        <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
          <Download className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{d.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {d.version ? `v${d.version}` : "Latest"}
              {formatBytes(d.file_size) ? ` · ${formatBytes(d.file_size)}` : ""}
            </div>
          </div>
          <a
            href={d.file_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      ))}
    </div>
  );
}

function LicenseBody({ item }: { item: DeliveryItem }) {
  if (item.license_keys.length === 0) {
    return <EmptyNote text="Your license key is being provisioned. Refresh in a moment." />;
  }
  return (
    <div className="space-y-2">
      {item.license_keys.map((k, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
          <KeyRound className="h-5 w-5 text-primary shrink-0" />
          <code className="flex-1 font-mono text-sm break-all">{k}</code>
          <button type="button" onClick={() => copyText(k, "License copied")} className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted inline-flex items-center gap-1">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Need help activating? Contact support below.</p>
    </div>
  );
}

function SubscriptionBody({ item }: { item: DeliveryItem }) {
  // Placeholder — real data will come from a future subscriptions table.
  const start = item.order_created_at ? new Date(item.order_created_at) : new Date();
  const end = new Date(start); end.setDate(end.getDate() + 30);
  const remaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-sm">
      <InfoTile icon={Calendar} label="Started" value={start.toLocaleDateString()} />
      <InfoTile icon={Clock} label="Expires" value={end.toLocaleDateString()} />
      <InfoTile icon={RefreshCw} label="Status" value="Active" />
      <InfoTile icon={Clock} label="Remaining" value={`${remaining} days`} />
      <div className="sm:col-span-2">
        <button type="button" disabled className="w-full py-2.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold cursor-not-allowed">
          Renew (coming soon)
        </button>
      </div>
    </div>
  );
}

function AccountBody({ item }: { item: DeliveryItem }) {
  const username = pickCF(item, "username", "email", "account_email");
  const password = pickCF(item, "password", "account_password");
  const portal = pickCF(item, "login_url", "portal_url") ?? item.product.external_url;
  const anything = username || password || portal;
  if (!anything) return <EmptyNote text="Your account details are being prepared and will appear here shortly." />;
  return (
    <div className="space-y-2">
      {username && <CredentialRow icon={UserIcon} label="Username" value={username} />}
      {password && <CredentialRow icon={Lock} label="Password" value={password} secret />}
      {portal && (
        <a
          href={portal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open portal
        </a>
      )}
    </div>
  );
}

function ExternalBody({ item }: { item: DeliveryItem }) {
  const url = item.product.external_url;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">This product is delivered via an external portal.</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold">
          <ExternalLink className="h-3.5 w-3.5" /> Open external portal
        </a>
      ) : (
        <EmptyNote text="A portal link will be shared shortly." />
      )}
    </div>
  );
}

function ManualBody({ item: _item }: { item: DeliveryItem }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-emerald-600 font-semibold">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Order received
      </div>
      <p className="text-muted-foreground">We are preparing your order manually. Estimated delivery within 24 hours.</p>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function CredentialRow({ icon: Icon, label, value, secret = false }: { icon: any; label: string; value: string; secret?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
        <code className="font-mono text-sm break-all">{secret ? "•".repeat(Math.min(12, value.length)) : value}</code>
      </div>
      <button type="button" onClick={() => copyText(value, `${label} copied`)} className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted inline-flex items-center gap-1">
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
    </div>
  );
}

function CustomFieldsBlock({ item }: { item: DeliveryItem }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-xs uppercase text-muted-foreground mb-2">Your submitted information</div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {item.custom_fields.map((f) => (
          <div key={f.field_name} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{f.field_label}</dt>
            <dd className="font-medium break-all">
              {f.field_type === "password" ? "••••••••" : (f.value || <span className="text-muted-foreground italic">not provided</span>)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground italic">{text}</p>;
}
