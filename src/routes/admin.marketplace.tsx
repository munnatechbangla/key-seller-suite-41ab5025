import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { adminUpsertSettingFn } from "@/lib/admin-settings.functions";
import { defaultMarketplace, useMarketplace, type MarketplaceConfig } from "@/lib/cms/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/marketplace")({ component: AdminMarketplace });

function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input aria-label={label} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (b: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AdminMarketplace() {
  const upsert = useServerFn(adminUpsertSettingFn);
  const load = useMarketplace((s) => s.load);
  const setLocal = useMarketplace((s) => s.setLocal);
  const stored = useMarketplace((s) => s.config);

  const [cfg, setCfg] = useState<MarketplaceConfig>(defaultMarketplace);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCfg(stored); }, [stored]);

  const patch = (p: Partial<MarketplaceConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchRP = (p: Partial<MarketplaceConfig["recently_purchased"]>) => patch({ recently_purchased: { ...cfg.recently_purchased, ...p } });
  const patchLV = (p: Partial<MarketplaceConfig["live_visitors"]>)      => patch({ live_visitors: { ...cfg.live_visitors, ...p } });
  const patchSP = <K extends keyof MarketplaceConfig["social_proof"]>(k: K, p: Partial<MarketplaceConfig["social_proof"][K]>) =>
    patch({ social_proof: { ...cfg.social_proof, [k]: { ...cfg.social_proof[k], ...p } } });

  const onSave = async () => {
    setSaving(true);
    try {
      await upsert({ data: { group_key: "marketplace", setting_key: "config", value: cfg as any } });
      setLocal(cfg);
      toast.success("Marketplace settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Marketplace & Conversion</h1>
          <p className="text-sm text-muted-foreground">Configure social proof, live visitors and sales badges.</p>
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
      </div>

      <Tabs defaultValue="popup" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="popup">Recent Purchase Popup</TabsTrigger>
          <TabsTrigger value="visitors">Live Visitors</TabsTrigger>
          <TabsTrigger value="badges">Sales Badges</TabsTrigger>
          <TabsTrigger value="ui">UI</TabsTrigger>
        </TabsList>

        <TabsContent value="popup" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <ToggleRow label="Enable popup"        checked={cfg.recently_purchased.enabled}        onChange={(v) => patchRP({ enabled: v })} />
            <ToggleRow label="Demo data mode"      checked={cfg.recently_purchased.demo_mode}      onChange={(v) => patchRP({ demo_mode: v })} hint="Use simulated names until real sales exist" />
            <ToggleRow label="Show country"        checked={cfg.recently_purchased.show_country}   onChange={(v) => patchRP({ show_country: v })} />
            <ToggleRow label="Stay closed after dismiss" checked={cfg.recently_purchased.hide_after_close} onChange={(v) => patchRP({ hide_after_close: v })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <NumberField label="Min delay (s)"      value={cfg.recently_purchased.min_delay_seconds} onChange={(n) => patchRP({ min_delay_seconds: n })} min={2} />
            <NumberField label="Max delay (s)"      value={cfg.recently_purchased.max_delay_seconds} onChange={(n) => patchRP({ max_delay_seconds: n })} min={3} />
            <NumberField label="Display time (s)"   value={cfg.recently_purchased.display_seconds}   onChange={(n) => patchRP({ display_seconds: n })} min={2} />
          </div>
        </TabsContent>

        <TabsContent value="visitors" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <ToggleRow label="Enable on product pages" checked={cfg.live_visitors.enabled_product} onChange={(v) => patchLV({ enabled_product: v })} />
            <ToggleRow label="Enable on homepage"      checked={cfg.live_visitors.enabled_home}    onChange={(v) => patchLV({ enabled_home: v })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <NumberField label="Min visitors"    value={cfg.live_visitors.min_visitors}    onChange={(n) => patchLV({ min_visitors: n })} min={1} />
            <NumberField label="Max visitors"    value={cfg.live_visitors.max_visitors}    onChange={(n) => patchLV({ max_visitors: n })} min={2} />
            <NumberField label="Refresh (s)"     value={cfg.live_visitors.refresh_seconds} onChange={(n) => patchLV({ refresh_seconds: n })} min={3} />
          </div>
          <TextField label="Text template" placeholder="{n} people are viewing this right now"
            value={cfg.live_visitors.text_template} onChange={(v) => patchLV({ text_template: v })} />
        </TabsContent>

        <TabsContent value="badges" className="mt-4 space-y-6">
          {(["sold_count","low_stock","bestseller","trending","new_arrival"] as const).map((key) => {
            const b: any = cfg.social_proof[key];
            return (
              <div key={key} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold capitalize">{key.replace("_", " ")}</div>
                  <Switch checked={b.enabled} onCheckedChange={(v) => patchSP(key, { enabled: v } as any)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <TextField label="Label" value={b.label} onChange={(v) => patchSP(key, { label: v } as any)} placeholder="Use {n} for the number" />
                  <ColorField label="Background" value={b.color} onChange={(v) => patchSP(key, { color: v } as any)} />
                  <ColorField label="Text color" value={b.text_color} onChange={(v) => patchSP(key, { text_color: v } as any)} />
                  {("threshold" in b) && (
                    <NumberField label="Threshold" value={b.threshold} onChange={(n) => patchSP(key, { threshold: n } as any)} />
                  )}
                  {("days" in b) && (
                    <NumberField label="Days considered new" value={b.days} onChange={(n) => patchSP(key, { days: n } as any)} />
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="ui" className="mt-4 space-y-4">
          <NumberField label="Animation speed (ms)" value={cfg.ui.animation_speed_ms} onChange={(n) => patch({ ui: { ...cfg.ui, animation_speed_ms: n } })} min={50} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
