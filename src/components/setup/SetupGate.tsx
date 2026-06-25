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
    const allowed =
      pathname === "/setup" ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/");
    if (!allowed) navigate({ to: "/setup", replace: true });
  }, [isLoading, data, pathname, navigate]);

  return null;
}
