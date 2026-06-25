import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: `Forgot password — ${siteName()}` }] }),
  component: ForgotPage,
});

function ForgotPage() {
  return (
    <AuthShell title="Forgot password?" subtitle="We'll email you a link to reset it">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const email = String(fd.get("email") ?? "");
          if (!email) return toast.error("Enter your email");
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset`,
          });
          if (error) return toast.error(error.message);
          toast.success("If that email exists, a reset link has been sent.");
        }}
        className="space-y-4"
      >
        <div>
          <label className="text-sm font-semibold block mb-1.5">Email</label>
          <input name="email" type="email" required placeholder="you@email.com" className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
        </div>
        <button type="submit" className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">Send reset link</button>
      </form>
      <p className="text-sm text-center text-muted-foreground">
        Remembered it? <Link to="/auth/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
