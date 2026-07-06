import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Star, Info, AlertTriangle, ShieldCheck, Download, Zap, KeyRound, Repeat, Clock } from "lucide-react";
import * as LucideIcons from "lucide-react";

export type ProductBlock = {
  id: string;
  block_type: string;
  json_content: any;
  enabled: boolean;
  sort_order: number;
};

function Icon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Cmp = (LucideIcons as any)[name] ?? Check;
  return <Cmp className={cn("h-4 w-4", className)} />;
}

export function ProductContentBlocks({ blocks, product }: { blocks: ProductBlock[]; product?: any }) {
  return (
    <div className="space-y-6">
      {blocks.map((b) => <RenderBlock key={b.id} block={b} product={product} />)}
    </div>
  );
}

function RenderBlock({ block, product }: { block: ProductBlock; product?: any }) {
  const c = block.json_content ?? {};
  switch (block.block_type) {
    case "rich_text":
      return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: c.html ?? "" }} />;

    case "heading": {
      const level = Math.min(Math.max(Number(c.level ?? 2), 1), 6);
      const Tag = `h${level}` as unknown as React.ElementType;
      const size = level <= 2 ? "text-3xl" : level === 3 ? "text-2xl" : "text-xl";
      return <Tag className={cn("font-bold", size)} style={{ textAlign: c.align ?? "left" }}>{c.text}</Tag>;
    }

    case "quote":
      return (
        <blockquote className="border-l-4 pl-4 italic text-muted-foreground">
          "{c.text}"{c.cite && <footer className="text-xs mt-1 not-italic">— {c.cite}</footer>}
        </blockquote>
      );

    case "markdown":
      return <pre className="whitespace-pre-wrap font-sans">{c.md}</pre>;

    case "code":
      return (
        <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm">
          <code className={`language-${c.language ?? "text"}`}>{c.code}</code>
        </pre>
      );

    case "image":
      return (
        <figure style={{ textAlign: c.align ?? "center" }}>
          {c.url && <img src={c.url} alt={c.alt ?? ""} className="inline-block max-w-full rounded-md" />}
          {c.caption && <figcaption className="text-xs text-muted-foreground mt-1">{c.caption}</figcaption>}
        </figure>
      );

    case "gallery":
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(c.images ?? []).map((img: any, i: number) => (
            <img key={i} src={img.url ?? img} alt={img.alt ?? ""} className="w-full h-40 object-cover rounded-md" />
          ))}
        </div>
      );

    case "video":
      return (
        <video src={c.url} controls autoPlay={!!c.autoplay} loop={!!c.loop} muted={c.muted !== false} className="w-full rounded-md" />
      );

    case "youtube":
      return (
        <div className="aspect-video w-full">
          <iframe
            className="w-full h-full rounded-md"
            src={`https://www.youtube.com/embed/${c.video_id}${c.autoplay ? "?autoplay=1&mute=1" : ""}`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );

    case "vimeo":
      return (
        <div className="aspect-video w-full">
          <iframe
            className="w-full h-full rounded-md"
            src={`https://player.vimeo.com/video/${c.video_id}${c.autoplay ? "?autoplay=1&muted=1" : ""}`}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
          />
        </div>
      );

    case "accordion":
      return (
        <div className="space-y-2">
          {(c.items ?? []).map((it: any, i: number) => (
            <details key={i} className="border rounded-md p-3">
              <summary className="font-medium cursor-pointer">{it.title}</summary>
              <div className="mt-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: it.body ?? "" }} />
            </details>
          ))}
        </div>
      );

    case "faq":
      return (
        <div className="space-y-2">
          {(c.items ?? []).map((f: any, i: number) => (
            <details key={i} className="border rounded-md p-3">
              <summary className="font-medium cursor-pointer">{f.q}</summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      );

    case "icon_list":
      return (
        <ul className="grid md:grid-cols-2 gap-2">
          {(c.items ?? []).map((it: any, i: number) => (
            <li key={i} className="flex items-start gap-2">
              <Icon name={it.icon} className="mt-1 text-primary shrink-0" />
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      );

    case "feature_list":
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {(c.items ?? []).map((it: any, i: number) => (
            <div key={i} className="border rounded-lg p-4">
              <Icon name={it.icon} className="text-primary mb-2 h-5 w-5" />
              <div className="font-semibold">{it.title}</div>
              <p className="text-sm text-muted-foreground">{it.description}</p>
            </div>
          ))}
        </div>
      );

    case "comparison_table":
      return (
        <div className="overflow-x-auto"><table className="w-full text-sm border rounded-md">
          <thead className="bg-muted/40"><tr>{(c.headers ?? []).map((h: string, i: number) => <th key={i} className="p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>{(c.rows ?? []).map((r: string[], i: number) => (
            <tr key={i} className="border-t">{r.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}</tr>
          ))}</tbody>
        </table></div>
      );

    case "pricing_table":
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {(c.plans ?? []).map((p: any, i: number) => (
            <div key={i} className="border rounded-lg p-6 flex flex-col">
              <div className="font-semibold">{p.name}</div>
              <div className="text-3xl font-bold my-2">{p.price}</div>
              <ul className="text-sm space-y-1 flex-1">
                {(p.features ?? []).map((f: string, j: number) => (
                  <li key={j} className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-primary" />{f}</li>
                ))}
              </ul>
              {p.cta?.label && <a href={p.cta.href || "#"} className="mt-4"><Button className="w-full">{p.cta.label}</Button></a>}
            </div>
          ))}
        </div>
      );

    case "statistics":
      return (
        <div className="grid md:grid-cols-4 gap-4">
          {(c.items ?? []).map((it: any, i: number) => (
            <div key={i} className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{it.value}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{it.label}</div>
            </div>
          ))}
        </div>
      );

    case "timeline":
      return (
        <ol className="border-l-2 pl-4 space-y-4">
          {(c.items ?? []).map((it: any, i: number) => (
            <li key={i}>
              <div className="text-xs text-muted-foreground">{it.date}</div>
              <div className="font-semibold">{it.title}</div>
              <p className="text-sm text-muted-foreground">{it.body}</p>
            </li>
          ))}
        </ol>
      );

    case "steps":
      return (
        <ol className="space-y-3">
          {(c.items ?? []).map((it: any, i: number) => (
            <li key={i} className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">{i + 1}</span>
              <div><div className="font-semibold">{it.title}</div><p className="text-sm text-muted-foreground">{it.body}</p></div>
            </li>
          ))}
        </ol>
      );

    case "notice":
    case "alert": {
      const tone = c.tone ?? "info";
      const map: Record<string, string> = {
        info: "border-blue-500 bg-blue-500/10",
        warning: "border-yellow-500 bg-yellow-500/10",
        success: "border-green-500 bg-green-500/10",
        danger: "border-red-500 bg-red-500/10",
      };
      const IconCmp = tone === "warning" || tone === "danger" ? AlertTriangle : Info;
      return (
        <div className={cn("border-l-4 rounded-md p-4 flex gap-3", map[tone] ?? map.info)}>
          <IconCmp className="h-5 w-5 shrink-0" />
          <div><div className="font-semibold">{c.title ?? ""}</div><div className="text-sm">{c.body ?? c.text}</div></div>
        </div>
      );
    }

    case "button":
      return (
        <div style={{ textAlign: c.align ?? "left" }}>
          <a href={c.href || "#"}><Button variant={c.variant ?? "default"}>{c.label}</Button></a>
        </div>
      );

    case "divider":
      return <hr style={{ borderTopWidth: c.thickness ?? 1 }} />;

    case "spacer":
      return <div style={{ height: c.height ?? 32 }} />;

    case "custom_html":
      return <div dangerouslySetInnerHTML={{ __html: c.html ?? "" }} />;

    case "download_card":
      return (
        <div className="border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCell icon={<Download className="h-4 w-4" />} label="Version" value={c.version} />
          <InfoCell icon={<ShieldCheck className="h-4 w-4" />} label="File size" value={c.file_size} />
          <InfoCell icon={<Check className="h-4 w-4" />} label="Compatibility" value={c.compatibility} />
          <InfoCell icon={<Clock className="h-4 w-4" />} label="Released" value={c.release_date} />
        </div>
      );

    case "license_info":
      return (
        <div className="border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCell icon={<KeyRound className="h-4 w-4" />} label="License type" value={c.license_type} />
          <InfoCell icon={<Zap className="h-4 w-4" />} label="Activation" value={c.activation} />
          <InfoCell icon={<ShieldCheck className="h-4 w-4" />} label="Warranty" value={c.warranty} />
          <InfoCell icon={<Repeat className="h-4 w-4" />} label="Replacement" value={c.replacement} />
        </div>
      );

    case "subscription_info":
      return (
        <div className="border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCell icon={<Star className="h-4 w-4" />} label="Profiles" value={c.profiles} />
          <InfoCell icon={<Clock className="h-4 w-4" />} label="Duration" value={c.duration} />
          <InfoCell icon={<Repeat className="h-4 w-4" />} label="Renewal" value={c.renewal} />
          <InfoCell icon={<ShieldCheck className="h-4 w-4" />} label="Warranty" value={c.warranty} />
        </div>
      );

    case "activation_info":
      return (
        <div className="border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCell icon={<Clock className="h-4 w-4" />} label="Processing time" value={c.processing_time} />
          <InfoCell icon={<KeyRound className="h-4 w-4" />} label="Need login" value={c.need_login ? "Yes" : "No"} />
          <InfoCell icon={<ShieldCheck className="h-4 w-4" />} label="Warranty" value={c.warranty} />
          <InfoCell icon={<Info className="h-4 w-4" />} label="Support" value={c.support} />
        </div>
      );

    default:
      return null;
  }
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="font-semibold text-sm mt-1">{value || "—"}</div>
    </div>
  );
}
