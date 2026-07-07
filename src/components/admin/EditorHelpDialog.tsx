import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl / ⌘ + S", "Save Draft"],
  ["Ctrl / ⌘ + P", "Preview"],
  ["Ctrl / ⌘ + D", "Duplicate Product"],
  ["Ctrl / ⌘ + Shift + P", "Publish"],
  ["Ctrl / ⌘ + Z", "Undo"],
  ["Ctrl / ⌘ + Shift + Z", "Redo"],
  ["Esc", "Close dialogs"],
  ["?", "Show this help"],
];

export function EditorHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={keys} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">{keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
