import type { ReactNode } from "react";

export function Section({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`container mx-auto px-4 py-16 ${className}`}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-4 mb-8 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              {eyebrow}
            </div>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight break-words">{title}</h2>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
