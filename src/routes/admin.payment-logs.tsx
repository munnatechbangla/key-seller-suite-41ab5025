import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPaymentLogsFn, gatewayStatusFn } from "@/lib/payments/admin.functions";
import { Loader2, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payment-logs")({
  component: PaymentLogsPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function PaymentLogsPage() {
  const fetchLogs = useServerFn(listPaymentLogsFn);
  const fetchStatus = useServerFn(gatewayStatusFn);
  const [gateway, setGateway] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");

  const statusQ = useQuery({
    queryKey: ["admin", "gateway-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 15000,
  });

  const logsQ = useQuery({
    queryKey: ["admin", "payment-logs", gateway, eventType],
    queryFn: () => fetchLogs({ data: { gateway, eventType, limit: 150 } }),
    refetchInterval: 10000,
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Gateway health, transaction history, and webhook audit log.</p>
      </div>

      {/* Gateway status grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statusQ.data?.gateways.map((g) => {
          const s = statusQ.data!.stats[g.id] ?? { success: 0, failed: 0, total: 0 };
          return (
            <div key={g.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{g.label}</div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", g.ready ? "bg-emerald-500/15 text-emerald-600" : g.enabled ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground")}>
                  {g.ready ? "Live-ready" : g.enabled ? "Needs secrets" : "Disabled"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-3 capitalize">Mode: {g.mode}</div>
              <div className="space-y-1 text-xs">
                {g.secretsPresent.map((s) => (
                  <div key={s.name} className="flex items-center justify-between font-mono">
                    <span className="truncate">{s.name}</span>
                    {s.set ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {s.total} (24h)</span>
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {s.success}</span>
                <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" /> {s.failed}</span>
              </div>
            </div>
          );
        })}
        {statusQ.isLoading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={gateway} onChange={(e) => setGateway(e.target.value)} className="text-sm px-3 py-2 rounded-md border bg-background">
          <option value="all">All gateways</option>
          <option value="sslcommerz">SSLCommerz</option>
          <option value="bkash">bKash</option>
          <option value="stripe">Stripe</option>
          <option value="nagad">Nagad</option>
          <option value="paypal">PayPal</option>
          <option value="sandbox">Sandbox</option>
        </select>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="text-sm px-3 py-2 rounded-md border bg-background">
          <option value="all">All events</option>
          <option value="init">Init</option>
          <option value="redirect">Redirect</option>
          <option value="ipn">IPN</option>
          <option value="validate">Validate</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="replay">Replay</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Logs table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Gateway</th>
                <th className="text-left p-3">Event</th>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Txn ID</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Sig</th>
              </tr>
            </thead>
            <tbody>
              {logsQ.data?.logs.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="p-3">{row.gateway}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-muted">{row.event_type}</span></td>
                  <td className="p-3 font-mono text-xs">{row.order_number ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{row.transaction_id ?? "—"}</td>
                  <td className="p-3 text-right">{row.amount != null ? formatPriceWithSymbol(Number(row.amount), row.currency_symbol || row.currency) : "—"}</td>
                  <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded", row.status === "VALID" || row.status === "paid" || row.event_type === "success" ? "bg-emerald-500/15 text-emerald-600" : row.event_type === "failed" || row.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted")}>{row.status ?? "—"}</span></td>
                  <td className="p-3">{row.signature_valid == null ? "—" : row.signature_valid ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}</td>
                </tr>
              ))}
              {!logsQ.isLoading && (logsQ.data?.logs.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No payment activity yet.</td></tr>
              )}
              {logsQ.isLoading && (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading logs…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
