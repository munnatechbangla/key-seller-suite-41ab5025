import { Badge } from "@/components/ui/badge";

function fmt(d?: string | number | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export interface AuditPanelProps {
  product: any;
  variantCount: number;
  downloadCount: number;
  imageCount: number;
  completion: number;
  seoScore: number;
}

export function AuditPanel({
  product,
  variantCount,
  downloadCount,
  imageCount,
  completion,
  seoScore,
}: AuditPanelProps) {
  if (!product) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 text-xs">
      <div className="text-sm font-semibold mb-1">Audit</div>
      <Row label="Product ID">
        <code className="text-[10px] break-all">{product.id}</code>
      </Row>
      <Row label="Status">
        <Badge variant={product.status === "published" ? "default" : "secondary"}>
          {product.status ?? "draft"}
        </Badge>
      </Row>
      <Row label="Created">{fmt(product.created_at)}</Row>
      <Row label="Updated">{fmt(product.updated_at)}</Row>
      <Row label="Variants">{variantCount}</Row>
      <Row label="Downloads">{downloadCount}</Row>
      <Row label="Images">{imageCount}</Row>
      <Row label="SEO score">{seoScore}%</Row>
      <Row label="Health">{completion}%</Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
