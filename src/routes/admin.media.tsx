import { createFileRoute } from "@tanstack/react-router";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const Route = createFileRoute("/admin/media")({
  component: MediaPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error?.message ?? error)}</div>,
});

function MediaPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Media Library</h1>
        <p className="text-sm text-muted-foreground">Single source of truth for images and assets.</p>
      </div>
      <MediaLibrary mode="manage" />
    </div>
  );
}
