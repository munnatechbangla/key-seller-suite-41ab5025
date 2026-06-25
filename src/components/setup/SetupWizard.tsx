import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/stores";
import { adminUpsertSettingFn } from "@/lib/admin-settings.functions";
import { claimFirstAdmin, markSetupComplete, useSetupStatus } from "@/lib/setup";
import { defaultSettings, useSettings, type AllSettings } from "@/lib/cms/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STEPS = [
  "Admin Account",
  "Brand",
  "Site",
  "Contact",
  "SEO",
  "Finish",
] as const;

export function SetupWizard({
  mode = "first-run",
  onCompleted,
}: {
  mode?: "first-run" | "revisit";
  onCompleted?: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const initAuth = useAuth((s) => s.init);
  const settings = useSettings((s) => s.settings);
  const loadSettings = useSettings((s) => s.load);
  const upsert = useServerFn(adminUpsertSettingFn);
  const { data: status, refetch } = useSetupStatus();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [data, setData] = useState<AllSettings>(settings);

  useEffect(() => { initAuth(); }, [initAuth]);
  useEffect(() => { setData(settings); }, [settings]);

  // Detect admin role for current user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!cancelled) setIsAdmin(Boolean(data));
    })();
    return () => { cancelled = true; };
  }, [user]);

  // In revisit mode, skip the admin step entirely
  const effectiveSteps = useMemo(
    () => (mode === "revisit" ? STEPS.slice(1) : STEPS),
    [mode],
  );
  const totalSteps = effectiveSteps.length;
  const currentLabel = effectiveSteps[step];

  function setField<K extends keyof AllSettings>(group: K, field: keyof AllSettings[K], value: any) {
    setData((d) => ({ ...d, [group]: { ...d[group], [field]: value } }));
  }

  async function handleCreateAdmin() {
    if (!adminEmail || !adminPassword) {
      toast.error("Email and password are required");
      return;
    }
    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: { emailRedirectTo: `${window.location.origin}/setup` },
      });
      if (signUpErr && !/already/i.test(signUpErr.message)) throw signUpErr;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (signInErr) throw signInErr;
      const res = await claimFirstAdmin();
      if (!res.ok) throw new Error(res.reason ?? "Could not claim admin role");
      toast.success("Admin account ready");
      setIsAdmin(true);
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create admin");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimExisting() {
    if (!user) { toast.error("Sign in first"); return; }
    setBusy(true);
    try {
      const res = await claimFirstAdmin();
      if (!res.ok) throw new Error(res.reason ?? "Cannot claim admin");
      toast.success("Admin role granted");
      setIsAdmin(true);
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function persist(group_key: string, setting_key: string, value: Record<string, unknown>) {
    await upsert({ data: { group_key, setting_key, value } });
  }

  async function finishSetup() {
    if (!isAdmin) { toast.error("Admin role required"); return; }
    setBusy(true);
    try {
      await persist("site", "branding", data.branding as any);
      await persist("site", "contact", data.contact as any);
      await persist("seo", "defaults", data.seo as any);
      await persist("payment", "config", data.payment as any);
      const res = await markSetupComplete();
      if (!res.ok) throw new Error(res.error);
      await Promise.all([loadSettings(), refetch()]);
      toast.success("Setup complete");
      onCompleted?.();
      if (mode === "first-run") navigate({ to: "/admin" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to finish setup");
    } finally {
      setBusy(false);
    }
  }

  // Render
  const isAdminStep = mode === "first-run" && step === 0;
  const showFinish = currentLabel === "Finish";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-background border rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Setup Wizard</h1>
            <div className="text-xs text-muted-foreground">
              Step {step + 1} of {totalSteps}
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="mt-3 text-sm font-medium">{currentLabel}</div>
          {status?.is_completed && mode === "first-run" && (
            <p className="mt-2 text-xs text-amber-500">
              Setup was already completed. You can continue editing, but the redirect gate is off.
            </p>
          )}
        </div>

        <div className="p-6 min-h-[280px] space-y-4">
          {isAdminStep && !isAdmin && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create the first admin account. This becomes the marketplace owner.
              </p>
              {user ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  Signed in as <span className="font-medium">{user.email}</span>.
                  <Button className="ml-3" size="sm" onClick={handleClaimExisting} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Make me admin
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="At least 8 characters" />
                  </div>
                  <Button onClick={handleCreateAdmin} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create admin
                  </Button>
                </div>
              )}
            </div>
          )}

          {isAdminStep && isAdmin && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="h-5 w-5" /> Admin account ready ({user?.email}).
            </div>
          )}

          {currentLabel === "Brand" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Site Name">
                <Input value={data.branding.name} onChange={(e) => setField("branding", "name", e.target.value)} />
              </Field>
              <Field label="Tagline">
                <Input value={data.branding.tagline} onChange={(e) => setField("branding", "tagline", e.target.value)} />
              </Field>
              <Field label="Logo URL">
                <Input value={data.branding.logo_url} onChange={(e) => setField("branding", "logo_url", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Favicon URL">
                <Input value={data.branding.favicon_url} onChange={(e) => setField("branding", "favicon_url", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea value={data.branding.description} onChange={(e) => setField("branding", "description", e.target.value)} rows={3} />
              </Field>
            </div>
          )}

          {currentLabel === "Site" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Site URL" className="md:col-span-2">
                <Input value={data.seo.site_url} onChange={(e) => setField("seo", "site_url", e.target.value)} placeholder="https://yourdomain.com" />
              </Field>
              <Field label="Currency Code">
                <Input value={data.payment.currency} onChange={(e) => setField("payment", "currency", e.target.value.toUpperCase())} placeholder="USD" />
              </Field>
              <Field label="Currency Symbol">
                <Input value={data.payment.currency_symbol} onChange={(e) => setField("payment", "currency_symbol", e.target.value)} placeholder="$" />
              </Field>
              <Field label="Timezone" className="md:col-span-2">
                <Input
                  value={(data.seo as any).timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={(e) => setData((d) => ({ ...d, seo: { ...d.seo, ...(d.seo as any), } }))}
                  placeholder="UTC"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Detected from browser: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </Field>
            </div>
          )}

          {currentLabel === "Contact" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Support Email">
                <Input type="email" value={data.contact.support_email} onChange={(e) => setField("contact", "support_email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={data.contact.phone} onChange={(e) => setField("contact", "phone", e.target.value)} />
              </Field>
              <Field label="WhatsApp">
                <Input value={data.contact.whatsapp} onChange={(e) => setField("contact", "whatsapp", e.target.value)} />
              </Field>
              <Field label="Telegram">
                <Input value={data.contact.telegram} onChange={(e) => setField("contact", "telegram", e.target.value)} />
              </Field>
              <Field label="Business Address" className="md:col-span-2">
                <Textarea value={data.contact.address} onChange={(e) => setField("contact", "address", e.target.value)} rows={2} />
              </Field>
            </div>
          )}

          {currentLabel === "SEO" && (
            <div className="space-y-3">
              <Field label="Meta Title">
                <Input value={data.seo.site_title} onChange={(e) => setField("seo", "site_title", e.target.value)} />
              </Field>
              <Field label="Meta Description">
                <Textarea value={data.seo.meta_description} onChange={(e) => setField("seo", "meta_description", e.target.value)} rows={3} />
              </Field>
              <Field label="OG Image URL">
                <Input value={data.seo.og_image} onChange={(e) => setField("seo", "og_image", e.target.value)} placeholder="https://…" />
              </Field>
            </div>
          )}

          {showFinish && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <div className="font-medium">Ready to launch</div>
                  <div className="text-muted-foreground text-xs mt-1">
                    Brand, site, contact and SEO settings will be saved. The redirect gate will turn off and visitors will land on your storefront.
                  </div>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Brand: {data.branding.name}</li>
                <li>Site URL: {data.seo.site_url || "(not set)"}</li>
                <li>Currency: {data.payment.currency} ({data.payment.currency_symbol})</li>
                <li>Support email: {data.contact.support_email || "(not set)"}</li>
              </ul>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          {!showFinish ? (
            <Button
              onClick={() => {
                if (isAdminStep && !isAdmin) {
                  toast.error("Create or claim the admin account first");
                  return;
                }
                setStep((s) => Math.min(totalSteps - 1, s + 1));
              }}
              disabled={busy}
            >
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={finishSetup} disabled={busy || !isAdmin}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Finish setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// Avoid lint of unused import in some paths
void defaultSettings;
