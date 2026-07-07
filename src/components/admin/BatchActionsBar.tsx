import { Button } from "@/components/ui/button";
import { Copy, Download, Trash2, EyeOff, Eye, Rocket } from "lucide-react";

export function BatchActionsBar({
  count,
  onClear,
  onPublish,
  onDraft,
  onPrivate,
  onDuplicate,
  onExport,
  onDelete,
  busy,
}: {
  count: number;
  onClear: () => void;
  onPublish: () => void;
  onDraft: () => void;
  onPrivate: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-sm">
      <span className="text-sm font-medium">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      <div className="ml-auto flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={onPublish} disabled={busy}>
          <Rocket className="h-3.5 w-3.5 mr-1" /> Publish
        </Button>
        <Button size="sm" variant="outline" onClick={onDraft} disabled={busy}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Draft
        </Button>
        <Button size="sm" variant="outline" onClick={onPrivate} disabled={busy}>
          <EyeOff className="h-3.5 w-3.5 mr-1" /> Private
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate} disabled={busy}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
        </Button>
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={busy}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
      </div>
    </div>
  );
}
