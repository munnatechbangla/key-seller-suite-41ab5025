/**
 * Product import/export helpers (client-side only, UX layer).
 *
 * Supports CSV and JSON export for a single product, a selection, or the
 * entire catalog. No schema changes, no server calls — the caller passes the
 * already-fetched product rows.
 */

const EXPORT_COLUMNS = [
  "id",
  "title",
  "slug",
  "status",
  "visibility",
  "product_type",
  "delivery_type",
  "regular_price",
  "sale_price",
  "is_featured",
  "sales_count",
  "created_at",
] as const;

type ExportRow = Record<string, unknown>;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function productsToCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const body = rows
    .map((r) => EXPORT_COLUMNS.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

export function productsToJson(rows: ExportRow[]): string {
  const clean = rows.map((r) => {
    const out: ExportRow = {};
    for (const c of EXPORT_COLUMNS) out[c] = r[c] ?? null;
    return out;
  });
  return JSON.stringify(clean, null, 2);
}

export function downloadFile(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProducts(rows: ExportRow[], format: "csv" | "json", scope: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `products-${scope}-${stamp}.${format}`;
  const mime = format === "csv" ? "text/csv" : "application/json";
  const content = format === "csv" ? productsToCsv(rows) : productsToJson(rows);
  downloadFile(filename, content, mime);
  return { filename, count: rows.length };
}

export interface ParsedImport {
  rows: ExportRow[];
  format: "csv" | "json";
  errors: string[];
}

export function parseImport(text: string, hint?: "csv" | "json"): ParsedImport {
  const trimmed = text.trim();
  const isJson =
    hint === "json" || (!hint && (trimmed.startsWith("[") || trimmed.startsWith("{")));
  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return { rows, format: "json", errors: [] };
    } catch (e: any) {
      return { rows: [], format: "json", errors: [`Invalid JSON: ${e.message}`] };
    }
  }
  // Simple CSV: no embedded newlines
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], format: "csv", errors: ["CSV needs a header + rows"] };
  const header = parseCsvLine(lines[0]);
  const rows: ExportRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length !== header.length) {
      errors.push(`Row ${i + 1}: expected ${header.length} cells, got ${cells.length}`);
      continue;
    }
    const row: ExportRow = {};
    header.forEach((h, idx) => (row[h] = cells[idx]));
    rows.push(row);
  }
  return { rows, format: "csv", errors };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') inQuotes = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Diff imported rows against existing (matched by id or slug). */
export interface ImportDiff {
  toCreate: ExportRow[];
  toUpdate: Array<{ existing: ExportRow; incoming: ExportRow }>;
  duplicates: ExportRow[];
}

export function diffImport(existing: ExportRow[], incoming: ExportRow[]): ImportDiff {
  const bySlug = new Map<string, ExportRow>();
  const byId = new Map<string, ExportRow>();
  for (const e of existing) {
    if (e.slug) bySlug.set(String(e.slug), e);
    if (e.id) byId.set(String(e.id), e);
  }
  const toCreate: ExportRow[] = [];
  const toUpdate: Array<{ existing: ExportRow; incoming: ExportRow }> = [];
  const duplicates: ExportRow[] = [];
  const seenSlugs = new Set<string>();
  for (const r of incoming) {
    const slug = r.slug ? String(r.slug) : "";
    if (slug && seenSlugs.has(slug)) {
      duplicates.push(r);
      continue;
    }
    if (slug) seenSlugs.add(slug);
    const match = (r.id && byId.get(String(r.id))) || (slug && bySlug.get(slug));
    if (match) toUpdate.push({ existing: match, incoming: r });
    else toCreate.push(r);
  }
  return { toCreate, toUpdate, duplicates };
}
