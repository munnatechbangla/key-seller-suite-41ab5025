import { createFileRoute } from "@tanstack/react-router";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { reopenSetup, useSetupStatus } from "@/lib/setup";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/setup")({
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const { data: status, refetch } = useSetupStatus();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Setup Wizard</h1>
          <p className="text-sm text-muted-foreground">
            {status?.is_completed
              ? `Setup completed${status.completed_at ? ` on ${new Date(status.completed_at).toLocaleString()}` : ""}.`
              : "Setup is not yet completed."}
          </p>
        </div>
        {status?.is_completed && (
          <Button
            variant="outline"
            onClick={async () => {
              const r = await reopenSetup();
              if (!r.ok) toast.error(r.error ?? "Failed");
              else { toast.success("Setup re-opened"); refetch(); }
            }}
          >
            Re-open setup
          </Button>
        )}
      </div>
      <SetupWizard mode="revisit" onCompleted={() => refetch()} />
    </div>
  );
}
