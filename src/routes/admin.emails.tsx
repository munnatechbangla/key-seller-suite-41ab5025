import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListEmailLogsFn, adminRetryEmailFn, adminProcessQueueFn, adminSendTestEmailFn } from "@/lib/emails/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/emails")({ component: EmailLogsPage });

const statusColors: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-700",
  pending: "bg-amber-500/15 text-amber-700",
  failed: "bg-rose-500/15 text-rose-700",
  skipped: "bg-muted text-muted-foreground",
};

function EmailLogsPage() {
  const list = useServerFn(adminListEmailLogsFn);
  const retry = useServerFn(adminRetryEmailFn);
  const process = useServerFn(adminProcessQueueFn);
  const sendTest = useServerFn(adminSendTestEmailFn);
  const [status, setStatus] = useState<string>("");
  const [testTo, setTestTo] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-logs", status],
    queryFn: () => list({ data: { status: status || undefined, limit: 200 } }),
  });

  const retryM = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: () => {
      toast.success("Re-queued");
      qc.invalidateQueries({ queryKey: ["admin-email-logs"] });
    },
  });

  const processM = useMutation({
    mutationFn: () => process(),
    onSuccess: (r: any) => {
      toast.success(r?.reason === "dev_mode" ? "Dev mode — sending disabled" : `Processed ${r?.processed ?? 0}`);
      qc.invalidateQueries({ queryKey: ["admin-email-logs"] });
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Email Logs</h1>
          <p className="text-sm text-muted-foreground">
            Sending is in development mode until a sender domain is configured in Settings → Email.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm"
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <Button onClick={() => processM.mutate()} disabled={processM.isPending}>
            Process queue
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Template</th>
              <th className="p-3">Recipient</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Status</th>
              <th className="p-3">Error</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-4 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && (!data || data.length === 0) && (
              <tr><td colSpan={7} className="p-4 text-muted-foreground">No emails yet.</td></tr>
            )}
            {data?.map((row: any) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                <td className="p-3 font-mono text-xs">{row.template_key}</td>
                <td className="p-3">{row.recipient}</td>
                <td className="p-3 max-w-[280px] truncate">{row.subject}</td>
                <td className="p-3">
                  <Badge className={statusColors[row.status] ?? ""}>{row.status}</Badge>
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-[220px] truncate">{row.error_message ?? ""}</td>
                <td className="p-3 text-right">
                  {(row.status === "failed" || row.status === "skipped") && (
                    <Button size="sm" variant="outline" onClick={() => retryM.mutate(row.id)}>
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
