import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({ meta: [{ title: "Reset password — TopupHut" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  return (
    <AuthShell title="Set a new password" subtitle="Choose something memorable and secure">
      <form onSubmit={(e) => { e.preventDefault(); toast.success("Password updated!"); navigate({ to: "/auth/login" }); }} className="space-y-4">
        <div>
          <label className="text-sm font-semibold block mb-1.5">New password</label>
          <input type="password" required minLength={6} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1.5">Confirm password</label>
          <input type="password" required minLength={6} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
        </div>
        <button type="submit" className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">Update password</button>
      </form>
    </AuthShell>
  );
}
