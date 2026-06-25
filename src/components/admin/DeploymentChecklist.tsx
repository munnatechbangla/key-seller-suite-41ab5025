import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSettings } from "@/lib/cms/settings";
import { useSetupStatus } from "@/lib/setup";

export function DeploymentChecklist() {
  const s = useSettings((x) => x.settings);
  const { data: setup } = useSetupStatus();

  const items = [
    { label: "Setup completed", done: !!setup?.is_completed, to: "/admin/setup" },
    { label: "Branding configured", done: !!(s.branding.name && s.branding.tagline), to: "/admin/settings" },
    { label: "Email sender configured", done: !!s.email.sender_email, to: "/admin/settings" },
    { label: "Payment method enabled", done: s.payment.manual_enabled || s.payment.sslcommerz_enabled || s.payment.stripe_enabled || s.payment.bkash_enabled || s.payment.paypal_enabled, to: "/admin/gateways" },
    { label: "SEO defaults set", done: !!(s.seo.site_title && s.seo.meta_description && s.seo.site_url), to: "/admin/settings" },
    { label: "Analytics configured", done: s.analytics.ga4_enabled || s.analytics.gtm_enabled || s.analytics.meta_pixel_enabled, to: "/admin/settings" },
  ];
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Deployment checklist <span className="text-xs text-muted-foreground">{pct}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} />
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-sm">
              {i.done
                ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <Link to={i.to} className={i.done ? "text-muted-foreground line-through" : "hover:underline"}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
