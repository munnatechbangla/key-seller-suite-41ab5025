import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListLicensePoolsFn,
  adminCreatePoolFn,
  adminImportLicenseKeysFn,
  adminListProductsFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/licenses")({ component: AdminLicenses });

function AdminLicenses() {
  const listPools = useServerFn(adminListLicensePoolsFn);
  const listProducts = useServerFn(adminListProductsFn);
  const createPool = useServerFn(adminCreatePoolFn);
  const importKeys = useServerFn(adminImportLicenseKeysFn);
  const qc = useQueryClient();

  const { data: pools, isLoading } = useQuery({ queryKey: ["admin-pools"], queryFn: () => listPools() });
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: () => listProducts() });

  const [newPool, setNewPool] = useState<{ product_id: string; name: string } | null>(null);
  const [importing, setImporting] = useState<{ pool_id: string; product_id: string; text: string } | null>(null);

  const createMut = useMutation({
    mutationFn: (v: any) => createPool({ data: v }),
    onSuccess: () => { toast.success("Pool created"); qc.invalidateQueries({ queryKey: ["admin-pools"] }); setNewPool(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const importMut = useMutation({
    mutationFn: (v: any) => importKeys({ data: v }),
    onSuccess: (r: any) => { toast.success(`Imported ${r.inserted} keys`); qc.invalidateQueries({ queryKey: ["admin-pools"] }); setImporting(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">License Pools</h1>
          <p className="text-sm text-muted-foreground">{pools?.length ?? 0} pools</p>
        </div>
        <Button onClick={() => setNewPool({ product_id: "", name: "" })}><Plus className="h-4 w-4 mr-1" /> New pool</Button>
      </div>
      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pool</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Revoked</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {(pools ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.products?.title ?? p.product_id}</TableCell>
                <TableCell>{p.stats.total}</TableCell>
                <TableCell>{p.stats.available}</TableCell>
                <TableCell>{p.stats.assigned}</TableCell>
                <TableCell>{p.stats.revoked}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setImporting({ pool_id: p.id, product_id: p.product_id, text: "" })}>
                    <Upload className="h-3 w-3 mr-1" /> Import keys
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!newPool} onOpenChange={(v) => !v && setNewPool(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New license pool</DialogTitle></DialogHeader>
          {newPool && (
            <div className="space-y-3">
              <div>
                <Label>Product</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={newPool.product_id} onChange={(e) => setNewPool({ ...newPool, product_id: e.target.value })}>
                  <option value="">Select…</option>
                  {(products ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div><Label>Pool name</Label><Input value={newPool.name} onChange={(e) => setNewPool({ ...newPool, name: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPool(null)}>Cancel</Button>
            <Button disabled={createMut.isPending || !newPool?.product_id || !newPool?.name}
              onClick={() => createMut.mutate(newPool)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importing} onOpenChange={(v) => !v && setImporting(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Import license keys</DialogTitle></DialogHeader>
          {importing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Paste keys, one per line (CSV / TXT compatible).</p>
              <Textarea rows={10} value={importing.text} onChange={(e) => setImporting({ ...importing, text: e.target.value })} placeholder={"KEY-1\nKEY-2\nKEY-3"} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImporting(null)}>Cancel</Button>
            <Button disabled={importMut.isPending} onClick={() => {
              if (!importing) return;
              const keys = importing.text.split(/[\n,]/).map((k) => k.trim()).filter(Boolean);
              if (!keys.length) return toast.error("No keys to import");
              importMut.mutate({ pool_id: importing.pool_id, product_id: importing.product_id, keys });
            }}>{importMut.isPending ? "Importing…" : "Import"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
