import { useProductActivity, type ActivityEntry, type ActivityKind } from "@/lib/admin/activity-log";
import {
  Activity,
  Copy,
  Download,
  Upload,
  Rocket,
  Pencil,
  Save,
  Search,
  Wand2,
  FileDown,
  Eye,
} from "lucide-react";

const ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  created: Wand2,
  edited: Pencil,
  saved: Save,
  published: Rocket,
  unpublished: Rocket,
  duplicated: Copy,
  imported: Upload,
  exported: Download,
  seo_updated: Search,
  variants_generated: Wand2,
  downloads_added: FileDown,
  preview_generated: Eye,
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function ActivityTimeline({ productId }: { productId: string }) {
  const entries = useProductActivity(productId);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Activity</h3>
        <span className="text-xs text-muted-foreground ml-auto">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-2 max-h-72 overflow-y-auto">
          {entries.map((e: ActivityEntry) => {
            const Icon = ICONS[e.kind] ?? Activity;
            return (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.message}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {timeAgo(e.at)}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
