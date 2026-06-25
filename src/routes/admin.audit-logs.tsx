import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListAuditLogsFn, adminExportAuditLogsCsvFn } from "@/lib/audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/audit-logs")({ component: Page });

function Page() {
  const list = useServerFn(adminListAuditLogsFn);
  const exportCsv = useServerFn(adminExportAuditLogsCsvFn);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-audit-logs", search, action, entityType],
    queryFn: () =>
      list({
        data: {
          search: search || undefined,
          action: action || undefined,
          entityType: entityType || undefined,
          limit: 300,
        },
      }),
  });

  async function download() {
    const { csv } = await exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between gap-4 flex-wrap items-end">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">All admin actions across the marketplace.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search email / entity / action" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
          <Input placeholder="action" value={action} onChange={(e) => setAction(e.target.value)} className="w-40" />
          <Input placeholder="entity_type" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
          <Button onClick={download}>Export CSV</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">ID</th>
              <th className="p-3">IP</th>
              <th className="p-3">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (!data || data.length === 0) && (
              <tr><td colSpan={7} className="p-4 text-muted-foreground">No audit entries yet.</td></tr>
            )}
            {data?.map((row: any) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap text-xs">{new Date(row.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{row.actor_email ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{row.action}</td>
                <td className="p-3 text-xs">{row.entity_type}</td>
                <td className="p-3 font-mono text-xs">{row.entity_id ?? ""}</td>
                <td className="p-3 text-xs">{row.ip_address ?? ""}</td>
                <td className="p-3 text-xs max-w-[280px]">
                  <pre className="whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                    {row.metadata ? JSON.stringify(row.metadata) : ""}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
