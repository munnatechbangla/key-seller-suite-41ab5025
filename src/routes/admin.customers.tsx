import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListCustomersFn } from "@/lib/admin.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const list = useServerFn(adminListCustomersFn);
  const { data, isLoading } = useQuery({ queryKey: ["admin-customers"], queryFn: () => list() });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} customers</p>
      </div>
      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Spent</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {(data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarImage src={c.avatar_url ?? undefined} /><AvatarFallback>{(c.full_name ?? c.email ?? "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="font-medium">{c.full_name ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                <TableCell>{c.orders}</TableCell>
                <TableCell>${Number(c.spent).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
