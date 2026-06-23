import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-hero text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur grid place-items-center">
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl">Topup<span className="text-accent">Hut</span></span>
        </Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Premium digital products, delivered in seconds.</h2>
          <p className="text-white/70">Join 200,000+ customers who trust TopupHut for ChatGPT, Netflix, Canva, IPTV and more — all at unbeatable prices.</p>
          <div className="flex gap-6 pt-4 border-t border-white/10">
            <div><div className="text-2xl font-bold">200K+</div><div className="text-xs text-white/60">Customers</div></div>
            <div><div className="text-2xl font-bold">4.9★</div><div className="text-xs text-white/60">Rating</div></div>
            <div><div className="text-2xl font-bold">24/7</div><div className="text-xs text-white/60">Support</div></div>
          </div>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} TopupHut</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow"><Zap className="h-5 w-5 text-primary-foreground" /></div>
            <span className="font-bold text-xl">Topup<span className="text-gradient">Hut</span></span>
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
  const providers = [
    { name: "Google", color: "#EA4335", path: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" },
    { name: "Facebook", color: "#1877F2", path: "M24 12a12 12 0 1 0-13.87 11.85v-8.39H7.08V12h3.05V9.36c0-3.01 1.79-4.68 4.54-4.68 1.32 0 2.7.24 2.7.24v2.96h-1.52c-1.5 0-1.96.93-1.96 1.88V12h3.34l-.53 3.46h-2.81v8.39A12 12 0 0 0 24 12z" },
    { name: "GitHub", color: "#181717", path: "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.05.78 2.12v3.15c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" },
    { name: "Apple", color: "#000000", path: "M16.36 1.43c0 1.14-.47 2.24-1.21 3.02-.79.85-2.07 1.5-3.12 1.42-.12-1.1.47-2.27 1.18-3.01.79-.84 2.16-1.46 3.15-1.43zm3.46 16.95c-.5 1.16-.75 1.68-1.4 2.7-.92 1.42-2.21 3.2-3.81 3.21-1.42.02-1.79-.93-3.72-.92-1.92.01-2.32.94-3.74.92-1.6-.01-2.83-1.61-3.74-3.03C1.04 17.36.27 12.79 1.97 9.86c1.21-2.08 3.12-3.3 4.92-3.3 1.83 0 2.98.92 4.06.92 1.07 0 1.79-.92 4.05-.92 1.55 0 3.2.85 4.38 2.31-3.86 2.12-3.24 7.65.44 9.51z" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map((p) => (
        <button key={p.name} type="button" className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={p.color}><path d={p.path} /></svg>
          {p.name}
        </button>
      ))}
    </div>
  );
}
