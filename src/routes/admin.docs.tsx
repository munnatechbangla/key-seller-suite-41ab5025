import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/cms/settings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/docs")({ component: DocsGenerator });

function DocsGenerator() {
  const s = useSettings((x) => x.settings);
  const brand = s.branding.name || "Your Marketplace";
  const url = s.seo.site_url || "https://yourdomain.com";
  const email = s.contact.support_email || "support@yourdomain.com";

  const docs = useMemo(() => ({
    installation: `# ${brand} — Installation Guide

## Requirements
- A Lovable Cloud project (database + auth + storage)
- A registered domain name

## Steps
1. Deploy the script via Lovable.
2. Open \`${url}/setup\` in your browser.
3. Complete the Setup Wizard.
4. Configure payment gateways in **Admin → Gateways**.
5. Connect an email sender domain to enable transactional emails.
`,
    setup: `# Setup Wizard Guide

The Setup Wizard runs on first launch and walks you through:

1. **Admin Account** — creates the first admin user.
2. **Brand** — site name (\`${brand}\`), tagline, logo, favicon.
3. **Site** — site URL (\`${url}\`), currency (${s.payment.currency}).
4. **Contact** — support email (\`${email}\`), phone, WhatsApp.
5. **SEO** — meta title and description used as defaults.
6. **Finish** — saves and unlocks the storefront.

You can revisit the wizard any time from **Admin → Setup Wizard**.
`,
    payments: `# Payment Gateway Guide

Built-in adapters: SSLCommerz, bKash, Nagad, Rocket, Stripe, PayPal.
Plus: Custom Automatic Gateway and Manual Payment.

## Enable a gateway
1. Open **Admin → Gateways**.
2. Toggle the gateway you want.
3. Fill in credentials (kept server-side as secrets).
4. Use **Test connection** for automatic gateways.

## Manual gateway
Configure instructions and bank/wallet info; customers submit a transaction ID
and screenshot, then an admin approves in **Admin → Payments**.

Current currency: **${s.payment.currency} (${s.payment.currency_symbol})**.
`,
    email: `# Email Setup Guide

Emails run in **dev mode** until a sender domain is connected.

## Connect a sender
1. Add a custom domain in Lovable.
2. Delegate the NS records as instructed.
3. Set **Admin → Settings → Email** sender values:
   - Sender name: \`${s.email.sender_name || brand}\`
   - Sender email: \`${s.email.sender_email || "no-reply@yourdomain.com"}\`
4. Verify by triggering a test from **Admin → Email Logs**.

## Templates
Edit the 7 transactional templates from **Admin → Templates**.
`,
    whitelabel: `# White Label Guide

Everything that identifies the brand lives in **Admin → Settings**:

- **Branding** — name, tagline, logo, favicon, footer text, copyright.
- **Theme** — primary / secondary / accent colors and font family.
- **Legal Pages** — Privacy, Terms, Refund, FAQ (editable from **Admin → Legal Pages**).
- **SEO** — meta title, description, OG image.
- **Analytics** — GA4, GTM, Meta Pixel.

No source-code edits are required to rebrand. \`VITE_APP_SLUG\` controls
localStorage namespacing if you need to host multiple instances side-by-side.
`,
    admin: `# Admin User Guide

Sections:
- **Dashboard** — KPIs, setup status, deployment checklist.
- **Products / Categories** — CRUD with bulk actions.
- **Orders** — view, refund, resend delivery.
- **Customers** — list with role management.
- **Licenses** — bulk import of license keys.
- **Coupons** — percent / fixed / product-targeted.
- **Reviews** — moderation queue.
- **Payments / Gateways** — logs and configuration.
- **Email Logs / Templates** — observability and editing.
- **Legal Pages** — rich content editor with publish/draft.
- **Setup Wizard / Settings** — system configuration.
- **System** — Health Check, Demo Data, Documentation, Audit.
`,
  }), [brand, url, email, s.payment.currency, s.payment.currency_symbol, s.email.sender_name, s.email.sender_email]);

  const tabs = [
    { id: "installation", label: "Installation" },
    { id: "setup", label: "Setup Wizard" },
    { id: "payments", label: "Payments" },
    { id: "email", label: "Email" },
    { id: "whitelabel", label: "White Label" },
    { id: "admin", label: "Admin Guide" },
  ] as const;
  const [active, setActive] = useState<typeof tabs[number]["id"]>("installation");
  const content = docs[active];

  function copy() { navigator.clipboard.writeText(content); toast.success("Copied"); }
  function download() {
    const blob = new Blob([content], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${active}.md`;
    a.click();
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-sm text-muted-foreground">Auto-generated from your live settings.</p>
      </div>
      <Tabs value={active} onValueChange={(v) => setActive(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="space-y-3">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4 mr-2" /> Copy</Button>
              <Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4 mr-2" /> Download</Button>
            </div>
            <pre className="rounded-lg border bg-muted/30 p-4 text-xs whitespace-pre-wrap font-mono overflow-auto max-h-[60vh]">{docs[t.id]}</pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
