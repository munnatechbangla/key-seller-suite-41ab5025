import { useMemo } from "react";
import { 
  Download, KeyRound, ExternalLink, Copy, User as UserIcon, 
  Lock, Package, Receipt, MessageCircle, Activity, BarChart3, 
  MessageSquare, Clock, CheckCircle2, AlertCircle, RefreshCw
} from "lucide-react";
import { ProductThumb } from "@/components/site/ProductThumb";
import { toast } from "sonner";
import { useSettings } from "@/lib/cms/settings";
import type { DeliveryItem } from "@/lib/delivery.functions";
import { cn } from "@/lib/utils";

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
  const s = useSettings((x) => x.settings) as any;
  const raw: string = s?.support?.whatsapp_number || s?.contact?.whatsapp || "";
  const num = raw.replace(/\D+/g, "");
  const label: string = s?.support?.whatsapp_button_text || "WhatsApp Support";
  if (!num) return null;
  return (
    <a
      href={`https://wa.me/${num}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
    >
      <MessageCircle className="h-3.5 w-3.5" /> {label}
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
  // Subscription products must never fall through to manual/license/download renderers.
  // Manual license delivery record wins over product-type heuristics.
  const type = item.manual_license
    ? "license_key"
    : item.product.product_type === "smm_service"
    ? "smm_service"
    : item.product.product_type === "subscription" || item.product.delivery_type === "subscription" || item.fulfillment?.delivery_type === "subscription"
    ? "subscription"
    : (item.product.delivery_type || item.product.product_type || "manual");
  const purchased = useMemo(
    () => (item.order_created_at ? new Date(item.order_created_at).toLocaleDateString() : ""),
    [item.order_created_at],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <header className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden grid place-items-center bg-muted/40 ring-1 ring-border">
          <ProductThumb
            src={item.manual_license?.thumbnail_url || item.fulfillment?.thumbnail_url || item.product.thumbnail_url}
            emoji={(item.product as any).emoji || "📦"}
            alt={item.product.name}
            size={48}
            className="h-full w-full object-cover bg-transparent"
          />
        </div>
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
    case "smm_service":
      return <SmmDelivery item={item} />;
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
      return <ManualBody item={item} />;
  }
}

function SmmDelivery({ item }: { item: DeliveryItem }) {
  const f = item.smm_fulfillment;
  const delivered = f?.delivered_quantity || 0;
  const ordered = f?.ordered_quantity || item.qty || 0;
  const progress = ordered > 0 ? Math.min(100, (delivered / ordered) * 100) : 0;

  const getStatusConfig = (s: string) => {
    switch (s) {
      case "completed": return { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2, label: "Order Completed" };
      case "partial": return { color: "text-blue-500", bg: "bg-blue-500/10", icon: BarChart3, label: "Partially Delivered" };
      case "processing": return { color: "text-amber-500", bg: "bg-amber-500/10", icon: RefreshCw, label: "Processing" };
      case "cancelled": return { color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle, label: "Cancelled" };
      case "refunded": return { color: "text-purple-500", bg: "bg-purple-500/10", icon: Receipt, label: "Refunded" };
      default: return { color: "text-slate-500", bg: "bg-slate-500/10", icon: Clock, label: "Pending Start" };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className="space-y-6">
      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border", config.bg)}>
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-background shadow-sm", config.color)}>
            <config.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">{config.label}</div>
            <div className="text-xs text-muted-foreground">Order ID: #{item.order_number}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Progress</div>
            <div className="text-lg font-black font-mono">{Math.round(progress)}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Total Quantity</div>
          <div className="text-base font-bold">{ordered.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Delivered</div>
          <div className="text-base font-bold text-primary">{delivered.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card col-span-2 sm:col-span-1">
          <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Remaining</div>
          <div className="text-base font-bold">{Math.max(0, ordered - delivered).toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase text-muted-foreground px-1">
          <span>Delivery Progress</span>
          <span>{delivered.toLocaleString()} / {ordered.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {f?.admin_notes && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] mb-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Merchant Message
          </div>
          {f.admin_notes}
        </div>
      )}

      {item.custom_fields.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground px-1">Service Details</div>
          <div className="grid gap-2">
            {item.custom_fields.map((cf, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-xs">
                <span className="text-muted-foreground">{cf.field_label}</span>
                <span className="font-mono font-medium">{cf.value || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const ml = item.manual_license;
  if (ml) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500" /> Delivered
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><div className="text-[11px] text-muted-foreground">License Name</div><div className="font-medium">{ml.license_name}</div></div>
            {ml.platform && <div><div className="text-[11px] text-muted-foreground">Platform</div><div className="font-medium">{ml.platform}</div></div>}
            {ml.expiry_date && <div><div className="text-[11px] text-muted-foreground">Expiry Date</div><div className="font-medium">{ml.expiry_date}</div></div>}
            <div><div className="text-[11px] text-muted-foreground">Delivered</div><div className="font-medium">{new Date(ml.delivered_at).toLocaleString()}</div></div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <KeyRound className="h-5 w-5 text-primary shrink-0" />
            <code className="flex-1 font-mono text-sm break-all">{ml.license_key}</code>
            <button type="button" onClick={() => copyText(ml.license_key, "License copied")} className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted inline-flex items-center gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          {ml.instructions && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Instructions</div>
              <p className="text-sm whitespace-pre-wrap">{ml.instructions}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  return <EmptyNote text="Your license key is being prepared and will appear here once delivered." />;
}


function SubscriptionBody({ item }: { item: DeliveryItem }) {
  // Manual delivery workflow: show delivered state if fulfillment marked it so.
  const f: any = (item as any).fulfillment;
  const delivered = f?.fulfillment_status === "delivered";
  const deliveredAt = f?.metadata?.delivered_at ?? f?.completed_at;
  if (delivered) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
          <div className="h-2 w-2 rounded-full bg-emerald-500" /> Subscription Delivered
        </div>
        <p className="text-sm text-muted-foreground">Delivered successfully.</p>
        {deliveredAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(deliveredAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border p-4 space-y-1">
      <div className="flex items-center gap-2 text-amber-600 font-semibold">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Awaiting delivery
      </div>
      <p className="text-sm text-muted-foreground">
        Your subscription is being prepared. You will be notified once it is delivered.
      </p>
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
