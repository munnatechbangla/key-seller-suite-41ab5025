import type { SectionCommonStyle } from "@/lib/cms/section-types";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export type CmsSection = {
  id: string;
  section_key: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  json_content: any;
  sort_order: number;
  enabled: boolean;
};

function wrapperStyle(style?: SectionCommonStyle): React.CSSProperties {
  if (!style) return {};
  return {
    backgroundColor: style.background_color || undefined,
    backgroundImage: style.background_image ? `url(${style.background_image})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    padding: style.padding || undefined,
    margin: style.margin || undefined,
    borderRadius: style.border_radius || undefined,
  };
}

function containerClass(w?: SectionCommonStyle["container_width"]) {
  switch (w) {
    case "sm": return "max-w-3xl mx-auto px-4";
    case "md": return "max-w-5xl mx-auto px-4";
    case "lg": return "max-w-6xl mx-auto px-4";
    case "full": return "w-full px-4";
    default: return "container mx-auto px-4";
  }
}

function visibilityClass(v?: SectionCommonStyle["visibility"]) {
  if (!v) return "";
  const cls: string[] = [];
  if (v.mobile === false) cls.push("hidden sm:block");
  if (v.tablet === false) cls.push("sm:hidden lg:block");
  if (v.desktop === false) cls.push("lg:hidden");
  return cls.join(" ");
}

export function SectionRenderer({ section }: { section: CmsSection }) {
  const style: SectionCommonStyle | undefined = section.json_content?.style;
  const wrapCls = cn(
    "cms-section relative",
    style?.dark_mode ? "dark bg-background text-foreground" : "",
    style?.animation && style.animation !== "none" ? `animate-${style.animation === "slide-up" ? "fade-in" : style.animation}` : "",
    style?.custom_class,
    visibilityClass(style?.visibility),
  );
  return (
    <section className={wrapCls} style={wrapperStyle(style)}>
      {style?.overlay && <div className="absolute inset-0 pointer-events-none" style={{ background: style.overlay }} />}
      <div className={cn("relative py-12", containerClass(style?.container_width))}>
        <SectionBody section={section} />
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle, description }: { title?: string | null; subtitle?: string | null; description?: string | null }) {
  if (!title && !subtitle && !description) return null;
  return (
    <div className="mb-8 text-center">
      {subtitle && <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">{subtitle}</div>}
      {title && <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h2>}
      {description && <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{description}</p>}
    </div>
  );
}

function SectionBody({ section }: { section: CmsSection }) {
  const c = section.json_content ?? {};
  const t = section.section_type;
  switch (t) {
    case "hero": {
      const slide = (c.slides?.[0] ?? {}) as any;
      return (
        <div className="rounded-3xl overflow-hidden relative min-h-[360px] bg-gradient-hero text-white p-10 flex flex-col justify-center">
          {slide.image && <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
          <div className="relative max-w-2xl space-y-4">
            {slide.badge && <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-sm">{slide.badge}</span>}
            <h1 className="text-4xl sm:text-5xl font-extrabold">{slide.title || section.title}</h1>
            {slide.subtitle && <p className="text-xl opacity-90">{slide.subtitle}</p>}
            {slide.description && <p className="opacity-80">{slide.description}</p>}
            <div className="flex gap-3 pt-2">
              {slide.button1?.label && <a href={slide.button1.href || "#"} className="px-5 py-3 rounded-xl bg-white text-black font-semibold">{slide.button1.label}</a>}
              {slide.button2?.label && <a href={slide.button2.href || "#"} className="px-5 py-3 rounded-xl border border-white/40">{slide.button2.label}</a>}
            </div>
          </div>
        </div>
      );
    }
    case "announcement":
      return <div className="text-center text-sm py-3 bg-primary/10 text-primary rounded-md">{c.text}</div>;
    case "features":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(c.items ?? []).map((it: any, i: number) => (
              <div key={i} className="rounded-2xl border p-5 bg-card">
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{it.desc}</div>
              </div>
            ))}
          </div>
        </>
      );
    case "categories":
    case "featured_categories":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} description={section.json_content?.description} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {(c.items ?? []).map((it: any, i: number) => (
              <Link key={i} to="/categories" className="rounded-2xl border p-5 bg-card hover:border-primary/50 transition">
                {it.image && <img src={it.image} alt="" className="w-full h-24 object-cover rounded mb-2" />}
                <div className="font-semibold">{it.title}</div>
                {it.count != null && <div className="text-xs text-muted-foreground">{it.count} products</div>}
              </Link>
            ))}
            {(!c.items || c.items.length === 0) && <div className="col-span-full text-center text-muted-foreground text-sm">No categories configured.</div>}
          </div>
        </>
      );
    case "featured_products":
    case "latest_products":
    case "best_selling_products":
    case "trending_products":
    case "flash_sale":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-8">
            Products list ({t.replace(/_/g, " ")}) — data source: <code>{c.source ?? "featured"}</code>, limit {c.limit ?? 8}. The storefront resolves products at render time.
          </div>
        </>
      );
    case "testimonials":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="grid md:grid-cols-3 gap-5">
            {(c.items ?? []).map((it: any, i: number) => (
              <div key={i} className="rounded-2xl border p-5 bg-card">
                <div className="flex items-center gap-3 mb-2">
                  {it.avatar && <img src={it.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
                  <div>
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.designation}</div>
                  </div>
                </div>
                <div className="text-yellow-500 text-sm">{"★".repeat(it.stars ?? 5)}</div>
                <p className="text-sm mt-2">{it.comment}</p>
              </div>
            ))}
          </div>
        </>
      );
    case "customer_counter":
      return (
        <div className="text-center py-10">
          <div className="text-5xl font-extrabold">{Number(c.value ?? 0).toLocaleString()}</div>
          <div className="text-muted-foreground mt-2">{c.label ?? "Customers"}</div>
        </div>
      );
    case "statistics":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(c.items ?? []).map((it: any, i: number) => (
              <div key={i} className="rounded-2xl border p-6 text-center bg-card">
                <div className="text-3xl font-extrabold">{it.value}</div>
                <div className="text-sm text-muted-foreground">{it.label}</div>
              </div>
            ))}
          </div>
        </>
      );
    case "faq":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="max-w-3xl mx-auto space-y-2">
            {(c.items ?? []).map((it: any, i: number) => (
              <details key={i} className="rounded-xl border p-4 bg-card">
                <summary className="font-semibold cursor-pointer">{it.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
              </details>
            ))}
          </div>
        </>
      );
    case "blog_posts":
      return (
        <>
          <SectionHeader title={section.title} subtitle={section.subtitle} />
          <div className="text-center text-sm text-muted-foreground border border-dashed rounded-xl p-8">
            Blog posts — limit {c.limit ?? 3}. Rendered from live blog data.
          </div>
        </>
      );
    case "newsletter":
      return (
        <div className="rounded-3xl bg-primary/10 p-10 text-center" style={c.background ? { background: c.background } : {}}>
          <h2 className="text-3xl font-extrabold">{c.title ?? "Subscribe"}</h2>
          {c.description && <p className="text-muted-foreground mt-2">{c.description}</p>}
          <form className="mt-6 flex justify-center gap-2 max-w-md mx-auto">
            <input type="email" placeholder="you@email.com" className="flex-1 px-4 py-3 rounded-xl border bg-background" />
            <button type="button" className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold">{c.button ?? "Subscribe"}</button>
          </form>
        </div>
      );
    case "video":
      return c.url ? (
        <div className="aspect-video w-full max-w-4xl mx-auto rounded-2xl overflow-hidden">
          <iframe src={c.url} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
        </div>
      ) : <div className="text-center text-muted-foreground">Video URL not set.</div>;
    case "text_image": {
      const imgLeft = c.image_position === "left";
      return (
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {imgLeft && c.image && <img src={c.image} alt="" className="rounded-2xl w-full" />}
          <div>
            {section.title && <h2 className="text-3xl font-bold mb-3">{section.title}</h2>}
            {section.subtitle && <p className="text-muted-foreground mb-3">{section.subtitle}</p>}
            {c.body && <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: c.body }} />}
          </div>
          {!imgLeft && c.image && <img src={c.image} alt="" className="rounded-2xl w-full" />}
        </div>
      );
    }
    case "gallery":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(c.images ?? []).map((src: string, i: number) => (
            <img key={i} src={src} alt="" className="w-full h-40 object-cover rounded-xl" />
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="rounded-3xl p-10 text-center" style={c.background ? { background: c.background } : {}}>
          <h2 className="text-3xl font-extrabold">{c.title}</h2>
          {c.subtitle && <p className="text-muted-foreground mt-2">{c.subtitle}</p>}
          {c.button?.label && (
            <a href={c.button.href || "#"} className="inline-block mt-5 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold">
              {c.button.label}
            </a>
          )}
        </div>
      );
    case "custom_html":
      return <div dangerouslySetInnerHTML={{ __html: c.html ?? "" }} />;
    case "spacer":
      return <div style={{ height: `${c.height ?? 48}px` }} />;
    case "divider":
      return <hr style={{ borderColor: c.color || undefined, borderTopWidth: `${c.thickness ?? 1}px` }} />;
    default:
      return <div className="text-center text-sm text-muted-foreground">Unknown section type: {t}</div>;
  }
}

export function HomepageRenderer({ sections }: { sections: CmsSection[] }) {
  return (
    <div className="cms-homepage">
      {sections.filter((s) => s.enabled).map((s) => <SectionRenderer key={s.id} section={s} />)}
    </div>
  );
}
