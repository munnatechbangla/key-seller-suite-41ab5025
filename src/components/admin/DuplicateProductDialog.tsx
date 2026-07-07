import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export type DuplicateOptions = {
  basic: boolean;
  images: boolean;
  gallery: boolean;
  downloads: boolean;
  attributes: boolean;
  options: boolean;
  variants: boolean;
  inventoryMapping: boolean;
  subscriptionMapping: boolean;
  licenseMapping: boolean;
  customFields: boolean;
  richContent: boolean;
  seo: boolean;
  layout: boolean;
  landingPages: boolean;
  reviews: boolean;
};

const DEFAULT_OPTS: DuplicateOptions = {
  basic: true,
  images: true,
  gallery: true,
  downloads: true,
  attributes: true,
  options: true,
  variants: true,
  inventoryMapping: true,
  subscriptionMapping: true,
  licenseMapping: true,
  customFields: true,
  richContent: true,
  seo: true,
  layout: true,
  landingPages: true,
  reviews: false,
};

const LABELS: Array<{ key: keyof DuplicateOptions; label: string }> = [
  { key: "basic", label: "Basic Information" },
  { key: "images", label: "Images" },
  { key: "gallery", label: "Gallery" },
  { key: "downloads", label: "Downloads" },
  { key: "attributes", label: "Attributes" },
  { key: "options", label: "Options" },
  { key: "variants", label: "Variants" },
  { key: "inventoryMapping", label: "Inventory Mapping" },
  { key: "subscriptionMapping", label: "Subscription Mapping" },
  { key: "licenseMapping", label: "License Mapping" },
  { key: "customFields", label: "Custom Fields" },
  { key: "richContent", label: "Rich Content" },
  { key: "seo", label: "SEO" },
  { key: "layout", label: "Product Layout" },
  { key: "landingPages", label: "Landing Pages" },
  { key: "reviews", label: "Reviews" },
];

export function DuplicateProductDialog({
  open,
  onOpenChange,
  sourceTitle,
  sourceSlug,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceTitle: string;
  sourceSlug: string;
  busy?: boolean;
  onConfirm: (payload: { title: string; slug: string; opts: DuplicateOptions }) => void;
}) {
  const [title, setTitle] = useState(`${sourceTitle} (Copy)`);
  const [slug, setSlug] = useState(`${sourceSlug}-copy`);
  const [opts, setOpts] = useState<DuplicateOptions>(DEFAULT_OPTS);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Duplicate product</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dup-title">New title</Label>
              <Input id="dup-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dup-slug">New slug</Label>
              <Input id="dup-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Copy which sections?</div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {LABELS.map((row) => (
                <label key={row.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts[row.key]}
                    onChange={(e) => setOpts({ ...opts, [row.key]: e.target.checked })}
                  />
                  {row.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              A new <strong>Draft</strong> product will be created with a unique slug and SKU. You
              can review before publishing.
            </p>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !title.trim() || !slug.trim()}
            onClick={() => onConfirm({ title: title.trim(), slug: slug.trim(), opts })}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Create duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
