import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in…" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      const raw = sessionStorage.getItem("auth:redirect") ?? "/account";
      sessionStorage.removeItem("auth:redirect");
      const dest = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
      if (!ok) toast.error("Google sign-in failed. Please try again.");
      navigate({ to: ok ? dest : "/auth/login", replace: true });
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      finish(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish(true);
    });

    // Fallback: session may already be established before the listener attaches.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) finish(true);
      else setTimeout(async () => {
        const { data: d2 } = await supabase.auth.getSession();
        finish(Boolean(d2.session));
      }, 3000);
    })();

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}
