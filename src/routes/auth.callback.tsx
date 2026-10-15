import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.startsWith("/auth/callback")) {
    return "/account";
  }
  return value;
}

function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing Google sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // Supabase's PKCE flow requires exchanging the returned authorization code.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Also supports a session already restored by supabase-js from the callback URL.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          throw new Error(url.searchParams.get("error_description") || "Google sign-in did not complete. Please try again.");
        }

        const next = safeReturnPath(sessionStorage.getItem("auth:redirect"));
        sessionStorage.removeItem("auth:redirect");
        if (!cancelled) window.location.replace(next);
      } catch (error) {
        sessionStorage.removeItem("auth:redirect");
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
        }
      }
    }

    void completeSignIn();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">Google sign-in</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {message !== "Completing Google sign-in…" && (
          <a href="/auth/login" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Back to sign in
          </a>
        )}
      </section>
    </main>
  );
}
