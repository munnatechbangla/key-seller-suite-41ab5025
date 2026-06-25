import { createFileRoute } from "@tanstack/react-router";
import { SetupWizard } from "@/components/setup/SetupWizard";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup Wizard" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => <SetupWizard mode="first-run" />,
});
