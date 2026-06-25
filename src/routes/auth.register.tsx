import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, SocialButtons } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/stores";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/register")({
  head: () => ({ meta: [{ title: `Create account — ${siteName()}` }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!name || !email || password.length < 6) return toast.error("Please complete all fields (min 6 char password)");
    const { error } = await register(name, email, password);
    if (error) return toast.error(error);
    toast.success("Account created! Check your email to verify.");
    navigate({ to: "/account" });
  };

  return (
    <AuthShell title="Create your account" subtitle="Start shopping premium digital products today">
      <form onSubmit={submit} className="space-y-4">
        <Field name="name" label="Full name" placeholder="Jane Doe" />
        <Field name="email" label="Email" type="email" placeholder="you@email.com" />
        <Field name="password" label="Password" type="password" placeholder="At least 6 characters" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-1 accent-[var(--primary)]" />
          <span>I agree to the <Link to="/terms" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</span>
        </label>
        <button type="submit" className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">Create account</button>
        <div className="relative text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><span className="relative bg-background px-3 text-xs text-muted-foreground">OR</span></div>
        <SocialButtons />
      </form>
      <p className="text-sm text-center text-muted-foreground">
        Already have an account? <Link to="/auth/login" className="text-primary font-semibold hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function Field({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold block mb-1.5">{label}</label>
      <input name={name} type={type} required placeholder={placeholder} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
    </div>
  );
}
