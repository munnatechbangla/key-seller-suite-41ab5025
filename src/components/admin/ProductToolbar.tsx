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
  Undo2,
  Redo2,
  Keyboard,
  CheckCircle2,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { formatSavedAt, type SaveStatus } from "@/lib/admin/editor-store";

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
  saveStatus,
  lastSavedAt,
  saveError,
  canUndo,
  canRedo,
  onSaveDraft,
  onPublish,
  onPreview,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  onRetry,
  onHelp,
}: {
  product?: ToolbarProduct;
  completion: number;
  isDirty: boolean;
  publishBlockers: string[];
  publishWarnings: string[];
  saving?: boolean;
  publishing?: boolean;
  deleting?: boolean;
  saveStatus?: SaveStatus;
  lastSavedAt?: number | null;
  saveError?: string | null;
  canUndo?: boolean;
  canRedo?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRetry?: () => void;
  onHelp?: () => void;
}) {
  const status = product?.status ?? "draft";
  const canPublish = publishBlockers.length === 0;
  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-6 mb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
          {isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-400/40">Unsaved</Badge>
          )}
          <SaveStatusPill status={saveStatus ?? "idle"} lastSavedAt={lastSavedAt ?? null} error={saveError ?? null} onRetry={onRetry} />
          <span className="text-xs text-muted-foreground hidden sm:inline">Completion</span>
          <div className="hidden sm:block h-2 w-24 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
          <span className="text-xs font-medium tabular-nums">{completion}%</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onHelp} aria-label="Keyboard shortcuts" title="Shortcuts (?)">
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onSaveDraft} disabled={saving} title="Save Draft (Ctrl+S)">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button size="sm" variant="outline" onClick={onPreview} disabled={!product?.slug} title="Preview (Ctrl+P)">
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={onDuplicate} title="Duplicate (Ctrl+D)">
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete} disabled={deleting} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button size="sm" onClick={onPublish} disabled={publishing || !canPublish} title={!canPublish ? publishBlockers.join("\n") : "Publish (Ctrl+Shift+P)"}>
            {publishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
            {status === "published" ? "Republish" : "Publish"}
          </Button>
        </div>
      </div>

      {(publishBlockers.length > 0 || publishWarnings.length > 0) && (
        <div className="px-4 md:px-6 pb-2 flex flex-wrap gap-1.5">
          {publishBlockers.map((b) => (
            <span key={`b-${b}`} className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3" /> {b}
            </span>
          ))}
          {publishWarnings.map((w) => (
            <span key={`w-${w}`} className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveStatusPill({
  status,
  lastSavedAt,
  error,
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: number | null;
  error: string | null;
  onRetry?: () => void;
}) {
  const at = formatSavedAt(lastSavedAt);
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]";
  if (status === "saving") {
    return (
      <span role="status" aria-live="polite" className={`${base} text-muted-foreground border-border`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span role="status" aria-live="polite" className={`${base} text-emerald-600 border-emerald-400/40`}>
        <CheckCircle2 className="h-3 w-3" /> Draft saved{at ? ` · ${at}` : ""}
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span role="status" aria-live="assertive" className={`${base} text-amber-700 dark:text-amber-400 border-amber-400/40`}>
        <WifiOff className="h-3 w-3" /> Offline — cached locally
      </span>
    );
  }
  if (status === "error") {
    return (
      <span role="alert" aria-live="assertive" className={`${base} text-destructive border-destructive/40`}>
        <AlertTriangle className="h-3 w-3" /> Save failed
        <button type="button" onClick={onRetry} className="ml-1 inline-flex items-center gap-0.5 underline">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
        {error ? <span className="sr-only">{error}</span> : null}
      </span>
    );
  }
  if (lastSavedAt) {
    return <span className={`${base} text-muted-foreground border-border`}>Last saved {at}</span>;
  }
  return null;
}
