import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listProductAttributesFn,
  adminUpsertAttributeFn,
  adminDeleteAttributeFn,
  adminUpsertOptionFn,
  adminDeleteOptionFn,
  type AttributeDisplayType,
  type ProductAttribute,
  type ProductAttributeOption,
} from "@/lib/product-variants.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaLibrary";

const DISPLAY_TYPES: AttributeDisplayType[] = ["select", "button", "color", "image"];

export function AttributesTab({ productId }: { productId: string }) {
  const list = useServerFn(listProductAttributesFn);
  const upsertAttr = useServerFn(adminUpsertAttributeFn);
  const delAttr = useServerFn(adminDeleteAttributeFn);
  const qc = useQueryClient();
  const key = ["admin-attributes", productId];
  const { data = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { productId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["admin-variants", productId] });
  };

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AttributeDisplayType>("select");

  const create = useMutation({
    mutationFn: (row: { name: string; display_type: AttributeDisplayType; sort_order: number }) =>
      upsertAttr({ data: { product_id: productId, ...row } }),
    onSuccess: () => {
      toast.success("Attribute added");
      setNewName("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delAttr({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (a: ProductAttribute) => {
      const res = await upsertAttr({
        data: {
          product_id: productId,
          name: `${a.name} (copy)`,
          display_type: a.display_type,
          sort_order: (data as ProductAttribute[]).length,
        },
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Duplicated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <div className="flex-1 min-w-[200px]">
          <Label>Attribute name</Label>
          <Input placeholder="Region, Package, Color…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div>
          <Label>Display type</Label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value as AttributeDisplayType)}
          >
            {DISPLAY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => {
            if (!newName.trim()) return toast.error("Name required");
            create.mutate({
              name: newName.trim(),
              display_type: newType,
              sort_order: (data as ProductAttribute[]).length,
            });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add attribute
        </Button>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {!isLoading && (data as ProductAttribute[]).length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No attributes yet. Add one above (e.g. Region, Package).
        </div>
      )}

      <div className="space-y-3">
        {(data as ProductAttribute[]).map((a) => (
          <AttributeCard
            key={a.id}
            attr={a}
            onDelete={() => {
              if (confirm(`Delete "${a.name}" and all its options? Variants using it will be invalid.`)) {
                remove.mutate(a.id);
              }
            }}
            onDuplicate={() => duplicate.mutate(a)}
            onChanged={invalidate}
          />
        ))}
      </div>
    </div>
  );
}

function AttributeCard({
  attr,
  onDelete,
  onDuplicate,
  onChanged,
}: {
  attr: ProductAttribute;
  onDelete: () => void;
  onDuplicate: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(attr.name);
  const [type, setType] = useState<AttributeDisplayType>(attr.display_type);
  const upsertAttr = useServerFn(adminUpsertAttributeFn);

  const save = useMutation({
    mutationFn: () =>
      upsertAttr({
        data: {
          id: attr.id,
          product_id: attr.product_id,
          name: name.trim() || attr.name,
          display_type: type,
          sort_order: attr.sort_order,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        {editing ? (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-[220px]" />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as AttributeDisplayType)}
            >
              {DISPLAY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <Button size="sm" onClick={() => save.mutate()}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <div className="flex-1">
              <div className="font-medium">{attr.name}</div>
              <div className="text-xs text-muted-foreground">
                {attr.display_type} · {attr.options.length} options
              </div>
            </div>
            <Badge variant="secondary">{attr.display_type}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="ghost" size="icon" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>
      {open && <OptionList attribute={attr} onChanged={onChanged} />}
    </div>
  );
}

function OptionList({ attribute, onChanged }: { attribute: ProductAttribute; onChanged: () => void }) {
  const upsert = useServerFn(adminUpsertOptionFn);
  const del = useServerFn(adminDeleteOptionFn);

  const save = useMutation({
    mutationFn: (row: Parameters<typeof upsert>[0]["data"]) => upsert({ data: row }),
    onSuccess: () => onChanged(),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.warning("Option deleted. Existing variants using it are now invalid — regenerate variants.");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [draft, setDraft] = useState({ value: "", label: "", color: "", image: "" });

  const showColor = attribute.display_type === "color";
  const showImage = attribute.display_type === "image";

  return (
    <div className="border-t p-3 space-y-2">
      <div className="space-y-2">
        {attribute.options.map((o, idx) => (
          <OptionRow
            key={o.id}
            option={o}
            attribute={attribute}
            index={idx}
            onSave={(row) => save.mutate(row)}
            onDelete={() => {
              if (confirm(`Delete option "${o.label}"?`)) remove.mutate(o.id);
            }}
            onDuplicate={() =>
              save.mutate({
                attribute_id: attribute.id,
                value: `${o.value}-copy`,
                label: `${o.label} (copy)`,
                color: o.color,
                image: o.image,
                sort_order: attribute.options.length,
              })
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2">
        <div className="min-w-[140px]">
          <Label className="text-xs">Value (slug)</Label>
          <Input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="bd" />
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs">Label</Label>
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Bangladesh" />
        </div>
        {showColor && (
          <div>
            <Label className="text-xs">Color</Label>
            <Input type="color" value={draft.color || "#000000"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-16 p-1" />
          </div>
        )}
        {showImage && (
          <div className="min-w-[200px]">
            <MediaPicker label="Image" value={draft.image} onChange={(url) => setDraft({ ...draft, image: url })} />
          </div>
        )}
        <Button
          size="sm"
          onClick={() => {
            const value = draft.value.trim() || draft.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const label = draft.label.trim() || draft.value.trim();
            if (!value || !label) return toast.error("Value and label required");
            save.mutate({
              attribute_id: attribute.id,
              value,
              label,
              color: draft.color || null,
              image: draft.image || null,
              sort_order: attribute.options.length,
            });
            setDraft({ value: "", label: "", color: "", image: "" });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add option
        </Button>
      </div>
    </div>
  );
}

function OptionRow({
  option,
  attribute,
  index,
  onSave,
  onDelete,
  onDuplicate,
}: {
  option: ProductAttributeOption;
  attribute: ProductAttribute;
  index: number;
  onSave: (row: {
    id: string;
    attribute_id: string;
    value: string;
    label: string;
    color?: string | null;
    image?: string | null;
    sort_order: number;
  }) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [value, setValue] = useState(option.value);
  const [label, setLabel] = useState(option.label);
  const [color, setColor] = useState(option.color ?? "");
  const [image, setImage] = useState(option.image ?? "");
  const dirty =
    value !== option.value || label !== option.label ||
    color !== (option.color ?? "") || image !== (option.image ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-32" placeholder="slug" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-40" placeholder="Label" />
      {attribute.display_type === "color" && (
        <Input type="color" value={color || "#000000"} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 p-1" />
      )}
      {attribute.display_type === "image" && (
        <div className="w-52"><MediaPicker label="" value={image} onChange={setImage} /></div>
      )}
      <div className="flex-1" />
      {dirty && (
        <Button
          size="sm"
          onClick={() =>
            onSave({
              id: option.id,
              attribute_id: attribute.id,
              value: value.trim() || option.value,
              label: label.trim() || option.label,
              color: color || null,
              image: image || null,
              sort_order: index,
            })
          }
        >
          Save
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
