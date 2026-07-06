import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCustomFieldsFn,
  upsertCustomFieldFn,
  deleteCustomFieldFn,
  duplicateCustomFieldFn,
  reorderCustomFieldsFn,
  setCustomFieldOptionsFn,
} from "@/lib/custom-fields.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Trash2, Copy, GripVertical, ChevronDown, ChevronRight, Eye,
  ArrowUp, ArrowDown,
} from "lucide-react";

const FIELD_TYPES = [
  "text","email","number","url","password","textarea",
  "select","radio","checkbox","date","phone","country","hidden",
] as const;

type FieldType = typeof FIELD_TYPES[number];
type Option = { label: string; value: string };
type Field = {
  id: string;
  product_id: string;
  label: string;
  name: string;
  field_type: FieldType;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  is_required: boolean;
  is_visible: boolean;
  is_enabled: boolean;
  sort_order: number;
  min_length: number | null;
  max_length: number | null;
  regex_pattern: string | null;
  admin_notes: string | null;
  options: (Option & { id: string; sort_order: number })[];
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

export function CustomFieldsTab({ productId }: { productId: string }) {
  const list = useServerFn(listCustomFieldsFn);
  const upsert = useServerFn(upsertCustomFieldFn);
  const remove = useServerFn(deleteCustomFieldFn);
  const duplicate = useServerFn(duplicateCustomFieldFn);
  const reorder = useServerFn(reorderCustomFieldsFn);
  const setOptions = useServerFn(setCustomFieldOptionsFn);
  const qc = useQueryClient();
  const key = ["admin-custom-fields", productId];

  const { data = [], isLoading } = useQuery<Field[]>({
    queryKey: key,
    queryFn: () => list({ data: { product_id: productId } }) as any,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const saveMut = useMutation({
    mutationFn: (row: any) => upsert({ data: row }),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: () => { toast.success("Duplicated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const optMut = useMutation({
    mutationFn: (v: { field_id: string; options: Option[] }) => setOptions({ data: v }),
    onSuccess: () => { toast.success("Options saved"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const move = async (idx: number, dir: -1 | 1) => {
    const items = [...data];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    const payload = items.map((it, i) => ({ id: it.id, sort_order: i }));
    await reorder({ data: { items: payload } });
    invalidate();
  };

  const addField = () => {
    const existing = new Set((data ?? []).map((f) => f.name));
    let name = "field_1";
    let n = 1;
    while (existing.has(name)) { n += 1; name = `field_${n}`; }
    saveMut.mutate({
      product_id: productId,
      label: "New field",
      name,
      field_type: "text",
      is_required: false,
      is_visible: true,
      is_enabled: true,
      sort_order: data.length,
    });
  };

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom fields</h2>
          <p className="text-sm text-muted-foreground">
            {data.length} field{data.length === 1 ? "" : "s"} — collected from customers at checkout (Phase 2.3).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen((v) => !v)}>
            <Eye className="h-4 w-4 mr-1" /> {previewOpen ? "Hide preview" : "Preview"}
          </Button>
          <Button size="sm" onClick={addField}>
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </div>
      </div>

      {previewOpen && <FieldsPreview fields={data} />}

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {!isLoading && data.length === 0 && (
        <div className="p-6 border rounded-lg text-sm text-muted-foreground">
          No custom fields yet. Add one to start collecting extra info at checkout.
        </div>
      )}

      <div className="space-y-3">
        {data.map((f, idx) => (
          <FieldCard
            key={f.id}
            field={f}
            onSave={(v) => saveMut.mutate(v)}
            onDelete={() => confirm(`Delete field "${f.label}"?`) && delMut.mutate(f.id)}
            onDuplicate={() => dupMut.mutate(f.id)}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, 1)}
            onSaveOptions={(options) => optMut.mutate({ field_id: f.id, options })}
          />
        ))}
      </div>
    </div>
  );
}

function FieldCard({
  field, onSave, onDelete, onDuplicate, onMoveUp, onMoveDown, onSaveOptions,
}: {
  field: Field;
  onSave: (v: any) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSaveOptions: (options: Option[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Field>(field);
  const [opts, setOpts] = useState<Option[]>(field.options.map((o) => ({ label: o.label, value: o.value })));
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(field), [f, field]);
  const optsDirty = useMemo(
    () => JSON.stringify(opts) !== JSON.stringify(field.options.map((o) => ({ label: o.label, value: o.value }))),
    [opts, field.options],
  );
  const needsOptions = f.field_type === "select" || f.field_type === "radio";

  const save = () => {
    if (!f.label.trim()) return toast.error("Label required");
    if (!f.name.trim()) return toast.error("Internal name required");
    if (!/^[a-z0-9_]+$/.test(f.name)) return toast.error("Name must be lowercase letters, numbers, underscores");
    if (f.min_length != null && f.max_length != null && f.min_length > f.max_length) {
      return toast.error("min length cannot exceed max length");
    }
    if (f.regex_pattern) {
      try { new RegExp(f.regex_pattern); } catch { return toast.error("Invalid regex"); }
    }
    onSave({
      id: f.id,
      product_id: f.product_id,
      label: f.label,
      name: f.name,
      field_type: f.field_type,
      placeholder: f.placeholder || null,
      help_text: f.help_text || null,
      default_value: f.default_value || null,
      is_required: !!f.is_required,
      is_visible: !!f.is_visible,
      is_enabled: !!f.is_enabled,
      sort_order: f.sort_order,
      min_length: f.min_length ?? null,
      max_length: f.max_length ?? null,
      regex_pattern: f.regex_pattern || null,
      admin_notes: f.admin_notes || null,
    });
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <button
          className="flex items-center gap-1 flex-1 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{f.label || "(untitled)"}</span>
          <Badge variant="secondary" className="ml-2">{f.field_type}</Badge>
          <code className="ml-2 text-xs text-muted-foreground">{f.name}</code>
          {f.is_required && <Badge variant="outline" className="ml-1">required</Badge>}
          {!f.is_enabled && <Badge variant="outline" className="ml-1">disabled</Badge>}
          {!f.is_visible && <Badge variant="outline" className="ml-1">hidden</Badge>}
        </button>
        <Button variant="ghost" size="icon" onClick={onMoveUp}><ArrowUp className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onMoveDown}><ArrowDown className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate"><Copy className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      {open && (
        <div className="p-4 border-t space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Label</Label>
              <Input
                value={f.label}
                maxLength={200}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((prev) => ({
                    ...prev,
                    label: v,
                    // auto-slug on new/blank name only
                    name: prev.name && prev.name !== slugify(prev.label) ? prev.name : slugify(v) || prev.name,
                  }));
                }}
              />
            </div>
            <div>
              <Label>Internal name</Label>
              <Input
                value={f.name}
                maxLength={64}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Field type</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={f.field_type}
                onChange={(e) => setF({ ...f, field_type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Placeholder</Label>
              <Input value={f.placeholder ?? ""} onChange={(e) => setF({ ...f, placeholder: e.target.value })} />
            </div>

            <div>
              <Label>Default value</Label>
              <Input value={f.default_value ?? ""} onChange={(e) => setF({ ...f, default_value: e.target.value })} />
            </div>
            <div>
              <Label>Help text</Label>
              <Input value={f.help_text ?? ""} onChange={(e) => setF({ ...f, help_text: e.target.value })} />
            </div>

            <div>
              <Label>Min length</Label>
              <Input type="number" value={f.min_length ?? ""} onChange={(e) => setF({ ...f, min_length: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max length</Label>
              <Input type="number" value={f.max_length ?? ""} onChange={(e) => setF({ ...f, max_length: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>

            <div className="col-span-2">
              <Label>Regex pattern (optional)</Label>
              <Input value={f.regex_pattern ?? ""} onChange={(e) => setF({ ...f, regex_pattern: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label>Admin notes (not shown to customers)</Label>
              <Textarea rows={2} value={f.admin_notes ?? ""} onChange={(e) => setF({ ...f, admin_notes: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.is_required} onCheckedChange={(v) => setF({ ...f, is_required: v })} /> Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.is_visible} onCheckedChange={(v) => setF({ ...f, is_visible: v })} /> Visible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.is_enabled} onCheckedChange={(v) => setF({ ...f, is_enabled: v })} /> Enabled
            </label>
          </div>

          {needsOptions && (
            <OptionsEditor
              options={opts}
              setOptions={setOpts}
              onSave={() => onSaveOptions(opts)}
              dirty={optsDirty}
            />
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setF(field)} disabled={!dirty}>Reset</Button>
            <Button size="sm" onClick={save} disabled={!dirty}>Save field</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options, setOptions, onSave, dirty,
}: { options: Option[]; setOptions: (o: Option[]) => void; onSave: () => void; dirty: boolean }) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Options</div>
        <Button size="sm" variant="outline" onClick={() => setOptions([...options, { label: "", value: "" }])}>
          <Plus className="h-4 w-4 mr-1" /> Add option
        </Button>
      </div>
      {options.length === 0 && <div className="text-xs text-muted-foreground">No options yet.</div>}
      {options.map((o, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input placeholder="Label" value={o.label} onChange={(e) => {
            const copy = [...options]; copy[i] = { ...copy[i], label: e.target.value };
            if (!copy[i].value) copy[i].value = slugify(e.target.value);
            setOptions(copy);
          }} />
          <Input placeholder="Value" value={o.value} onChange={(e) => {
            const copy = [...options]; copy[i] = { ...copy[i], value: e.target.value };
            setOptions(copy);
          }} />
          <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={!dirty}>Save options</Button>
      </div>
    </div>
  );
}

function FieldsPreview({ fields }: { fields: Field[] }) {
  const visible = fields.filter((f) => f.is_enabled && f.is_visible && f.field_type !== "hidden");
  return (
    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
      <div className="text-sm font-medium">Customer preview</div>
      {visible.length === 0 && <div className="text-xs text-muted-foreground">No visible fields.</div>}
      {visible.map((f) => (
        <div key={f.id} className="space-y-1">
          <Label>{f.label}{f.is_required && <span className="text-destructive"> *</span>}</Label>
          {renderPreviewInput(f)}
          {f.help_text && <div className="text-xs text-muted-foreground">{f.help_text}</div>}
        </div>
      ))}
    </div>
  );
}

function renderPreviewInput(f: Field) {
  const common: any = { placeholder: f.placeholder ?? undefined, defaultValue: f.default_value ?? undefined };
  switch (f.field_type) {
    case "textarea": return <Textarea rows={3} {...common} />;
    case "select":
      return (
        <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" defaultValue={f.default_value ?? ""}>
          <option value="">— select —</option>
          {f.options.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="space-y-1">
          {f.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name={f.name} value={o.value} defaultChecked={f.default_value === o.value} /> {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return <label className="flex items-center gap-2 text-sm"><input type="checkbox" /> {f.placeholder ?? "Yes"}</label>;
    case "date": return <Input type="date" {...common} />;
    case "email": return <Input type="email" {...common} />;
    case "number": return <Input type="number" {...common} />;
    case "url": return <Input type="url" {...common} />;
    case "password": return <Input type="password" {...common} />;
    case "phone": return <Input type="tel" {...common} />;
    default: return <Input {...common} />;
  }
}
