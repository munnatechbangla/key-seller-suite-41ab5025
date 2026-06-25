import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { adminListSettingsFn, adminUpsertSettingFn } from "@/lib/admin-settings.functions";
import { defaultSettings, useSettings, type AllSettings } from "@/lib/cms/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { isValidGa4, isValidGtm, isValidMetaPixel } from "@/lib/analytics/track";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type GroupRow = { group_key: string; setting_key: string; value: Record<string, unknown> };

const GROUP_KEYS: Array<{ group: keyof AllSettings; group_key: string; setting_key: string }> = [
  { group: "branding", group_key: "site", setting_key: "branding" },
  { group: "contact", group_key: "site", setting_key: "contact" },
  { group: "seo", group_key: "seo", setting_key: "defaults" },
  { group: "email", group_key: "email", setting_key: "senders" },
  { group: "social", group_key: "social", setting_key: "links" },
  { group: "payment", group_key: "payment", setting_key: "config" },
  { group: "analytics", group_key: "analytics", setting_key: "config" },
];

function AdminSettings() {
  const list = useServerFn(adminListSettingsFn);
  const upsert = useServerFn(adminUpsertSettingFn);
  const reloadStore = useSettings((s) => s.load);
  const [data, setData] = useState<AllSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = (await list()) as GroupRow[];
        const next: AllSettings = JSON.parse(JSON.stringify(defaultSettings));
        for (const r of rows) {
          const map = GROUP_KEYS.find((g) => g.group_key === r.group_key && g.setting_key === r.setting_key);
          if (map) (next as any)[map.group] = { ...(next as any)[map.group], ...r.value };
        }
        setData(next);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [list]);

  async function save(group: keyof AllSettings) {
    const map = GROUP_KEYS.find((g) => g.group === group)!;
    setSaving(group);
    try {
      await upsert({ data: { group_key: map.group_key, setting_key: map.setting_key, value: data[group] as any } });
      toast.success("Saved");
      await reloadStore();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  function set<K extends keyof AllSettings>(group: K, field: keyof AllSettings[K], value: any) {
    setData((d) => ({ ...d, [group]: { ...d[group], [field]: value } }));
  }

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">White-label configuration. Changes apply across the storefront.</p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4 space-y-4">
          <Field label="Site Name" value={data.branding.name} onChange={(v) => set("branding", "name", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand Lead" value={data.branding.brand_lead} onChange={(v) => set("branding", "brand_lead", v)} />
            <Field label="Brand Accent" value={data.branding.brand_accent} onChange={(v) => set("branding", "brand_accent", v)} />
          </div>
          <Field label="Tagline" value={data.branding.tagline} onChange={(v) => set("branding", "tagline", v)} />
          <Area label="Description" value={data.branding.description} onChange={(v) => set("branding", "description", v)} />
          <Field label="Logo URL" value={data.branding.logo_url} onChange={(v) => set("branding", "logo_url", v)} />
          <Field label="Favicon URL" value={data.branding.favicon_url} onChange={(v) => set("branding", "favicon_url", v)} />
          <Field label="Footer Text" value={data.branding.footer_text} onChange={(v) => set("branding", "footer_text", v)} />
          <Field label="Copyright (use {year} and {name})" value={data.branding.copyright} onChange={(v) => set("branding", "copyright", v)} />
          <SaveBtn onClick={() => save("branding")} saving={saving === "branding"} />
        </TabsContent>

        <TabsContent value="contact" className="mt-4 space-y-4">
          <Field label="Support Email" value={data.contact.support_email} onChange={(v) => set("contact", "support_email", v)} />
          <Field label="Phone" value={data.contact.phone} onChange={(v) => set("contact", "phone", v)} />
          <Field label="WhatsApp" value={data.contact.whatsapp} onChange={(v) => set("contact", "whatsapp", v)} />
          <Field label="Telegram" value={data.contact.telegram} onChange={(v) => set("contact", "telegram", v)} />
          <Area label="Address" value={data.contact.address} onChange={(v) => set("contact", "address", v)} />
          <SaveBtn onClick={() => save("contact")} saving={saving === "contact"} />
        </TabsContent>

        <TabsContent value="seo" className="mt-4 space-y-4">
          <Field label="Site Title" value={data.seo.site_title} onChange={(v) => set("seo", "site_title", v)} />
          <Area label="Meta Description" value={data.seo.meta_description} onChange={(v) => set("seo", "meta_description", v)} />
          <Field label="Site URL" value={data.seo.site_url} onChange={(v) => set("seo", "site_url", v)} />
          <Field label="Open Graph Image URL" value={data.seo.og_image} onChange={(v) => set("seo", "og_image", v)} />
          <Field label="Twitter Card Image URL" value={data.seo.twitter_image} onChange={(v) => set("seo", "twitter_image", v)} />
          <Field label="Twitter Handle" value={data.seo.twitter_handle} onChange={(v) => set("seo", "twitter_handle", v)} />
          <SaveBtn onClick={() => save("seo")} saving={saving === "seo"} />
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-4">
          <Field label="Sender Name" value={data.email.sender_name} onChange={(v) => set("email", "sender_name", v)} />
          <Field label="Sender Email" value={data.email.sender_email} onChange={(v) => set("email", "sender_email", v)} />
          <Field label="Support Email" value={data.email.support_email} onChange={(v) => set("email", "support_email", v)} />
          <Field label="Reply-To Email" value={data.email.reply_to} onChange={(v) => set("email", "reply_to", v)} />
          <SaveBtn onClick={() => save("email")} saving={saving === "email"} />
        </TabsContent>

        <TabsContent value="social" className="mt-4 space-y-4">
          <Field label="Facebook URL" value={data.social.facebook} onChange={(v) => set("social", "facebook", v)} />
          <Field label="Twitter / X URL" value={data.social.twitter} onChange={(v) => set("social", "twitter", v)} />
          <Field label="Instagram URL" value={data.social.instagram} onChange={(v) => set("social", "instagram", v)} />
          <Field label="YouTube URL" value={data.social.youtube} onChange={(v) => set("social", "youtube", v)} />
          <Field label="TikTok URL" value={data.social.tiktok} onChange={(v) => set("social", "tiktok", v)} />
          <Field label="LinkedIn URL" value={data.social.linkedin} onChange={(v) => set("social", "linkedin", v)} />
          <SaveBtn onClick={() => save("social")} saving={saving === "social"} />
        </TabsContent>

        <TabsContent value="payment" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency Code" value={data.payment.currency} onChange={(v) => set("payment", "currency", v)} />
            <Field label="Currency Symbol" value={data.payment.currency_symbol} onChange={(v) => set("payment", "currency_symbol", v)} />
          </div>
          <GatewayRow id="sslcommerz" label="SSLCommerz" data={data} set={set} />
          <GatewayRow id="bkash" label="bKash" data={data} set={set} />
          <GatewayRow id="nagad" label="Nagad" data={data} set={set} />
          <GatewayRow id="stripe" label="Stripe" data={data} set={set} />
          <GatewayRow id="paypal" label="PayPal" data={data} set={set} />
          <Toggle label="Rocket enabled" value={data.payment.rocket_enabled} onChange={(v) => set("payment", "rocket_enabled", v)} />
          <Toggle label="Manual payment enabled" value={data.payment.manual_enabled} onChange={(v) => set("payment", "manual_enabled", v)} />
          <Area label="Manual Payment Instructions" value={data.payment.manual_instructions} onChange={(v) => set("payment", "manual_instructions", v)} />
          <SaveBtn onClick={() => save("payment")} saving={saving === "payment"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

type GatewayId = "sslcommerz" | "bkash" | "nagad" | "stripe" | "paypal";
function GatewayRow({ id, label, data, set }: {
  id: GatewayId; label: string; data: AllSettings;
  set: <K extends keyof AllSettings, F extends keyof AllSettings[K]>(g: K, f: F, v: AllSettings[K][F]) => void;
}) {
  const enabledKey = `${id}_enabled` as keyof AllSettings["payment"];
  const modeKey = `${id}_mode` as keyof AllSettings["payment"];
  const enabled = Boolean(data.payment[enabledKey]);
  const mode = (data.payment[modeKey] as "sandbox" | "live") || "sandbox";
  return (
    <div className="flex items-center justify-between rounded-md border p-3 gap-3 flex-wrap">
      <Label className="cursor-pointer flex-1">{label}</Label>
      <select
        value={mode}
        onChange={(e) => set("payment", modeKey, e.target.value as never)}
        className="text-xs px-2 py-1 rounded border bg-background"
      >
        <option value="sandbox">Sandbox</option>
        <option value="live">Live</option>
      </select>
      <Switch checked={enabled} onCheckedChange={(v) => set("payment", enabledKey, v as never)} />
    </div>
  );
}


function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button onClick={onClick} disabled={saving} className="gap-2">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save changes
    </Button>
  );
}
