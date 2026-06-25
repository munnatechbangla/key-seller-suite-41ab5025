import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSetupStatus } from "@/lib/setup";

/**
 * If marketplace setup is not completed, redirect every non-auth, non-setup
 * route to /setup. Runs client-side only.
 */
export function SetupGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isLoading } = useSetupStatus();

  useEffect(() => {
    if (isLoading || !data) return;
    if (data.is_completed) return;
    // Only gate the admin area on first-run. The storefront, auth pages,
    // API routes, and the wizard itself stay reachable so the preview and
    // public site work before an admin completes setup.
    const mustGate =
      pathname.startsWith("/admin") &&
      pathname !== "/admin/setup";
    if (mustGate) navigate({ to: "/setup", replace: true });
  }, [isLoading, data, pathname, navigate]);

  return null;
}
