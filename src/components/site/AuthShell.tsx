import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useSettings } from "@/lib/cms/settings";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const s = useSettings((st) => st.settings);
  const { brand_lead, brand_accent, name } = s.branding;
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-hero text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur grid place-items-center">
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl">{brand_lead}<span className="text-accent">{brand_accent}</span></span>
        </Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Premium digital products, delivered in seconds.</h2>
          <p className="text-white/70">Join thousands of customers who trust {name} for premium subscriptions and software — all at unbeatable prices.</p>
          <div className="flex gap-6 pt-4 border-t border-white/10">
            <div><div className="text-2xl font-bold">200K+</div><div className="text-xs text-white/60">Customers</div></div>
            <div><div className="text-2xl font-bold">4.9★</div><div className="text-xs text-white/60">Rating</div></div>
            <div><div className="text-2xl font-bold">24/7</div><div className="text-xs text-white/60">Support</div></div>
          </div>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} {name}</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow"><Zap className="h-5 w-5 text-primary-foreground" /></div>
            <span className="font-bold text-xl">{brand_lead}<span className="text-gradient">{brand_accent}</span></span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

export function SocialButtons() {
  const handleGoogle = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      (await import("sonner")).toast.error(result.error.message ?? "Sign-in failed");
    }
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      <button
        type="button"
        onClick={handleGoogle}
        className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.15.8 3.87 1.5l2.63-2.55C16.93 3.4 14.7 2.4 12 2.4 6.92 2.4 2.8 6.52 2.8 11.6S6.92 20.8 12 20.8c6.93 0 9.2-4.87 9.2-7.34 0-.5-.05-.86-.12-1.26H12z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
