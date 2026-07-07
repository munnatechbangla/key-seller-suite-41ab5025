import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Eye,
  Copy,
  Trash2,
  Rocket,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export type ToolbarProduct = {
  id: string;
  title?: string | null;
  slug?: string | null;
  status?: string | null;
};

export function ProductToolbar({
  product,
  completion,
  isDirty,
  publishBlockers,
  publishWarnings,
  saving,
  publishing,
  deleting,
  onSaveDraft,
  onPublish,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  product?: ToolbarProduct;
  completion: number;
  isDirty: boolean;
  publishBlockers: string[];
  publishWarnings: string[];
  saving?: boolean;
  publishing?: boolean;
  deleting?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const status = product?.status ?? "draft";
  const canPublish = publishBlockers.length === 0;
  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 mb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={status === "published" ? "default" : "secondary"}>
            {status}
          </Badge>
          {isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-400/40">
              Unsaved
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Completion
          </span>
          <div className="hidden sm:block h-2 w-24 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums">{completion}%</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={onSaveDraft} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            disabled={!product?.slug}
          >
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            disabled={publishing || !canPublish}
            title={!canPublish ? publishBlockers.join("\n") : undefined}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-1" />
            )}
            {status === "published" ? "Republish" : "Publish"}
          </Button>
        </div>
      </div>

      {(publishBlockers.length > 0 || publishWarnings.length > 0) && (
        <div className="px-4 md:px-6 pb-2 flex flex-wrap gap-1.5">
          {publishBlockers.map((b) => (
            <span
              key={`b-${b}`}
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
            >
              <AlertTriangle className="h-3 w-3" /> {b}
            </span>
          ))}
          {publishWarnings.map((w) => (
            <span
              key={`w-${w}`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" /> {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
