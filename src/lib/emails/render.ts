// Lightweight mustache-style template renderer. No deps.
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = key.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), vars);
    return v == null ? "" : String(v);
  });
}
