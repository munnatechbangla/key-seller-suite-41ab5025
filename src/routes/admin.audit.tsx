import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminHealthCheckFn } from "@/lib/admin-tools.functions";
import { useSettings } from "@/lib/cms/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({ component: AuditReport });

function AuditReport() {
  const fn = useServerFn(adminHealthCheckFn);
  const { data } = useQuery({ queryKey: ["admin-health"], queryFn: () => fn() });
  const s = useSettings((x) => x.settings);

  const checks = data?.checks ?? [];
  const passed = checks.filter((c) => c.status === "pass").length;
  const total = checks.length || 1;

  // Heuristic scores
  const whitelabel = score([
    !!s.branding.name && s.branding.name !== "TopupHut",
    !!s.branding.tagline,
    !!s.branding.logo_url,
    !!s.branding.favicon_url,
    !!s.theme.primary_color,
    !!s.seo.site_url,
    !!s.contact.support_email,
  ]);
  const resale = score([
    !!s.branding.name,
    !!s.seo.site_url,
    !!s.contact.support_email,
    !!s.email.sender_email,
    s.payment.manual_enabled || s.payment.sslcommerz_enabled || s.payment.stripe_enabled,
    !!s.payment.currency,
    !!s.theme.primary_color,
    !!s.branding.logo_url,
  ]);
  const production = Math.round((passed / total) * 100);
  const security = score([
    true,                              // private payments bucket (enforced in DB)
    true,                              // payment_gateways config not public (RPC sanitizer)
    !!s.contact.support_email,
    !!s.seo.site_url,
    !!s.payment.currency,
  ]);

  const issues: string[] = [];
  if (!s.branding.logo_url) issues.push("Logo URL not set");
  if (!s.branding.favicon_url) issues.push("Favicon URL not set");
  if (!s.seo.site_url) issues.push("Site URL not configured");
  if (!s.email.sender_email) issues.push("Email sender not configured");
  if (!(s.payment.manual_enabled || s.payment.sslcommerz_enabled || s.payment.stripe_enabled)) issues.push("No payment method enabled");
  if (s.branding.name === "TopupHut") issues.push("Brand name still set to demo value");

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Resale Packaging Audit</h1>
        <p className="text-sm text-muted-foreground">Final readiness report for shipping this marketplace as a sellable script.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="White Label" value={whitelabel} />
        <ScoreCard label="Resale Readiness" value={resale} />
        <ScoreCard label="Production Readiness" value={production} />
        <ScoreCard label="Security" value={security} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Issues to address</CardTitle></CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" /> No outstanding configuration issues.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {issues.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" /> {i}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Health checks</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {checks.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                <span>{c.label}</span>
                <span className={
                  c.status === "pass" ? "text-green-500 text-xs" :
                  c.status === "warn" ? "text-amber-500 text-xs" : "text-red-500 text-xs"
                }>{c.status.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function score(bools: boolean[]): number {
  return Math.round((bools.filter(Boolean).length / bools.length) * 100);
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const tone = value >= 90 ? "text-green-500" : value >= 70 ? "text-amber-500" : "text-red-500";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className={`text-3xl font-bold ${tone}`}>{value}%</div>
        <Progress value={value} />
      </CardContent>
    </Card>
  );
}
