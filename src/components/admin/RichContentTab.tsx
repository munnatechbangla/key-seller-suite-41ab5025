import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  productBlocksListFn, productBlockUpsertFn, productBlockDeleteFn,
  productBlockDuplicateFn, productBlockReorderFn,
} from "@/lib/product-blocks.functions";
import { PRODUCT_BLOCK_TYPES, findProductBlockDef, type ProductBlockTypeKey } from "@/lib/cms/product-block-types";
import { ProductContentBlocks, type ProductBlock } from "@/components/cms/ProductContentBlocks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowUp, ArrowDown, Copy, Trash2, Plus, ChevronDown, ChevronRight,
  Smartphone, Tablet, Monitor,
} from "lucide-react";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

export function RichContentTab({ productId }: { productId: string }) {
  const listFn = useServerFn(productBlocksListFn);
  const upsertFn = useServerFn(productBlockUpsertFn);
  const [blocks, setBlocks] = useState<ProductBlock[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ProductBlock | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [device, setDevice] = useState<Device>("desktop");

  const refresh = async () => setBlocks(await listFn({ data: { product_id: productId } }) as ProductBlock[]);
  useEffect(() => { refresh(); }, [productId]);

  const addBlock = async (typeKey: ProductBlockTypeKey) => {
    const def = findProductBlockDef(typeKey)!;
    await upsertFn({ data: {
      product_id: productId,
      block_type: typeKey,
      json_content: { ...def.defaults },
      sort_order: blocks.length,
      enabled: true,
    } as any });
    setAddOpen(false);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rich Content</h2>
          <p className="text-xs text-muted-foreground">
            Build the product page content with modular blocks. Products without blocks keep showing the existing description.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-1">
            <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
            <Button variant={device === "tablet" ? "default" : "ghost"} size="sm" onClick={() => setDevice("tablet")}><Tablet className="h-4 w-4" /></Button>
            <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add block</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-5 space-y-2">
          {blocks.map((b, i) => (
            <BlockRow
              key={b.id}
              b={b} index={i} total={blocks.length}
              collapsed={!!collapsed[b.id]}
              selected={selected?.id === b.id}
              onSelect={() => setSelected(b)}
              onToggleCollapse={() => setCollapsed({ ...collapsed, [b.id]: !collapsed[b.id] })}
              onChanged={async () => { await refresh(); setSelected(null); }}
              blocks={blocks}
            />
          ))}
          {blocks.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
              No content blocks yet. Click <b>Add block</b>.
            </CardContent></Card>
          )}
        </aside>

        <main className="col-span-7">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit" disabled={!selected}>Edit JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="border rounded-lg bg-muted/20 p-4 overflow-auto">
                <div className="mx-auto bg-background shadow-sm rounded-md p-4 transition-all" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
                  <ProductContentBlocks blocks={blocks.filter((b) => b.enabled)} />
                  {blocks.length === 0 && <div className="p-16 text-center text-sm text-muted-foreground">Add blocks to preview.</div>}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="edit">
              {selected && <BlockEditor block={selected} onSaved={refresh} />}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AddBlockDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addBlock} />
    </div>
  );
}

function BlockRow({ b, index, total, collapsed, selected, onSelect, onToggleCollapse, onChanged, blocks }: {
  b: ProductBlock; index: number; total: number; collapsed: boolean; selected: boolean;
  onSelect: () => void; onToggleCollapse: () => void; onChanged: () => void; blocks: ProductBlock[];
}) {
  const upsert = useServerFn(productBlockUpsertFn);
  const del = useServerFn(productBlockDeleteFn);
  const dup = useServerFn(productBlockDuplicateFn);
  const reorder = useServerFn(productBlockReorderFn);
  const def = findProductBlockDef(b.block_type);

  const move = async (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const a = blocks[index], c = blocks[j];
    await reorder({ data: { items: [{ id: a.id, sort_order: c.sort_order }, { id: c.id, sort_order: a.sort_order }] } });
    onChanged();
  };

  return (
    <Card className={selected ? "border-primary" : ""}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={onToggleCollapse} className="p-1">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button className="flex-1 text-left" onClick={onSelect}>
            <div className="font-semibold text-sm">{def?.label ?? b.block_type}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{def?.description}</div>
          </button>
          <Switch checked={b.enabled} onCheckedChange={async (v) => { await upsert({ data: { ...b, enabled: v } as any }); onChanged(); }} />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => move(-1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => move(1)} disabled={index === total - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onSelect}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: b.id } }); onChanged(); }}><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete block?")) { await del({ data: { id: b.id } }); onChanged(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockEditor({ block, onSaved }: { block: ProductBlock; onSaved: () => Promise<void> }) {
  const upsert = useServerFn(productBlockUpsertFn);
  const [text, setText] = useState(() => JSON.stringify(block.json_content ?? {}, null, 2));
  useEffect(() => setText(JSON.stringify(block.json_content ?? {}, null, 2)), [block.id]);
  const save = async () => {
    try {
      const parsed = JSON.parse(text);
      await upsert({ data: { ...block, json_content: parsed } as any });
      toast.success("Saved");
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Invalid JSON"); }
  };
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">Edit the raw JSON for this block.</p>
      <Textarea rows={16} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end"><Button onClick={save}>Save</Button></div>
    </CardContent></Card>
  );
}

function AddBlockDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (t: ProductBlockTypeKey) => void }) {
  const grouped = useMemo(() => {
    const m: Record<string, typeof PRODUCT_BLOCK_TYPES> = {};
    for (const t of PRODUCT_BLOCK_TYPES) { (m[t.group] ??= []).push(t); }
    return m;
  }, []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add content block</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {Object.entries(grouped).map(([group, types]) => (
            <div key={group}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {types.map((t) => (
                  <button key={t.key} onClick={() => onAdd(t.key)} className="text-left rounded-lg border p-3 hover:border-primary hover:bg-muted/40 transition">
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
