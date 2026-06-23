import { Link } from "@tanstack/react-router";

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="text-xs text-white/60 mb-2 flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.to ? <Link to={it.to} className="hover:text-white">{it.label}</Link> : <span className="text-white/90">{it.label}</span>}
          {i < items.length - 1 && <span>/</span>}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({ title, subtitle, crumbs }: { title: string; subtitle?: string; crumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="bg-gradient-hero text-white">
      <div className="container mx-auto px-4 py-10 sm:py-12">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
        {subtitle && <p className="text-white/70 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
  );
}
