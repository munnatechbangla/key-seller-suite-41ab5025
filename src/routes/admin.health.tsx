import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { adminHealthCheckFn } from "@/lib/admin-tools.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/health")({ component: HealthCheck });

const ICONS = {
  pass: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  warn: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  fail: <XCircle className="h-5 w-5 text-red-500" />,
};

function HealthCheck() {
  const fn = useServerFn(adminHealthCheckFn);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => fn(),
  });

  const checks = data?.checks ?? [];
  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health Check</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `Last run: ${new Date(data.generatedAt).toLocaleString()}` : "Running diagnostics…"}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Re-run
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Passed" value={passed} tone="text-green-500" />
        <Stat label="Warnings" value={warned} tone="text-amber-500" />
        <Stat label="Failed" value={failed} tone="text-red-500" />
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Running checks…</p>}
        {checks.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="mt-0.5">{ICONS[c.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                {c.detail && <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>}
                {c.fix && c.status !== "pass" && (
                  <div className="text-xs mt-1.5"><span className="text-muted-foreground">Fix:</span> {c.fix}</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </CardContent></Card>
  );
}
