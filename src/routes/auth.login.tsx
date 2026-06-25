import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, SocialButtons } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/stores";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: `Sign in — ${siteName()}` }] }),
  component: LoginPage,
});

function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!email || !password) return toast.error("Please fill all fields");
    const { error } = await login(email, password);
    if (error) return toast.error(error);
    toast.success("Welcome back!");
    navigate({ to: "/account" });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to TopupHut">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold block mb-1.5">Email</label>
          <input name="email" type="email" required placeholder="you@email.com" className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-sm font-semibold">Password</label>
            <Link to="/auth/forgot" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <input name="password" type={show ? "text" : "password"} required placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm pr-10" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[var(--primary)]" /> Keep me signed in
        </label>
        <button type="submit" className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">Sign in</button>
        <div className="relative text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><span className="relative bg-background px-3 text-xs text-muted-foreground">OR</span></div>
        <SocialButtons />
      </form>
      <p className="text-sm text-center text-muted-foreground">
        New to TopupHut? <Link to="/auth/register" className="text-primary font-semibold hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
