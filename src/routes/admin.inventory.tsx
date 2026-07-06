import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listInventoryPoolsFn,
  upsertInventoryPoolFn,
  deleteInventoryPoolFn,
  listInventoryItemsFn,
  addInventoryItemFn,
  bulkImportInventoryFn,
  setInventoryItemStatusFn,
  deleteInventoryItemFn,
  exportInventoryFn,
  listInventoryAssignmentsFn,
  releaseAssignmentFn,
  replaceAssignmentFn,
} from "@/lib/inventory.functions";
import { adminListProductsFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Download, Trash2, Ban, CheckCircle2, RefreshCw, Undo2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({ component: AdminInventory });

const INVENTORY_TYPES = [
  { value: "license_key", label: "License Key" },
  { value: "account", label: "Account" },
  { value: "download_token", label: "Download Token" },
  { value: "api_key", label: "API Key" },
  { value: "gift_code", label: "Gift Code" },
  { value: "other", label: "Other" },
];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "available") return "default";
  if (s === "assigned") return "secondary";
  if (s === "disabled" || s === "expired") return "destructive";
  return "outline";
}

function AdminInventory() {
  const listPools = useServerFn(listInventoryPoolsFn);
  const upsertPool = useServerFn(upsertInventoryPoolFn);
  const deletePool = useServerFn(deleteInventoryPoolFn);
  const listProducts = useServerFn(adminListProductsFn);
  const qc = useQueryClient();

  const { data: pools, isLoading } = useQuery({
    queryKey: ["inventory-pools"],
    queryFn: () => listPools(),
  });
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listProducts(),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [activePoolId, setActivePoolId] = useState<string | null>(null);

  const upsertMut = useMutation({
    mutationFn: (v: any) => upsertPool({ data: v }),
    onSuccess: () => {
      toast.success("Pool saved");
      qc.invalidateQueries({ queryKey: ["inventory-pools"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePool({ data: { id } }),
    onSuccess: () => {
      toast.success("Pool deleted");
      qc.invalidateQueries({ queryKey: ["inventory-pools"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (activePoolId) {
    const pool = (pools ?? []).find((p: any) => p.id === activePoolId);
    return <PoolDetail poolId={activePoolId} pool={pool} onBack={() => setActivePoolId(null)} />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{pools?.length ?? 0} pools</p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              name: "",
              description: "",
              inventory_type: "license_key",
              product_id: null,
              is_active: true,
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" /> New pool
        </Button>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pool</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Disabled</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {(pools ?? []).map((p: any) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => setActivePoolId(p.id)}
              >
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{p.inventory_type}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.product_title ?? "—"}
                </TableCell>
                <TableCell>{p.total_items}</TableCell>
                <TableCell>{p.available_items}</TableCell>
                <TableCell>{p.assigned_items}</TableCell>
                <TableCell>{p.disabled_items}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(p)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this pool? Pool must be empty.")) deleteMut.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit pool" : "New pool"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Inventory type</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={editing.inventory_type}
                    onChange={(e) =>
                      setEditing({ ...editing, inventory_type: e.target.value })
                    }
                  >
                    {INVENTORY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Product</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={editing.product_id ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, product_id: e.target.value || null })
                    }
                  >
                    <option value="">— None —</option>
                    {(products ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={upsertMut.isPending || !editing?.name}
              onClick={() => upsertMut.mutate(editing)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PoolDetail({ poolId, pool, onBack }: { poolId: string; pool: any; onBack: () => void }) {
  const listItems = useServerFn(listInventoryItemsFn);
  const addItem = useServerFn(addInventoryItemFn);
  const bulkImport = useServerFn(bulkImportInventoryFn);
  const setStatus = useServerFn(setInventoryItemStatusFn);
  const deleteItem = useServerFn(deleteInventoryItemFn);
  const exportPool = useServerFn(exportInventoryFn);
  const listAssignments = useServerFn(listInventoryAssignmentsFn);
  const release = useServerFn(releaseAssignmentFn);
  const replace = useServerFn(replaceAssignmentFn);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatusFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newItem, setNewItem] = useState({ value: "", username: "", password: "", notes: "" });
  const [importText, setImportText] = useState("");

  const filters = useMemo(
    () => ({
      pool_id: poolId,
      search: search || undefined,
      status: (status || undefined) as any,
      page,
      page_size: 50,
    }),
    [poolId, search, status, page],
  );

  const { data: itemsRes, isLoading } = useQuery({
    queryKey: ["inventory-items", filters],
    queryFn: () => listItems({ data: filters }),
  });

  const { data: assignments } = useQuery({
    queryKey: ["inventory-assignments", poolId, showHistory],
    queryFn: () => listAssignments({ data: { pool_id: poolId } }),
    enabled: showHistory,
  });

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["inventory-items"] }),
      qc.invalidateQueries({ queryKey: ["inventory-pools"] }),
      qc.invalidateQueries({ queryKey: ["inventory-assignments"] }),
    ]);

  const addMut = useMutation({
    mutationFn: () => addItem({ data: { pool_id: poolId, ...newItem } }),
    onSuccess: () => {
      toast.success("Item added");
      setNewItem({ value: "", username: "", password: "", notes: "" });
      setShowAdd(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: () => {
      const items = importText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/[|,\t]/).map((p) => p.trim());
          return {
            value: parts[0] ?? "",
            username: parts[1] || null,
            password: parts[2] || null,
            notes: parts[3] || null,
          };
        })
        .filter((i) => i.value);
      if (!items.length) throw new Error("No items to import");
      return bulkImport({ data: { pool_id: poolId, items } });
    },
    onSuccess: (r: any) => {
      toast.success(`Imported ${r.inserted}, skipped ${r.skipped}`);
      setImportText("");
      setShowImport(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: any }) => setStatus({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteItem({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const releaseMut = useMutation({
    mutationFn: (id: string) => release({ data: { assignment_id: id } }),
    onSuccess: () => {
      toast.success("Released");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const replaceMut = useMutation({
    mutationFn: (id: string) => replace({ data: { assignment_id: id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Replaced");
      else toast.error(r?.reason ?? "Failed");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const doExport = async () => {
    const rows = await exportPool({ data: { pool_id: poolId } });
    const header = ["value", "username", "password", "notes", "status", "created_at"];
    const csv = [
      header.join(","),
      ...rows.map((r: any) =>
        header
          .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pool?.name ?? "inventory"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const items = itemsRes?.items ?? [];
  const total = itemsRes?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pools
          </Button>
          <div>
            <h1 className="text-xl font-bold">{pool?.name ?? "Pool"}</h1>
            <p className="text-xs text-muted-foreground">
              {pool?.inventory_type} • {total} items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide" : "Show"} assignments
          </Button>
          <Button variant="outline" size="sm" onClick={doExport}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-3 w-3 mr-1" /> Bulk import
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search value / username / notes"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="assigned">Assigned</option>
          <option value="disabled">Disabled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {items.map((it: any) => (
              <TableRow key={it.id}>
                <TableCell className="font-mono text-xs max-w-[240px] truncate">{it.value}</TableCell>
                <TableCell className="text-sm">{it.username ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(it.status)}>{it.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {it.assigned_order_id ? it.assigned_order_id.slice(0, 8) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {it.notes ?? ""}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {it.status !== "assigned" && (
                    <>
                      {it.status === "disabled" ? (
                        <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: it.id, status: "available" })}>
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: it.id, status: "disabled" })}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => confirm("Delete item?") && deleteMut.mutate(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No items
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {showHistory && (
        <div className="bg-background rounded-lg border">
          <div className="px-4 py-2 border-b text-sm font-medium">Assignments</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assignments ?? []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{a.orders?.order_number ?? a.order_id?.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">{a.inventory_items?.value ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "outline"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.assigned_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {a.status === "active" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => releaseMut.mutate(a.id)}>
                          <Undo2 className="h-3 w-3 mr-1" /> Release
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => replaceMut.mutate(a.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Replace
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!assignments || assignments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    No assignments yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Value</Label>
              <Input value={newItem.value} onChange={(e) => setNewItem({ ...newItem, value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username (optional)</Label>
                <Input value={newItem.username} onChange={(e) => setNewItem({ ...newItem, username: e.target.value })} />
              </div>
              <div>
                <Label>Password (optional)</Label>
                <Input value={newItem.password} onChange={(e) => setNewItem({ ...newItem, password: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button disabled={!newItem.value || addMut.isPending} onClick={() => addMut.mutate()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              One item per line. Optional format: <code>value|username|password|notes</code> (comma or tab also accepted). Duplicates are skipped.
            </p>
            <Textarea
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"KEY-1\nKEY-2|user@example.com|password123|note"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button disabled={importMut.isPending || !importText.trim()} onClick={() => importMut.mutate()}>
              {importMut.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
