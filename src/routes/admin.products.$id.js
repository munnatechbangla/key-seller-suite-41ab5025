import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminListProductsFn, adminListProductDownloadsFn, adminUpsertProductDownloadFn, adminDeleteProductDownloadFn, adminListVariationsFn, adminUpsertVariationFn, adminDeleteVariationFn, adminListProductImagesFn, adminUpsertProductImageFn, adminReorderProductImagesFn, adminDeleteProductImageFn, adminUpsertProductFn, adminDeleteProductFn, } from "@/lib/admin.functions";
import { adminListCategoriesFn } from "@/lib/categories.functions";
import { listProductAttributesFn, listProductVariantsFn } from "@/lib/product-variants.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Star, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { CustomFieldsTab } from "@/components/admin/CustomFieldsTab";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { RichContentTab } from "@/components/admin/RichContentTab";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ProductSeoTab } from "@/components/admin/ProductSeoTab";
import { AttributesTab } from "@/components/admin/AttributesTab";
import { VariantsTab } from "@/components/admin/VariantsTab";
import { usePriceFormatter, formatPriceWithSymbol } from "@/lib/currency";
import { useSettings } from "@/lib/cms/settings";
import { WizardSteps } from "@/components/admin/WizardSteps";
import { ProductToolbar } from "@/components/admin/ProductToolbar";
import { EditorHelpDialog } from "@/components/admin/EditorHelpDialog";
import { RecoveryBanner, ConflictBanner } from "@/components/admin/RecoveryBanner";
import { useIsDirty, useBeforeUnloadGuard, useMarkDirty } from "@/lib/admin/unsaved-changes";
import { useSaveStatus, useHistoryState, useConflict, useConflictWatcher, useEditorShortcuts, useOnlineRecovery, useAutosave, retrySave, undo, redo, clearHistory, clearConflict, clearLocalDraft, readLocalDraft, } from "@/lib/admin/editor-store";
import { DuplicateProductDialog } from "@/components/admin/DuplicateProductDialog";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { logActivity } from "@/lib/admin/activity-log";
import { generateSignedPreview } from "@/lib/admin/signed-preview";
const VALID_TABS = ["basic", "downloads", "attributes", "variants", "variations", "gallery", "custom-fields", "rich-content", "seo"];
export const Route = createFileRoute("/admin/products/$id")({
    component: ManageProduct,
    validateSearch: (s) => ({
        tab: VALID_TABS.includes(s.tab) ? s.tab : "basic",
    }),
    errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error?.message ?? error)}</div>,
    notFoundComponent: () => <div className="p-6">Not found</div>,
});
function ManageProduct() {
    const { id } = Route.useParams();
    const formatPrice = usePriceFormatter();
    const { tab } = Route.useSearch();
    const navigate = useNavigate();
    const setTab = (t) => navigate({ to: "/admin/products/$id", params: { id }, search: { tab: t }, replace: true });
    const listProducts = useServerFn(adminListProductsFn);
    const listAttrs = useServerFn(listProductAttributesFn);
    const listVars = useServerFn(listProductVariantsFn);
    const listImages = useServerFn(adminListProductImagesFn);
    const listDownloads = useServerFn(adminListProductDownloadsFn);
    const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: () => listProducts() });
    const product = (products ?? []).find((p) => p.id === id);
    const { data: attrs = [] } = useQuery({ queryKey: ["admin-attributes", id], queryFn: () => listAttrs({ data: { productId: id } }) });
    const { data: variants = [] } = useQuery({ queryKey: ["admin-variants", id], queryFn: () => listVars({ data: { productId: id } }) });
    const { data: images = [] } = useQuery({ queryKey: ["admin-images", id], queryFn: () => listImages({ data: { product_id: id } }) });
    const { data: downloads = [] } = useQuery({ queryKey: ["admin-downloads", id], queryFn: () => listDownloads({ data: { product_id: id } }) });
    const attrCount = attrs.length;
    const optionCount = attrs.reduce((n, a) => n + a.options.length, 0);
    const variantCount = variants.length;
    const productMode = attrCount > 0 ? "variable" : "simple";
    const hasPrices = productMode === "variable"
        ? variants.every((v) => Number(v.price) > 0)
        : Number(product?.regular_price ?? 0) > 0;
    const wizardSteps = useMemo(() => {
        const baseSeo = product?.seo ?? {};
        const seoDone = !!(baseSeo.meta_title || baseSeo.meta_description);
        const arr = [
            { id: "basic", label: "Basic Info", tab: "basic", done: !!product?.title && !!product?.slug },
            { id: "images", label: "Images", tab: "gallery", done: images.length > 0 || !!product?.thumbnail_url },
            { id: "attributes", label: "Attributes", tab: "attributes", done: attrCount > 0 || productMode === "simple" },
            { id: "variants", label: "Variants", tab: "variants", done: productMode === "simple" || variantCount > 0 },
            { id: "delivery", label: "Delivery", tab: "downloads", done: !!product?.delivery_type },
            { id: "downloads", label: "Downloads / License", tab: "downloads", done: downloads.length > 0 || product?.delivery_type === "external_url" },
            { id: "seo", label: "SEO", tab: "seo", done: seoDone },
            { id: "publish", label: "Publish", tab: tab, done: product?.status === "published" },
        ];
        return arr;
    }, [product, images, downloads, attrCount, variantCount, productMode, tab]);
    const completion = Math.round((wizardSteps.filter((s) => s.done).length / wizardSteps.length) * 100);
    // Legacy checklist flags (used inside the Variants tab checklist below)
    const publishBlocked = productMode === "variable" && variantCount === 0;
    // Publish validation
    const publishBlockers = [];
    const publishWarnings = [];
    if (!product?.title || !product?.slug)
        publishBlockers.push("Missing title or slug");
    if (productMode === "variable" && variantCount === 0)
        publishBlockers.push("No variants generated");
    if (product?.delivery_type === "download" && downloads.length === 0)
        publishBlockers.push("Downloadable product has no files");
    if (!hasPrices)
        publishBlockers.push("Missing prices");
    if (product?.delivery_type === "license_key")
        publishWarnings.push("Verify license pool is assigned");
    if (product?.product_type === "subscription")
        publishWarnings.push("Verify subscription pool is assigned");
    const seoMeta = product?.seo;
    if (!seoMeta?.meta_title && !seoMeta?.meta_description)
        publishWarnings.push("SEO meta is empty");
    // Unsaved-changes guard (each tab flips its own dirty flag)
    const isDirty = useIsDirty();
    useBeforeUnloadGuard(isDirty);
    // Toolbar mutations
    const upsertProduct = useServerFn(adminUpsertProductFn);
    const deleteProduct = useServerFn(adminDeleteProductFn);
    const qc = useQueryClient();
    const buildProductPayload = (patch) => {
        if (!product)
            return null;
        const p = product;
        return {
            id: p.id,
            title: p.title,
            slug: p.slug,
            short_description: p.short_description ?? null,
            description: p.description ?? null,
            regular_price: Number(p.regular_price ?? 0),
            sale_price: p.sale_price == null ? null : Number(p.sale_price),
            thumbnail_url: p.thumbnail_url ?? null,
            status: p.status ?? "draft",
            is_featured: !!p.is_featured,
            is_digital: !!p.is_digital,
            is_license_key: !!p.is_license_key,
            product_type: p.product_type ?? null,
            delivery_type: p.delivery_type ?? null,
            visibility: p.visibility ?? null,
            external_url: p.external_url ?? null,
            ...patch,
        };
    };
    const setStatus = useMutation({
        mutationFn: async (status) => {
            const payload = buildProductPayload({ status });
            if (!payload)
                throw new Error("Product not loaded");
            return upsertProduct({ data: payload });
        },
        onSuccess: (_r, status) => {
            toast.success(status === "published" ? "Product published" : "Draft saved");
            logActivity(id, status === "published" ? "published" : "saved", status === "published" ? "Product published" : "Draft saved");
            qc.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (e) => toast.error(e.message),
    });
    const removeProduct = useMutation({
        mutationFn: () => deleteProduct({ data: { id } }),
        onSuccess: () => {
            toast.success("Product deleted");
            qc.invalidateQueries({ queryKey: ["admin-products"] });
            navigate({ to: "/admin/products" });
        },
        onError: (e) => toast.error(e.message),
    });
    const handlePublish = () => {
        if (publishBlockers.length > 0) {
            toast.error(publishBlockers[0]);
            return;
        }
        setStatus.mutate("published");
    };
    const handleSaveDraft = () => setStatus.mutate("draft");
    const handlePreview = () => {
        if (!product?.slug)
            return;
        const rec = generateSignedPreview(id, product.slug);
        logActivity(id, "preview_generated", `Signed preview generated (valid ${rec.ttlMinutes}m)`);
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(rec.url).catch(() => undefined);
        }
        toast.success(`Preview link copied · valid ${rec.ttlMinutes} minutes`);
        window.open(rec.url, "_blank", "noopener");
    };
    const [dupOpen, setDupOpen] = useState(false);
    const handleDuplicate = () => setDupOpen(true);
    const duplicate = useMutation({
        mutationFn: async (payload) => {
            if (!product)
                throw new Error("Product not loaded");
            const p = product;
            const clone = buildProductPayload({
                title: payload.title,
                slug: payload.slug,
                status: "draft",
            });
            if (!clone)
                throw new Error("Nothing to clone");
            delete clone.id;
            // Only fields the upsert schema accepts are cloned. Deep-copy of variants,
            // pools and content-blocks is deliberately scoped for a follow-up phase
            // (requires new server functions) — no business logic is touched here.
            const res = await upsertProduct({ data: clone });
            return { id: res?.id, opts: payload.opts };
        },
        onSuccess: ({ id: newId }) => {
            toast.success("Product duplicated as draft");
            logActivity(id, "duplicated", `Duplicated to new draft ${newId}`);
            logActivity(newId, "created", "Created via duplicate");
            qc.invalidateQueries({ queryKey: ["admin-products"] });
            setDupOpen(false);
            navigate({ to: "/admin/products/$id", params: { id: newId }, search: { tab: "attributes" } });
        },
        onError: (e) => toast.error(e.message),
    });
    const handleDelete = () => {
        if (!confirm(`Delete "${product?.title ?? "this product"}"? This cannot be undone.`))
            return;
        removeProduct.mutate();
    };
    /* ---------- Phase 4.9A-2: persistence & safety ---------- */
    const saveState = useSaveStatus();
    const history = useHistoryState();
    const conflict = useConflict();
    const [helpOpen, setHelpOpen] = useState(false);
    const [recovery, setRecovery] = useState(null);
    // Detect a locally-cached draft on mount (offline recovery).
    useEffect(() => {
        const cached = readLocalDraft(id);
        if (cached)
            setRecovery({ at: cached.at });
    }, [id]);
    // Autosave: whenever product basic fields change, debounce + save.
    const autosaveData = useMemo(() => {
        if (!product)
            return null;
        const p = product;
        return {
            title: p.title,
            slug: p.slug,
            short_description: p.short_description,
            description: p.description,
            thumbnail_url: p.thumbnail_url,
        };
    }, [product]);
    const baseline = useRef("");
    useEffect(() => {
        if (autosaveData && !baseline.current)
            baseline.current = JSON.stringify(autosaveData);
    }, [autosaveData]);
    const productDirty = !!autosaveData && baseline.current !== "" && JSON.stringify(autosaveData) !== baseline.current;
    useMarkDirty(`product:${id}`, productDirty);
    useAutosave({
        id,
        data: autosaveData,
        enabled: !!autosaveData && productDirty,
        save: async (snap) => {
            if (!snap)
                return;
            const payload = buildProductPayload(snap);
            if (!payload)
                return;
            const res = await upsertProduct({ data: payload });
            baseline.current = JSON.stringify(snap);
            qc.invalidateQueries({ queryKey: ["admin-products"] });
            return res;
        },
    });
    // Conflict detection based on updated_at drift while dirty.
    useConflictWatcher(product?.updated_at ?? null, isDirty);
    // Retry autosave when connectivity returns.
    const retry = useCallback(() => {
        if (!autosaveData)
            return;
        retrySave(async () => {
            const payload = buildProductPayload(autosaveData);
            if (!payload)
                return;
            const res = await upsertProduct({ data: payload });
            baseline.current = JSON.stringify(autosaveData);
            clearLocalDraft(id);
            qc.invalidateQueries({ queryKey: ["admin-products"] });
            return res;
        });
    }, [autosaveData, buildProductPayload, id, qc, upsertProduct]);
    useOnlineRecovery(retry);
    // Reset history when navigating between products.
    useEffect(() => {
        clearHistory();
        clearConflict();
    }, [id]);
    // Keyboard shortcuts.
    useEditorShortcuts({
        onSave: handleSaveDraft,
        onPreview: handlePreview,
        onDuplicate: handleDuplicate,
        onPublish: handlePublish,
        onUndo: undo,
        onRedo: redo,
        onHelp: () => setHelpOpen(true),
    });
    return (<div className="p-4 md:p-6 space-y-4">
      <ProductToolbar product={product} completion={completion} isDirty={isDirty} publishBlockers={publishBlockers} publishWarnings={publishWarnings} saving={setStatus.isPending && setStatus.variables === "draft"} publishing={setStatus.isPending && setStatus.variables === "published"} deleting={removeProduct.isPending} saveStatus={saveState.status} lastSavedAt={saveState.lastSavedAt} saveError={saveState.error} canUndo={history.canUndo} canRedo={history.canRedo} onSaveDraft={handleSaveDraft} onPublish={handlePublish} onPreview={handlePreview} onDuplicate={handleDuplicate} onDelete={handleDelete} onUndo={undo} onRedo={redo} onRetry={retry} onHelp={() => setHelpOpen(true)}/>

      <EditorHelpDialog open={helpOpen} onOpenChange={setHelpOpen}/>

      <ConflictBanner visible={!!conflict.conflictedAt} onReload={() => {
            clearConflict();
            qc.invalidateQueries({ queryKey: ["admin-products"] });
        }} onKeepMine={() => clearConflict()}/>

      <RecoveryBanner visible={!!recovery} savedAt={recovery?.at ?? null} onRestore={() => {
            retry();
            setRecovery(null);
        }} onDiscard={() => {
            clearLocalDraft(id);
            setRecovery(null);
        }}/>

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
        <Link to="/admin/products" className="hover:text-foreground">Products</Link>
        <span>›</span>
        <span className="text-foreground">{product?.title ?? "…"}</span>
        <span>›</span>
        <span className="capitalize">{tab.replace("-", " ")}</span>
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/products"><ArrowLeft className="h-4 w-4 mr-1"/> Products</Link></Button>
        <h1 className="text-2xl font-bold flex-1">{product?.title ?? "Manage product"}</h1>
      </div>

      {/* Wizard steps */}
      <WizardSteps steps={wizardSteps} currentTab={tab} onJump={setTab}/>

      {publishBlocked && (<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive"/>
          <div>
            <div className="font-medium text-destructive">Publishing disabled</div>
            <div className="text-muted-foreground">This product has no variants yet. Add attributes and generate variants first.</div>
          </div>
        </div>)}


      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto overflow-x-auto max-w-full">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="attributes">Attributes</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="downloads">Downloads</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
              <TabsTrigger value="rich-content">Rich Content</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="variations">Legacy</TabsTrigger>
            </TabsList>
            <TabsContent value="basic">
              <BasicInfoTab product={product} productMode={productMode} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-products"] })}/>
            </TabsContent>
            <TabsContent value="attributes">
              {attrCount === 0 && (<div className="rounded-lg border border-dashed p-6 text-center mb-4">
                  <div className="font-medium">No attributes yet</div>
                  <div className="text-sm text-muted-foreground mb-3">Create your first attribute (e.g. Country, Package, Color) below.</div>
                </div>)}
              <AttributesTab productId={id}/>
            </TabsContent>
            <TabsContent value="variants">
              {/* Variant checklist */}
              <div className="rounded-lg border bg-card p-3 mb-4">
                <div className="text-sm font-medium mb-2">Variant Checklist</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <CheckItem label="Attributes" done={attrCount > 0}/>
                  <CheckItem label="Options" done={optionCount > 0}/>
                  <CheckItem label="Variants Generated" done={variantCount > 0}/>
                  <CheckItem label="Prices" done={variantCount > 0 && variants.every((v) => Number(v.price) > 0)}/>
                  <CheckItem label="Inventory" done={variantCount > 0 && variants.some((v) => v.inventory_pool_id || v.subscription_pool_id || v.license_pool_id)}/>
                  <CheckItem label="Publish" done={product?.status === "published" && !publishBlocked}/>
                </div>
              </div>
              {variantCount === 0 && attrCount === 0 && (<div className="rounded-lg border border-dashed p-6 text-center mb-4">
                  <div className="font-medium">No variants generated</div>
                  <div className="text-sm text-muted-foreground mb-3">Add attributes first, then generate variants.</div>
                  <Button size="sm" onClick={() => setTab("attributes")}>Go to Attributes</Button>
                </div>)}
              <VariantsTab productId={id}/>
            </TabsContent>
            <TabsContent value="downloads"><DownloadsTab productId={id}/></TabsContent>
            <TabsContent value="variations"><VariationsTab productId={id}/></TabsContent>
            <TabsContent value="gallery"><GalleryTab productId={id}/></TabsContent>
            <TabsContent value="custom-fields"><CustomFieldsTab productId={id}/></TabsContent>
            <TabsContent value="rich-content"><RichContentTab productId={id}/></TabsContent>
            <TabsContent value="seo"><ProductSeoTab productId={id}/></TabsContent>
          </Tabs>
        </div>

        {/* Summary sidebar */}
        <aside className="lg:sticky lg:top-4 h-fit space-y-3 text-sm">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            {product?.thumbnail_url && (<img src={product.thumbnail_url} alt="" className="w-full aspect-square object-cover rounded-md"/>)}
            <div className="space-y-1.5">
              <Row label="Status"><Badge variant={product?.status === "published" ? "default" : "secondary"}>{product?.status ?? "—"}</Badge></Row>
              <Row label="Visibility"><span className="text-muted-foreground">{product?.visibility ?? "—"}</span></Row>
              <Row label="Product Mode"><Badge variant="outline">{productMode}</Badge></Row>
              <Row label="Product Type"><span className="text-muted-foreground">{product?.product_type ?? "—"}</span></Row>
              <Row label="Delivery"><span className="text-muted-foreground">{product?.delivery_type ?? "—"}</span></Row>
              <Row label="Attributes">{attrCount}</Row>
              <Row label="Options">{optionCount}</Row>
              <Row label="Variants">{variantCount}</Row>
              <Row label="Completion">{completion}%</Row>
            </div>
          </div>
          <AuditPanel product={product} variantCount={variantCount} downloadCount={downloads.length} imageCount={images.length} completion={completion} seoScore={(product?.seo?.meta_title ? 50 : 0) + (product?.seo?.meta_description ? 50 : 0)}/>
          <ActivityTimeline productId={id}/>
        </aside>
      </div>

      <DuplicateProductDialog open={dupOpen} onOpenChange={setDupOpen} sourceTitle={product?.title ?? "Product"} sourceSlug={product?.slug ?? "product"} busy={duplicate.isPending} onConfirm={(payload) => duplicate.mutate(payload)}/>
    </div>);
}
function Row({ label, children }) {
    return (<div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>);
}
function CheckItem({ label, done }) {
    return (<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${done ? "bg-primary/10 border-primary/30 text-primary" : "text-muted-foreground"}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5"/> : <Circle className="h-3.5 w-3.5"/>}
      {label}
    </span>);
}
/* -------- Downloads -------- */
function DownloadsTab({ productId }) {
    const list = useServerFn(adminListProductDownloadsFn);
    const upsert = useServerFn(adminUpsertProductDownloadFn);
    const del = useServerFn(adminDeleteProductDownloadFn);
    const qc = useQueryClient();
    const key = ["admin-downloads", productId];
    const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
    const [draft, setDraft] = useState({ file_name: "", file_url: "", version: "", file_size: "", sort_order: 0 });
    const save = useMutation({
        mutationFn: (row) => upsert({ data: row }),
        onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: key }); setDraft({ file_name: "", file_url: "", version: "", file_size: "", sort_order: 0 }); },
        onError: (e) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: (rid) => del({ data: { id: rid } }),
        onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: key }); },
        onError: (e) => toast.error(e.message),
    });
    return (<div className="space-y-4">
      <div className="grid grid-cols-5 gap-2 items-end p-4 border rounded-lg">
        <div><Label>File name</Label><Input value={draft.file_name} onChange={(e) => setDraft({ ...draft, file_name: e.target.value })}/></div>
        <div className="col-span-2"><Label>File URL</Label><Input value={draft.file_url} onChange={(e) => setDraft({ ...draft, file_url: e.target.value })}/></div>
        <div><Label>Version</Label><Input value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })}/></div>
        <div><Label>Size (bytes)</Label><Input type="number" value={draft.file_size} onChange={(e) => setDraft({ ...draft, file_size: e.target.value })}/></div>
        <div className="col-span-5">
          <Button size="sm" onClick={() => {
            if (!draft.file_name || !draft.file_url)
                return toast.error("Name and URL required");
            save.mutate({
                product_id: productId,
                file_name: draft.file_name,
                file_url: draft.file_url,
                version: draft.version || null,
                file_size: draft.file_size === "" ? null : Number(draft.file_size),
                sort_order: Number(draft.sort_order ?? 0),
            });
        }}><Plus className="h-4 w-4 mr-1"/> Add download</Button>
        </div>
      </div>
      <div className="border rounded-lg divide-y">
        {isLoading && <div className="p-4 text-muted-foreground">Loading…</div>}
        {data.map((d) => (<div key={d.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{d.file_name} {d.version && <span className="text-xs text-muted-foreground">v{d.version}</span>}</div>
              <div className="text-xs text-muted-foreground truncate">{d.file_url}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && remove.mutate(d.id)}><Trash2 className="h-4 w-4"/></Button>
          </div>))}
        {!isLoading && data.length === 0 && <div className="p-4 text-muted-foreground text-sm">No downloads yet.</div>}
      </div>
    </div>);
}
/* -------- Variations -------- */
function VariationsTab({ productId }) {
    const list = useServerFn(adminListVariationsFn);
    const upsert = useServerFn(adminUpsertVariationFn);
    const del = useServerFn(adminDeleteVariationFn);
    const qc = useQueryClient();
    const key = ["admin-variations", productId];
    const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
    const [draft, setDraft] = useState({ name: "", sku: "", price: 0, compare_price: "", stock: "", status: "active" });
    const save = useMutation({
        mutationFn: (row) => upsert({ data: row }),
        onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: key }); setDraft({ name: "", sku: "", price: 0, compare_price: "", stock: "", status: "active" }); },
        onError: (e) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: (rid) => del({ data: { id: rid } }),
        onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: key }); },
        onError: (e) => toast.error(e.message),
    });
    return (<div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 items-end p-4 border rounded-lg">
        <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></div>
        <div><Label>SKU</Label><Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })}/></div>
        <div><Label>Price</Label><Input type="number" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}/></div>
        <div><Label>Compare price</Label><Input type="number" step="0.01" value={draft.compare_price} onChange={(e) => setDraft({ ...draft, compare_price: e.target.value })}/></div>
        <div><Label>Stock</Label><Input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })}/></div>
        <div><Label>Status</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div className="col-span-6">
          <Button size="sm" onClick={() => {
            if (!draft.name)
                return toast.error("Name required");
            save.mutate({
                product_id: productId,
                name: draft.name,
                sku: draft.sku || null,
                price: Number(draft.price ?? 0),
                compare_price: draft.compare_price === "" ? null : Number(draft.compare_price),
                stock: draft.stock === "" ? null : Number(draft.stock),
                status: draft.status,
            });
        }}><Plus className="h-4 w-4 mr-1"/> Add variation</Button>
        </div>
      </div>
      <div className="border rounded-lg divide-y">
        {isLoading && <div className="p-4 text-muted-foreground">Loading…</div>}
        {data.map((v) => (<div key={v.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{v.name} <span className="text-xs text-muted-foreground">{v.sku ?? ""}</span></div>
              <div className="text-xs text-muted-foreground">{formatPriceWithSymbol(Number(v.price))}{v.compare_price ? ` (was ${formatPriceWithSymbol(Number(v.compare_price))})` : ""} · stock {v.stock ?? "—"} · {v.status}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && remove.mutate(v.id)}><Trash2 className="h-4 w-4"/></Button>
          </div>))}
        {!isLoading && data.length === 0 && <div className="p-4 text-muted-foreground text-sm">No variations yet.</div>}
      </div>
    </div>);
}
/* -------- Gallery -------- */
function GalleryTab({ productId }) {
    const list = useServerFn(adminListProductImagesFn);
    const upsert = useServerFn(adminUpsertProductImageFn);
    const reorder = useServerFn(adminReorderProductImagesFn);
    const del = useServerFn(adminDeleteProductImageFn);
    const qc = useQueryClient();
    const key = ["admin-images", productId];
    const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
    const [url, setUrl] = useState("");
    const [alt, setAlt] = useState("");
    const invalidate = () => qc.invalidateQueries({ queryKey: key });
    const add = useMutation({
        mutationFn: (row) => upsert({ data: row }),
        onSuccess: () => { toast.success("Added"); invalidate(); setUrl(""); setAlt(""); },
        onError: (e) => toast.error(e.message),
    });
    const setPrimary = useMutation({
        mutationFn: (row) => upsert({ data: { ...row, is_primary: true } }),
        onSuccess: () => { toast.success("Primary set"); invalidate(); },
        onError: (e) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: (rid) => del({ data: { id: rid } }),
        onSuccess: () => { toast.success("Deleted"); invalidate(); },
        onError: (e) => toast.error(e.message),
    });
    const move = async (idx, dir) => {
        const items = [...data];
        const j = idx + dir;
        if (j < 0 || j >= items.length)
            return;
        [items[idx], items[j]] = [items[j], items[idx]];
        const payload = items.map((it, i) => ({ id: it.id, sort_order: i }));
        await reorder({ data: { items: payload } });
        invalidate();
    };
    return (<div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 items-end p-4 border rounded-lg">
        <div className="col-span-3"><MediaPicker label="Image" value={url} onChange={setUrl}/></div>
        <div className="col-span-2"><Label>Alt text</Label><Input value={alt} onChange={(e) => setAlt(e.target.value)}/></div>
        <div>
          <Button size="sm" onClick={() => {
            if (!url)
                return toast.error("URL required");
            const items = data;
            add.mutate({
                product_id: productId,
                url,
                alt: alt || null,
                sort_order: items.length,
                is_primary: items.length === 0,
            });
        }}><Plus className="h-4 w-4 mr-1"/> Add image</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {data.map((img, idx) => (<div key={img.id} className="border rounded-lg overflow-hidden">
            <div className="aspect-square bg-muted">
              <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover"/>
            </div>
            <div className="p-2 flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(idx, -1)}><ArrowUp className="h-4 w-4"/></Button>
              <Button size="icon" variant="ghost" onClick={() => move(idx, 1)}><ArrowDown className="h-4 w-4"/></Button>
              <Button size="icon" variant={img.is_primary ? "default" : "ghost"} onClick={() => setPrimary.mutate({ id: img.id, product_id: productId, url: img.url, alt: img.alt })}><Star className="h-4 w-4"/></Button>
              <div className="flex-1"/>
              <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && remove.mutate(img.id)}><Trash2 className="h-4 w-4"/></Button>
            </div>
          </div>))}
        {!isLoading && data.length === 0 && <div className="text-sm text-muted-foreground">No images yet.</div>}
      </div>
    </div>);
}
/* -------- Basic Info -------- */
function BasicInfoTab({ product, productMode, onSaved, }) {
    const upsert = useServerFn(adminUpsertProductFn);
    const listCats = useServerFn(adminListCategoriesFn);
    const { data: categories = [] } = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCats() });
    const [form, setForm] = useState(() => ({
        title: "",
        slug: "",
        short_description: "",
        description: "",
        regular_price: 0,
        sale_price: "",
        thumbnail_url: "",
        status: "draft",
        visibility: "public",
        product_type: "",
        delivery_type: "",
        category_id: "",
    }));
    const loadedFor = useRef(null);
    useEffect(() => {
        if (!product)
            return;
        if (loadedFor.current === product.id)
            return;
        loadedFor.current = product.id;
        setForm({
            title: product.title ?? "",
            slug: product.slug ?? "",
            short_description: product.short_description ?? "",
            description: product.description ?? "",
            regular_price: Number(product.regular_price ?? 0),
            sale_price: product.sale_price == null ? "" : Number(product.sale_price),
            thumbnail_url: product.thumbnail_url ?? "",
            status: product.status ?? "draft",
            visibility: product.visibility ?? "public",
            product_type: product.product_type ?? "",
            delivery_type: product.delivery_type ?? "",
            category_id: product.category_id ?? "",
        });
    }, [product]);
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const save = useMutation({
        mutationFn: async () => {
            if (!product)
                throw new Error("Product not loaded");
            if (!form.title.trim())
                throw new Error("Title is required");
            if (!form.slug.trim())
                throw new Error("Slug is required");
            const payload = {
                id: product.id,
                title: form.title.trim(),
                slug: form.slug.trim(),
                short_description: form.short_description || null,
                description: form.description || null,
                regular_price: productMode === "variable" ? Number(product.regular_price ?? 0) : Number(form.regular_price || 0),
                sale_price: productMode === "variable"
                    ? product.sale_price == null ? null : Number(product.sale_price)
                    : form.sale_price === "" ? null : Number(form.sale_price),
                thumbnail_url: form.thumbnail_url || null,
                status: form.status,
                visibility: form.visibility || null,
                product_type: form.product_type || null,
                delivery_type: form.delivery_type || null,
                category_id: form.category_id ? form.category_id : null,
            };
            return upsert({ data: payload });
        },
        onSuccess: () => {
            toast.success("Basic info saved");
            onSaved();
        },
        onError: (e) => toast.error(e.message),
    });
    if (!product)
        return <div className="text-sm text-muted-foreground p-4">Loading…</div>;
    return (<div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })}/>
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={form.slug} onChange={(e) => set({ slug: e.target.value })}/>
        </div>
      </div>

      <div>
        <Label>Short description</Label>
        <textarea className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm" value={form.short_description} onChange={(e) => set({ short_description: e.target.value })}/>
      </div>

      <div>
        <Label>Full description</Label>
        <div className="mt-2">
          <RichTextEditor value={form.description} onChange={(html) => set({ description: html })} placeholder="Enter detailed product description..."/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Status</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="private">private</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div>
          <Label>Visibility</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.visibility} onChange={(e) => set({ visibility: e.target.value })}>
            <option value="public">public</option>
            <option value="members_only">members_only</option>
            <option value="hidden">hidden</option>
          </select>
        </div>
        <div>
          <Label>Product type</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.product_type} onChange={(e) => set({ product_type: e.target.value })}>
            <option value="">—</option>
            <option value="downloadable">downloadable</option>
            <option value="license_key">license_key</option>
            <option value="subscription">subscription</option>
            <option value="account">account</option>
            <option value="external">external</option>
            <option value="manual">manual</option>
          </select>
        </div>
        <div>
          <Label>Delivery type</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.delivery_type} onChange={(e) => set({ delivery_type: e.target.value })}>
            <option value="">—</option>
            <option value="download">download</option>
            <option value="license_key">license_key</option>
            <option value="account">account</option>
            <option value="manual">manual</option>
            <option value="external_url">external_url</option>
          </select>
        </div>
      </div>

      {productMode === "simple" ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Regular price ({useSettings.getState().settings.payment.currency_symbol || "$"})</Label>
            <Input type="number" step="0.01" value={form.regular_price} onChange={(e) => set({ regular_price: e.target.value })}/>
          </div>
          <div>
            <Label>Sale price ({useSettings.getState().settings.payment.currency_symbol || "$"})</Label>
            <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => set({ sale_price: e.target.value })}/>
          </div>
        </div>) : (<div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          This is a Variable product. Pricing is set per variant in the Variants tab.
        </div>)}

      <div>
        <Label>Category</Label>
        <div className="flex items-center gap-2">
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.category_id || ""} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">— Uncategorized —</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <Link to="/admin/categories" className="text-xs text-primary whitespace-nowrap hover:underline">
            Manage
          </Link>
        </div>
      </div>

      <div>
        <MediaPicker label="Featured image" value={form.thumbnail_url} onChange={(v) => set({ thumbnail_url: v })}/>
      </div>


      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save basic info"}
        </Button>
      </div>
    </div>);
}
