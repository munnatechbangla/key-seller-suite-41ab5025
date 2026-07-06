import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getSubscriptionDashboardFn,
  listSubscriptionAccountsFn,
  upsertSubscriptionAccountFn,
  deleteSubscriptionAccountFn,
  revealSubscriptionCredentialsFn,
  bulkImportSubscriptionAccountsFn,
  listSubscriptionProfilesFn,
  upsertSubscriptionProfileFn,
  deleteSubscriptionProfileFn,
  listSubscriptionAssignmentsFn,
  listSubscriptionLogsFn,
  releaseSubscriptionAssignmentFn,
  replaceSubscriptionAssignmentFn,
  markSubscriptionExpiredFn,
  addSubscriptionNoteFn,
  extendSubscriptionFn,
  renewSubscriptionFn,
  suspendSubscriptionFn,
  resumeSubscriptionFn,
  cancelSubscriptionFn,
  evaluateSubscriptionStatusFn,
  getSubscriptionRenewalHistoryFn,
} from "@/lib/subscriptions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Eye, KeyRound, Plus, Trash2, Upload, Users } from "lucide-react";

export const Route = createFileRoute("/admin/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Manage subscription accounts, profiles and assignments.
        </p>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="pt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="accounts" className="pt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="profiles" className="pt-4">
          <ProfilesTab />
        </TabsContent>
        <TabsContent value="assignments" className="pt-4">
          <AssignmentsTab />
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function DashboardTab() {
  const fn = useServerFn(getSubscriptionDashboardFn);
  const { data } = useQuery({
    queryKey: ["sub-dashboard"],
    queryFn: () => fn() as Promise<Record<string, number>>,
  });
  const d = data ?? {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Total Accounts" value={d.total_accounts ?? 0} />
      <Stat label="Available" value={d.available ?? 0} tone="text-green-600" />
      <Stat label="Assigned" value={d.assigned ?? 0} />
      <Stat label="Expiring Soon" value={d.expiring_soon ?? 0} tone="text-orange-500" />
      <Stat label="Expired" value={d.expired ?? 0} tone="text-red-600" />
      <Stat label="Disabled" value={d.disabled ?? 0} tone="text-muted-foreground" />
      <Stat label="Maintenance" value={d.maintenance ?? 0} />
      <Stat label="Replacement Queue" value={d.replacement_queue ?? 0} tone="text-orange-500" />
    </div>
  );
}

type Account = {
  id: string;
  product_id: string | null;
  provider: string | null;
  account_email: string;
  recovery_email: string | null;
  status: string;
  maximum_profiles: number;
  used_profiles: number;
  expiry_date: string | null;
  two_factor_enabled: boolean;
  notes: string | null;
};

function statusTone(s: string) {
  if (s === "available") return "bg-green-500/15 text-green-600";
  if (s === "assigned") return "bg-blue-500/15 text-blue-600";
  if (s === "expired") return "bg-red-500/15 text-red-600";
  if (s === "maintenance") return "bg-orange-500/15 text-orange-600";
  return "bg-muted text-muted-foreground";
}

function AccountsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubscriptionAccountsFn);
  const upsertFn = useServerFn(upsertSubscriptionAccountFn);
  const deleteFn = useServerFn(deleteSubscriptionAccountFn);
  const revealFn = useServerFn(revealSubscriptionCredentialsFn);
  const importFn = useServerFn(bulkImportSubscriptionAccountsFn);

  const [search, setSearch] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["sub-accounts", search],
    queryFn: () => listFn({ data: { search: search || undefined } }) as Promise<Account[]>,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Account> & {
    account_password?: string;
    recovery_password?: string;
  }>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");

  const save = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      toast.success("Account saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-accounts"] });
      qc.invalidateQueries({ queryKey: ["sub-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["sub-accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function reveal(id: string) {
    try {
      const r = (await revealFn({ data: { id } })) as {
        account_password: string | null;
        recovery_password: string | null;
      };
      toast.message("Credentials", {
        description: `Password: ${r.account_password ?? "—"}${
          r.recovery_password ? `\nRecovery: ${r.recovery_password}` : ""
        }`,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const doImport = useMutation({
    mutationFn: () => {
      const rows = importCsv
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [account_email, account_password, recovery_email, recovery_password] = l
            .split(",")
            .map((s) => s?.trim());
          return { account_email, account_password, recovery_email, recovery_password };
        });
      return importFn({ data: { rows } });
    },
    onSuccess: (r: any) => {
      toast.success(`Imported ${r.inserted} accounts`);
      setImportOpen(false);
      setImportCsv("");
      qc.invalidateQueries({ queryKey: ["sub-accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Bulk Import
        </Button>
        <Button
          onClick={() => {
            setEditing({});
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> New Account
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider / Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Profiles</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No subscription accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.account_email}</div>
                    <div className="text-xs text-muted-foreground">{a.provider ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusTone(a.status)}>{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {a.used_profiles} / {a.maximum_profiles}
                  </TableCell>
                  <TableCell>
                    {a.expiry_date ? new Date(a.expiry_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>{a.two_factor_enabled ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => reveal(a.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this account?")) del.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit" : "New"} Subscription Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider</Label>
                <Input
                  value={editing.provider ?? ""}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  placeholder="Netflix, ChatGPT…"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={editing.status ?? "available"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  {["available", "assigned", "expired", "disabled", "maintenance"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Account Email *</Label>
              <Input
                value={editing.account_email ?? ""}
                onChange={(e) => setEditing({ ...editing, account_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Account Password {editing.id ? "(leave blank to keep)" : "*"}</Label>
              <Input
                type="password"
                value={editing.account_password ?? ""}
                onChange={(e) => setEditing({ ...editing, account_password: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Recovery Email</Label>
                <Input
                  value={editing.recovery_email ?? ""}
                  onChange={(e) => setEditing({ ...editing, recovery_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Recovery Password</Label>
                <Input
                  type="password"
                  value={editing.recovery_password ?? ""}
                  onChange={(e) => setEditing({ ...editing, recovery_password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Profiles</Label>
                <Input
                  type="number"
                  min={1}
                  value={editing.maximum_profiles ?? 1}
                  onChange={(e) =>
                    setEditing({ ...editing, maximum_profiles: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={editing.expiry_date ? editing.expiry_date.slice(0, 10) : ""}
                  onChange={(e) => setEditing({ ...editing, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="tfa"
                type="checkbox"
                checked={!!editing.two_factor_enabled}
                onChange={(e) =>
                  setEditing({ ...editing, two_factor_enabled: e.target.checked })
                }
              />
              <Label htmlFor="tfa" className="!m-0">
                Two-factor enabled
              </Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !editing.account_email}
              onClick={() => save.mutate(editing)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Accounts</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            One per line: <code>email,password,recovery_email,recovery_password</code>
          </p>
          <Textarea
            rows={10}
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            placeholder="user@example.com,pass123,recovery@example.com,rec456"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={doImport.isPending || !importCsv.trim()}
              onClick={() => doImport.mutate()}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Profile = {
  id: string;
  subscription_account_id: string;
  profile_name: string;
  pin_code: string | null;
  avatar: string | null;
  slot_number: number | null;
  status: string;
};

function ProfilesTab() {
  const qc = useQueryClient();
  const acctsFn = useServerFn(listSubscriptionAccountsFn);
  const listFn = useServerFn(listSubscriptionProfilesFn);
  const upsertFn = useServerFn(upsertSubscriptionProfileFn);
  const deleteFn = useServerFn(deleteSubscriptionProfileFn);

  const [accountId, setAccountId] = useState<string>("");
  const { data: accounts = [] } = useQuery({
    queryKey: ["sub-accounts", ""],
    queryFn: () => acctsFn({ data: {} }) as Promise<Account[]>,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["sub-profiles", accountId],
    queryFn: () =>
      listFn({ data: accountId ? { account_id: accountId } : {} }) as Promise<Profile[]>,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Profile>>({});
  const save = useMutation({
    mutationFn: (p: any) => upsertFn({ data: p }),
    onSuccess: () => {
      toast.success("Profile saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-profiles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-profiles"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_email}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEditing({ subscription_account_id: accountId || accounts[0]?.id });
            setOpen(true);
          }}
          disabled={accounts.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" /> New Profile
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profile</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No profiles.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {p.profile_name}
                    </div>
                  </TableCell>
                  <TableCell>{p.slot_number ?? "—"}</TableCell>
                  <TableCell>{p.pin_code ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={statusTone(p.status)}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete profile?")) del.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit" : "New"} Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Account</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={editing.subscription_account_id ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, subscription_account_id: e.target.value })
                }
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Profile Name *</Label>
              <Input
                value={editing.profile_name ?? ""}
                onChange={(e) => setEditing({ ...editing, profile_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Slot #</Label>
                <Input
                  type="number"
                  value={editing.slot_number ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, slot_number: Number(e.target.value) || null })
                  }
                />
              </div>
              <div>
                <Label>PIN</Label>
                <Input
                  value={editing.pin_code ?? ""}
                  onChange={(e) => setEditing({ ...editing, pin_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={editing.status ?? "available"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  {["available", "assigned", "blocked"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Avatar URL</Label>
              <Input
                value={editing.avatar ?? ""}
                onChange={(e) => setEditing({ ...editing, avatar: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                save.isPending || !editing.profile_name || !editing.subscription_account_id
              }
              onClick={() => save.mutate(editing)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentsTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listSubscriptionAssignmentsFn);
  const releaseFn = useServerFn(releaseSubscriptionAssignmentFn);
  const replaceFn = useServerFn(replaceSubscriptionAssignmentFn);
  const expireFn = useServerFn(markSubscriptionExpiredFn);
  const noteFn = useServerFn(addSubscriptionNoteFn);
  const extendFn = useServerFn(extendSubscriptionFn);
  const renewFn = useServerFn(renewSubscriptionFn);
  const suspendFn = useServerFn(suspendSubscriptionFn);
  const resumeFn = useServerFn(resumeSubscriptionFn);
  const cancelFn = useServerFn(cancelSubscriptionFn);
  const evalFn = useServerFn(evaluateSubscriptionStatusFn);
  const historyFn = useServerFn(getSubscriptionRenewalHistoryFn);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const { data: historyRows = [] } = useQuery({
    queryKey: ["sub-history", historyId],
    queryFn: () => historyFn({ data: { id: historyId! } }) as Promise<any[]>,
    enabled: !!historyId,
  });
  const { data = [] } = useQuery({
    queryKey: ["sub-assignments"],
    queryFn: () => fn() as Promise<any[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sub-assignments"] });
    qc.invalidateQueries({ queryKey: ["sub-accounts"] });
    qc.invalidateQueries({ queryKey: ["sub-dashboard"] });
    qc.invalidateQueries({ queryKey: ["sub-logs"] });
  };

  const runAction = async (label: string, p: Promise<any>) => {
    try {
      const r = await p;
      if (r && r.ok === false) toast.error(r.reason ?? "Action failed");
      else toast.success(label);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Profile</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No assignments yet.
              </TableCell>
            </TableRow>
          ) : (
            data.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.order_id ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {a.subscription_account_id ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">{a.profile_id ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={statusTone(a.status)}>{a.status}</Badge>
                </TableCell>
                <TableCell>{new Date(a.assigned_at).toLocaleString()}</TableCell>
                <TableCell>
                  {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      runAction("Replaced", replaceFn({ data: { id: a.id } }))
                    }
                  >
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      runAction("Expired", expireFn({ data: { id: a.id } }))
                    }
                  >
                    Expire
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Deactivate this assignment?"))
                        runAction("Deactivated", releaseFn({ data: { id: a.id } }));
                    }}
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const d = Number(prompt("Renew for how many days?", "30"));
                      if (d > 0) runAction("Renewed", renewFn({ data: { id: a.id, days: d } }));
                    }}
                  >
                    Renew
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const d = Number(prompt("Extend by how many days?", "7"));
                      if (d > 0) runAction("Extended", extendFn({ data: { id: a.id, days: d } }));
                    }}
                  >
                    Extend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      runAction(
                        a.status === "suspended" ? "Resumed" : "Suspended",
                        a.status === "suspended"
                          ? resumeFn({ data: { id: a.id } })
                          : suspendFn({ data: { id: a.id } }),
                      )
                    }
                  >
                    {a.status === "suspended" ? "Resume" : "Suspend"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Cancel this subscription?"))
                        runAction("Cancelled", cancelFn({ data: { id: a.id } }));
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const note = prompt("Add a note");
                      if (note) runAction("Note added", noteFn({ data: { id: a.id, note } }));
                    }}
                  >
                    Note
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setHistoryId(a.id)}>
                    History
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="p-2 border-t flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => runAction("Evaluated", evalFn({ data: {} }))}
        >
          Re-evaluate all
        </Button>
      </div>
      <Dialog open={!!historyId} onOpenChange={(o) => !o && setHistoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renewal history</DialogTitle>
          </DialogHeader>
          {historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No renewals recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historyRows.map((h: any) => (
                <li key={h.id} className="border-b pb-1 flex justify-between">
                  <span className="capitalize">{h.renewal_type}</span>
                  <span className="text-muted-foreground">
                    {h.new_expiry ? new Date(h.new_expiry).toLocaleString() : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


function LogsTab() {
  const fn = useServerFn(listSubscriptionLogsFn);
  const { data = [] } = useQuery({
    queryKey: ["sub-logs"],
    queryFn: () => fn() as Promise<any[]>,
  });
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No logs yet.
              </TableCell>
            </TableRow>
          ) : (
            data.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell>{new Date(l.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{l.action}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {l.subscription_account_id ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">{l.actor_id ?? "—"}</TableCell>
                <TableCell>{l.message ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
