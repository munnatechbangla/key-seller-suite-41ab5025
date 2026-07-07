import { Button } from "@/components/ui/button";
import { AlertTriangle, WifiOff } from "lucide-react";

export function RecoveryBanner({
  visible,
  savedAt,
  onRestore,
  onDiscard,
}: {
  visible: boolean;
  savedAt: number | null;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  if (!visible) return null;
  const when = savedAt ? new Date(savedAt).toLocaleString() : "";
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 flex flex-wrap items-center gap-3 text-sm"
    >
      <WifiOff className="h-4 w-4 text-amber-600" />
      <div className="flex-1 min-w-[12rem]">
        <div className="font-medium text-amber-700 dark:text-amber-400">Recovered draft available</div>
        <div className="text-muted-foreground text-xs">Cached locally{when ? ` at ${when}` : ""}.</div>
      </div>
      <Button size="sm" variant="outline" onClick={onRestore}>Restore</Button>
      <Button size="sm" variant="ghost" onClick={onDiscard}>Dismiss</Button>
    </div>
  );
}

export function ConflictBanner({
  visible,
  onReload,
  onKeepMine,
}: {
  visible: boolean;
  onReload: () => void;
  onKeepMine: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex flex-wrap items-center gap-3 text-sm"
    >
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <div className="flex-1 min-w-[12rem]">
        <div className="font-medium text-destructive">This product has been modified elsewhere.</div>
        <div className="text-muted-foreground text-xs">Choose how to resolve to avoid overwriting other changes.</div>
      </div>
      <Button size="sm" variant="outline" onClick={onReload}>Reload</Button>
      <Button size="sm" variant="ghost" onClick={onKeepMine}>Keep Mine</Button>
    </div>
  );
}
