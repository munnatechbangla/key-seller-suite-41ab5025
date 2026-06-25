import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { adminClearDataFn, adminSeedDemoFn } from "@/lib/admin-tools.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/demo")({ component: DemoTools });

type Scope = "orders" | "customers" | "reviews" | "coupons" | "licenses" | "all";

function DemoTools() {
  const seed = useServerFn(adminSeedDemoFn);
  const clear = useServerFn(adminClearDataFn);
  const [busy, setBusy] = useState<string | null>(null);

  async function runSeed() {
    setBusy("seed");
    try { const r = await seed(); toast.success(`Seeded ${r.products} demo products`); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }
  async function runClear(scope: Scope) {
    setBusy(scope);
    try {
      const r = await clear({ data: { scope } });
      toast.success(`Cleared: ${JSON.stringify(r.summary)}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  const destructive: Array<{ scope: Scope; label: string; desc: string }> = [
    { scope: "orders", label: "Clear Orders", desc: "Deletes all orders, items, payments, downloads & assignments." },
    { scope: "customers", label: "Clear Customers", desc: "Deletes non-admin customer profiles." },
    { scope: "reviews", label: "Clear Reviews", desc: "Deletes every product review." },
    { scope: "coupons", label: "Clear Coupons", desc: "Deletes coupons and usage records." },
    { scope: "licenses", label: "Clear Licenses", desc: "Deletes all license keys and assignments." },
    { scope: "all", label: "Reset Demo Data", desc: "Wipes orders, customers, reviews, coupons and licenses." },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Demo Data Manager</h1>
        <p className="text-sm text-muted-foreground">Seed sample content or clear data before going live.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Seed demo data</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Creates 3 demo categories and 3 demo products. Safe to re-run.</p>
          <Button onClick={runSeed} disabled={busy === "seed"}>
            {busy === "seed" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Seed
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {destructive.map((d) => (
          <Card key={d.scope}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-sm">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.desc}</div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={busy === d.scope}>
                    {busy === d.scope ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {d.label}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{d.label}?</AlertDialogTitle>
                    <AlertDialogDescription>{d.desc} This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => runClear(d.scope)}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
