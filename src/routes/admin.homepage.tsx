import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { adminListSettingsFn, adminUpsertSettingFn } from "@/lib/admin-settings.functions";
import {
  defaultHomepageConfig,
  mergeConfig,
  useHomepage,
  reorder,
  newId,
  HERO_FEATURE_BADGES_MAX,
  type HomepageConfig,
  type SectionId,
  type HomeProductSection,
  type HomeTrustItem,
  type HomeWhyChooseItem,
  type HomeStatItem,
  type HomeTestimonial,
  type HomeFaqItem,
  type HeroProductSource,
  type HeaderNavItem,
  type HeroFeatureBadge,
} from "@/lib/cms/homepage";
import { useQuery } from "@tanstack/react-query";
import { searchQuery, productsBySlugsQuery, categoriesQuery, type Product } from "@/lib/catalog";
import type { HomeCategorySource } from "@/lib/cms/homepage";
import { iconRegistry, resolveIcon, type IconName } from "@/lib/cms/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/homepage")({
  component: HomepageBuilder,
});

const SECTION_LABELS: Record<SectionId, string> = {
  hero: "Hero",
  trust: "Trust Features",
  categories: "Categories",
  productSections: "Product Sections",
  whyChoose: "Why Choose",
  stats: "Statistics",
  testimonials: "Testimonials",
  blog: "Blog",
  faq: "FAQ",
  paymentMethods: "Payment Methods",
  newsletter: "Newsletter",
};

function HomepageBuilder() {
  const list = useServerFn(adminListSettingsFn);
  const upsert = useServerFn(adminUpsertSettingFn);
  const setLocal = useHomepage((s) => s.setLocal);
  const reloadStore = useHomepage((s) => s.load);
  const [cfg, setCfg] = useState<HomepageConfig>(defaultHomepageConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = (await list()) as Array<{ group_key: string; setting_key: string; value: Record<string, unknown> }>;
        const row = rows.find((r) => r.group_key === "homepage" && r.setting_key === "config");
        if (row?.value) {
          setCfg(mergeConfig(defaultHomepageConfig, row.value as Partial<HomepageConfig>));
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [list]);

  async function save() {
    setSaving(true);
    try {
      await upsert({ data: { group_key: "homepage", setting_key: "config", value: cfg as unknown as Record<string, unknown> } });
      setLocal(cfg);
      await reloadStore();
      toast.success("Homepage saved — changes are live");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const patch = <K extends keyof HomepageConfig>(k: K, v: HomepageConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading homepage config…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Homepage Builder</h1>
          <p className="text-sm text-muted-foreground">Edit every homepage section. Save to apply changes instantly.</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Homepage
        </Button>
      </div>

      <Tabs defaultValue="layout">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="layout">Layout & Order</TabsTrigger>
          <TabsTrigger value="announcement">Announcement Bar</TabsTrigger>
          <TabsTrigger value="headerNav">Header Navigation</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="trust">Trust</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="whyChoose">Why Choose</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ---------------- Announcement Bar ---------------- */}
        <TabsContent value="announcement" className="mt-4 space-y-4">
          <EnableToggle
            label="Enable Announcement Bar"
            value={cfg.announcementBar.enabled}
            onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, enabled: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Announcement text" value={cfg.announcementBar.text} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, text: v })} />
            <Field label="Highlight text (badge)" value={cfg.announcementBar.highlight} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, highlight: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button text" value={cfg.announcementBar.buttonLabel} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, buttonLabel: v })} />
            <Field label="Button URL" value={cfg.announcementBar.buttonUrl} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, buttonUrl: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Enable countdown" value={cfg.announcementBar.countdownEnabled} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, countdownEnabled: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs">Countdown end date/time</Label>
              <Input
                type="datetime-local"
                value={cfg.announcementBar.countdownEndsAt ? cfg.announcementBar.countdownEndsAt.slice(0, 16) : ""}
                onChange={(e) => patch("announcementBar", { ...cfg.announcementBar, countdownEndsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Background color (CSS, blank = theme)" value={cfg.announcementBar.backgroundColor} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, backgroundColor: v })} />
            <Field label="Text color (CSS, blank = theme)" value={cfg.announcementBar.textColor} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, textColor: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Show close button" value={cfg.announcementBar.closable} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, closable: v })} />
            <Toggle label="Sticky on scroll" value={cfg.announcementBar.sticky} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, sticky: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Show on desktop" value={cfg.announcementBar.showOnDesktop} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, showOnDesktop: v })} />
            <Toggle label="Show on mobile" value={cfg.announcementBar.showOnMobile} onChange={(v) => patch("announcementBar", { ...cfg.announcementBar, showOnMobile: v })} />
          </div>
        </TabsContent>

        {/* ---------------- Header Navigation ---------------- */}
        <TabsContent value="headerNav" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Manage the primary header menu. Items appear on both desktop and mobile. Disabled items are hidden. Reorder with the arrows.
          </p>
          <ItemList<HeaderNavItem>
            items={cfg.headerNav.items}
            onChange={(items) => patch("headerNav", { ...cfg.headerNav, items })}
            makeNew={() => ({ id: newId("nav"), label: "New link", url: "/", enabled: true })}
            renderItem={(it, set) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Label" value={it.label} onChange={(v) => set({ ...it, label: v })} />
                <Field label="URL" value={it.url} onChange={(v) => set({ ...it, url: v })} />
              </div>
            )}
          />
        </TabsContent>




        {/* ---------------- Layout & Order ---------------- */}
        <TabsContent value="layout" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">Reorder sections with the arrows. Toggle visibility on each section's tab.</p>
          {cfg.sectionOrder.map((id, i) => (
            <div key={id} className="flex items-center justify-between rounded-md border p-3 gap-3">
              <div className="font-medium text-sm">{i + 1}. {SECTION_LABELS[id]}</div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" disabled={i === 0} onClick={() => patch("sectionOrder", reorder(cfg.sectionOrder, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" disabled={i === cfg.sectionOrder.length - 1} onClick={() => patch("sectionOrder", reorder(cfg.sectionOrder, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ---------------- Hero ---------------- */}
        <TabsContent value="hero" className="mt-4 space-y-4">
          <EnableToggle label="Enable Hero section" value={cfg.hero.enabled} onChange={(v) => patch("hero", { ...cfg.hero, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Badge icon" value={cfg.hero.badge.icon} onChange={(v) => patch("hero", { ...cfg.hero, badge: { ...cfg.hero.badge, icon: v as IconName } })} />
            <Field label="Badge text" value={cfg.hero.badge.text} onChange={(v) => patch("hero", { ...cfg.hero, badge: { ...cfg.hero.badge, text: v } })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title (lead)" value={cfg.hero.title.lead} onChange={(v) => patch("hero", { ...cfg.hero, title: { ...cfg.hero.title, lead: v } })} />
            <Field label="Title (highlight)" value={cfg.hero.title.accent} onChange={(v) => patch("hero", { ...cfg.hero, title: { ...cfg.hero.title, accent: v } })} />
          </div>
          <Area label="Description" value={cfg.hero.description} onChange={(v) => patch("hero", { ...cfg.hero, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary button label" value={cfg.hero.primaryCta.label} onChange={(v) => patch("hero", { ...cfg.hero, primaryCta: { ...cfg.hero.primaryCta, label: v } })} />
            <Field label="Primary button link" value={cfg.hero.primaryCta.to} onChange={(v) => patch("hero", { ...cfg.hero, primaryCta: { ...cfg.hero.primaryCta, to: v } })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secondary button label" value={cfg.hero.secondaryCta.label} onChange={(v) => patch("hero", { ...cfg.hero, secondaryCta: { ...cfg.hero.secondaryCta, label: v } })} />
            <Field label="Secondary button href" value={cfg.hero.secondaryCta.href} onChange={(v) => patch("hero", { ...cfg.hero, secondaryCta: { ...cfg.hero.secondaryCta, href: v } })} />
          </div>
          <HeroProductPicker
            source={cfg.hero.productSource ?? "manual"}
            manualSlugs={(cfg.hero.manualProductSlugs && cfg.hero.manualProductSlugs.length > 0 ? cfg.hero.manualProductSlugs : cfg.hero.floatingProductSlugs) ?? []}
            onSourceChange={(s) => patch("hero", { ...cfg.hero, productSource: s })}
            onManualChange={(slugs) => patch("hero", { ...cfg.hero, manualProductSlugs: slugs, floatingProductSlugs: slugs.slice(0, 6) })}
          />

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Feature Badges</h3>
              <p className="text-xs text-muted-foreground">
                Small badges shown below the Hero buttons (e.g. Instant Delivery, Secure Checkout). Up to {HERO_FEATURE_BADGES_MAX} badges. Leave empty to restore defaults.
              </p>
            </div>
            <ItemList<HeroFeatureBadge>
              items={cfg.hero.featureBadges ?? []}
              onChange={(items) => patch("hero", { ...cfg.hero, featureBadges: items })}
              max={HERO_FEATURE_BADGES_MAX}
              makeNew={() => ({ id: newId("badge"), enabled: true, icon: "Zap", title: "New badge", subtitle: "", url: "" })}
              renderItem={(it, set) => (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Icon" value={it.icon} onChange={(v) => set({ ...it, icon: v as IconName })} />
                  <Field label="Title" value={it.title} onChange={(v) => set({ ...it, title: v })} />
                  <Field label="Subtitle (optional)" value={it.subtitle ?? ""} onChange={(v) => set({ ...it, subtitle: v })} />
                  <Field label="URL (optional)" value={it.url ?? ""} onChange={(v) => set({ ...it, url: v })} />
                </div>
              )}
            />
          </div>

        </TabsContent>

        {/* ---------------- Trust ---------------- */}
        <TabsContent value="trust" className="mt-4 space-y-3">
          <EnableToggle label="Enable Trust section" value={cfg.trust.enabled} onChange={(v) => patch("trust", { ...cfg.trust, enabled: v })} />
          <ItemList<HomeTrustItem>
            items={cfg.trust.items}
            onChange={(items) => patch("trust", { ...cfg.trust, items })}
            renderItem={(it, set) => (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Icon" value={it.icon} onChange={(v) => set({ ...it, icon: v as IconName })} />
                <Field label="Title" value={it.title} onChange={(v) => set({ ...it, title: v })} />
                <Field label="Description" value={it.desc} onChange={(v) => set({ ...it, desc: v })} />
              </div>
            )}
            makeNew={() => ({ id: newId("trust"), icon: "Zap", title: "New feature", desc: "Describe it.", enabled: true })}
          />
        </TabsContent>

        {/* ---------------- Categories ---------------- */}
        <TabsContent value="categories" className="mt-4 space-y-4">
          <EnableToggle label="Enable Categories section" value={cfg.categories.enabled} onChange={(v) => patch("categories", { ...cfg.categories, enabled: v })} />
          <Field label="Eyebrow" value={cfg.categories.eyebrow} onChange={(v) => patch("categories", { ...cfg.categories, eyebrow: v })} />
          <Field label="Title" value={cfg.categories.title} onChange={(v) => patch("categories", { ...cfg.categories, title: v })} />
          <Area label="Subtitle" value={cfg.categories.subtitle} onChange={(v) => patch("categories", { ...cfg.categories, subtitle: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="View all label" value={cfg.categories.viewAllLabel} onChange={(v) => patch("categories", { ...cfg.categories, viewAllLabel: v })} />
            <NumberField label="Limit (auto modes)" value={cfg.categories.limit} onChange={(v) => patch("categories", { ...cfg.categories, limit: v })} />
          </div>
          <CategoryPicker
            source={cfg.categories.source ?? "manual"}
            manualIds={cfg.categories.manualCategoryIds ?? []}
            featuredIds={cfg.categories.featuredCategoryIds ?? []}
            onSourceChange={(s) => patch("categories", { ...cfg.categories, source: s })}
            onManualChange={(ids) => patch("categories", { ...cfg.categories, manualCategoryIds: ids })}
            onFeaturedChange={(ids) => patch("categories", { ...cfg.categories, featuredCategoryIds: ids })}
          />
        </TabsContent>

        {/* ---------------- Product sections ---------------- */}
        <TabsContent value="products" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Each section can pull from a curated list (Latest / Featured / Trending / Best sellers) or use a manual product selection with custom ordering. Each section also has an optional countdown timer.
          </p>
          <ItemList<HomeProductSection>
            items={cfg.productSections}
            onChange={(items) => patch("productSections", items)}
            renderItem={(it, set) => (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Eyebrow" value={it.eyebrow} onChange={(v) => set({ ...it, eyebrow: v })} />
                  <Field label="Title" value={it.title} onChange={(v) => set({ ...it, title: v })} />
                </div>
                <Field label="Subtitle" value={it.subtitle} onChange={(v) => set({ ...it, subtitle: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label="Product source"
                    value={it.source}
                    options={[
                      { value: "latest", label: "Latest Products" },
                      { value: "featured", label: "Featured Products" },
                      { value: "trending", label: "Trending Products" },
                      { value: "bestSellers", label: "Best Sellers" },
                      { value: "manual", label: "Manual Products" },
                    ]}
                    onChange={(v) => set({ ...it, source: v as HomeProductSection["source"] })}
                  />
                  <NumberField label="Limit (auto modes)" value={it.limit} onChange={(v) => set({ ...it, limit: v })} />
                </div>
                {it.source === "manual" && (
                  <SectionProductPicker
                    slugs={it.manualProductSlugs ?? []}
                    onChange={(slugs) => set({ ...it, manualProductSlugs: slugs })}
                  />
                )}
                <SectionCountdownEditor
                  countdown={it.countdown}
                  onChange={(c) => set({ ...it, countdown: c })}
                />
              </>
            )}
            makeNew={() => ({ id: newId("psec"), enabled: true, eyebrow: "New section", title: "Untitled", subtitle: "", source: "featured", limit: 8, manualProductSlugs: [], countdown: { enabled: false, endsAt: "", label: "", hideAfterExpiry: true, expiredMessage: "" } })}
          />
        </TabsContent>


        {/* ---------------- Why choose ---------------- */}
        <TabsContent value="whyChoose" className="mt-4 space-y-3">
          <EnableToggle label="Enable Why Choose section" value={cfg.whyChoose.enabled} onChange={(v) => patch("whyChoose", { ...cfg.whyChoose, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eyebrow" value={cfg.whyChoose.eyebrow} onChange={(v) => patch("whyChoose", { ...cfg.whyChoose, eyebrow: v })} />
            <Field label="Title" value={cfg.whyChoose.title} onChange={(v) => patch("whyChoose", { ...cfg.whyChoose, title: v })} />
          </div>
          <ItemList<HomeWhyChooseItem>
            items={cfg.whyChoose.items}
            onChange={(items) => patch("whyChoose", { ...cfg.whyChoose, items })}
            renderItem={(it, set) => (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Icon" value={it.icon} onChange={(v) => set({ ...it, icon: v as IconName })} />
                <Field label="Title" value={it.title} onChange={(v) => set({ ...it, title: v })} />
                <Field label="Description" value={it.desc} onChange={(v) => set({ ...it, desc: v })} />
              </div>
            )}
            makeNew={() => ({ id: newId("why"), icon: "Zap", title: "New benefit", desc: "Describe it.", enabled: true })}
          />
        </TabsContent>

        {/* ---------------- Stats ---------------- */}
        <TabsContent value="stats" className="mt-4 space-y-3">
          <EnableToggle label="Enable Stats section" value={cfg.stats.enabled} onChange={(v) => patch("stats", { ...cfg.stats, enabled: v })} />
          <ItemList<HomeStatItem>
            items={cfg.stats.items}
            onChange={(items) => patch("stats", { ...cfg.stats, items })}
            renderItem={(it, set) => (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Value (e.g. 200K+, 4.9★)" value={it.value} onChange={(v) => set({ ...it, value: v })} />
                <Field label="Label" value={it.label} onChange={(v) => set({ ...it, label: v })} />
              </div>
            )}
            makeNew={() => ({ id: newId("stat"), value: "100+", label: "New metric", enabled: true })}
          />
        </TabsContent>

        {/* ---------------- Testimonials ---------------- */}
        <TabsContent value="testimonials" className="mt-4 space-y-3">
          <EnableToggle label="Enable Testimonials" value={cfg.testimonials.enabled} onChange={(v) => patch("testimonials", { ...cfg.testimonials, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eyebrow" value={cfg.testimonials.eyebrow} onChange={(v) => patch("testimonials", { ...cfg.testimonials, eyebrow: v })} />
            <Field label="Title" value={cfg.testimonials.title} onChange={(v) => patch("testimonials", { ...cfg.testimonials, title: v })} />
          </div>
          <ItemList<HomeTestimonial>
            items={cfg.testimonials.items}
            onChange={(items) => patch("testimonials", { ...cfg.testimonials, items })}
            renderItem={(it, set) => (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Name" value={it.name} onChange={(v) => set({ ...it, name: v })} />
                  <Field label="Role" value={it.role} onChange={(v) => set({ ...it, role: v })} />
                  <Field label="Avatar (emoji)" value={it.emoji} onChange={(v) => set({ ...it, emoji: v })} />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <NumberField label="Rating" value={it.rating} onChange={(v) => set({ ...it, rating: Math.min(5, Math.max(1, v)) })} />
                  <Area label="Review" value={it.text} onChange={(v) => set({ ...it, text: v })} />
                </div>
              </>
            )}
            makeNew={() => ({ id: newId("test"), name: "Customer", role: "Buyer", emoji: "🙂", rating: 5, text: "Great service!", enabled: true })}
          />
        </TabsContent>

        {/* ---------------- Blog ---------------- */}
        <TabsContent value="blog" className="mt-4 space-y-4">
          <EnableToggle label="Enable Blog section" value={cfg.blog.enabled} onChange={(v) => patch("blog", { ...cfg.blog, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eyebrow" value={cfg.blog.eyebrow} onChange={(v) => patch("blog", { ...cfg.blog, eyebrow: v })} />
            <Field label="Title" value={cfg.blog.title} onChange={(v) => patch("blog", { ...cfg.blog, title: v })} />
          </div>
          <Area label="Subtitle" value={cfg.blog.subtitle} onChange={(v) => patch("blog", { ...cfg.blog, subtitle: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Posts limit" value={cfg.blog.limit} onChange={(v) => patch("blog", { ...cfg.blog, limit: v })} />
            <Field label="View all label" value={cfg.blog.viewAllLabel} onChange={(v) => patch("blog", { ...cfg.blog, viewAllLabel: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Show image" value={cfg.blog.showImage} onChange={(v) => patch("blog", { ...cfg.blog, showImage: v })} />
            <Toggle label="Show date" value={cfg.blog.showDate} onChange={(v) => patch("blog", { ...cfg.blog, showDate: v })} />
            <Toggle label="Show excerpt" value={cfg.blog.showExcerpt} onChange={(v) => patch("blog", { ...cfg.blog, showExcerpt: v })} />
            <Toggle label="Show Read More" value={cfg.blog.showReadMore} onChange={(v) => patch("blog", { ...cfg.blog, showReadMore: v })} />
          </div>
        </TabsContent>

        {/* ---------------- FAQ ---------------- */}
        <TabsContent value="faq" className="mt-4 space-y-3">
          <EnableToggle label="Enable FAQ section" value={cfg.faq.enabled} onChange={(v) => patch("faq", { ...cfg.faq, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eyebrow" value={cfg.faq.eyebrow} onChange={(v) => patch("faq", { ...cfg.faq, eyebrow: v })} />
            <Field label="Title" value={cfg.faq.title} onChange={(v) => patch("faq", { ...cfg.faq, title: v })} />
          </div>
          <ItemList<HomeFaqItem>
            items={cfg.faq.items}
            onChange={(items) => patch("faq", { ...cfg.faq, items })}
            renderItem={(it, set) => (
              <>
                <Field label="Question" value={it.q} onChange={(v) => set({ ...it, q: v })} />
                <Area label="Answer" value={it.a} onChange={(v) => set({ ...it, a: v })} />
              </>
            )}
            makeNew={() => ({ id: newId("faq"), q: "New question?", a: "Answer here.", enabled: true })}
          />
        </TabsContent>

        {/* ---------------- Newsletter ---------------- */}
        <TabsContent value="newsletter" className="mt-4 space-y-4">
          <EnableToggle label="Enable Newsletter section" value={cfg.newsletter.enabled} onChange={(v) => patch("newsletter", { ...cfg.newsletter, enabled: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Badge icon" value={cfg.newsletter.badge.icon} onChange={(v) => patch("newsletter", { ...cfg.newsletter, badge: { ...cfg.newsletter.badge, icon: v as IconName } })} />
            <Field label="Badge text" value={cfg.newsletter.badge.text} onChange={(v) => patch("newsletter", { ...cfg.newsletter, badge: { ...cfg.newsletter.badge, text: v } })} />
          </div>
          <Field label="Title" value={cfg.newsletter.title} onChange={(v) => patch("newsletter", { ...cfg.newsletter, title: v })} />
          <Area label="Description" value={cfg.newsletter.subtitle} onChange={(v) => patch("newsletter", { ...cfg.newsletter, subtitle: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Input placeholder" value={cfg.newsletter.placeholder} onChange={(v) => patch("newsletter", { ...cfg.newsletter, placeholder: v })} />
            <Field label="Button label" value={cfg.newsletter.buttonLabel} onChange={(v) => patch("newsletter", { ...cfg.newsletter, buttonLabel: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button icon" value={cfg.newsletter.buttonIcon} onChange={(v) => patch("newsletter", { ...cfg.newsletter, buttonIcon: v as IconName })} />
            <Field label="Success message" value={cfg.newsletter.successMessage} onChange={(v) => patch("newsletter", { ...cfg.newsletter, successMessage: v })} />
          </div>
        </TabsContent>

        {/* ---------------- Payments ---------------- */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <EnableToggle label="Enable Payments strip" value={cfg.paymentMethods.enabled} onChange={(v) => patch("paymentMethods", { ...cfg.paymentMethods, enabled: v })} />
          <Field label="Trust label" value={cfg.paymentMethods.trustLabel} onChange={(v) => patch("paymentMethods", { ...cfg.paymentMethods, trustLabel: v })} />
          <Field label="Title" value={cfg.paymentMethods.title} onChange={(v) => patch("paymentMethods", { ...cfg.paymentMethods, title: v })} />
          <Area label="Subtitle" value={cfg.paymentMethods.subtitle} onChange={(v) => patch("paymentMethods", { ...cfg.paymentMethods, subtitle: v })} />
          <p className="text-xs text-muted-foreground">Payment logos are managed in <a className="text-primary underline" href="/admin/gateways">Admin → Gateways</a>. Upload an SVG/PNG/WEBP per gateway, set the order, and toggle enabled — the homepage renders them automatically.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Reusable inputs ----------------

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label className="cursor-pointer text-sm">{label}</Label>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

function EnableToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-3">
      <Label className="cursor-pointer text-sm font-semibold">{label}</Label>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

type Identified = { id: string; enabled: boolean };

function ItemList<T extends Identified>({ items, onChange, renderItem, makeNew, max }: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, set: (next: T) => void) => React.ReactNode;
  makeNew: () => T;
  max?: number;
}) {
  const setAt = (i: number, next: T) => onChange(items.map((it, idx) => (idx === i ? next : it)));
  const move = (i: number, dir: -1 | 1) => onChange(reorder(items, i, i + dir));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const atMax = typeof max === "number" && items.length >= max;
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">#{i + 1}</div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-2">Enabled</span>
              <Switch checked={it.enabled} onCheckedChange={(v) => setAt(i, { ...it, enabled: v })} />
              <Button variant="outline" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
          {renderItem(it, (next) => setAt(i, next))}
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...items, makeNew()])} className="gap-2" disabled={atMax}>
        <Plus className="h-4 w-4" /> {atMax ? `Maximum ${max} items` : "Add item"}
      </Button>
    </div>
  );
}

// ---------------- Hero product picker ----------------

const HERO_SOURCE_OPTIONS: { value: HeroProductSource; label: string; desc: string }[] = [
  { value: "manual", label: "Manual selection", desc: "Pick specific products and set their order." },
  { value: "featured", label: "Featured products", desc: "Newest featured products (auto)." },
  { value: "latest", label: "Latest products", desc: "Most recently published products (auto)." },
];

function HeroProductPicker({
  source, manualSlugs, onSourceChange, onManualChange,
}: {
  source: HeroProductSource;
  manualSlugs: string[];
  onSourceChange: (s: HeroProductSource) => void;
  onManualChange: (slugs: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected = useQuery({ ...productsBySlugsQuery(manualSlugs), enabled: manualSlugs.length > 0 });
  const search = useQuery({ ...searchQuery(q), enabled: source === "manual" && q.trim().length >= 2 });
  const selectedProducts: Product[] = selected.data ?? [];
  // Preserve manualSlugs ordering
  const orderedSelected = manualSlugs
    .map((slug) => selectedProducts.find((p) => p.slug === slug))
    .filter(Boolean) as Product[];
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= manualSlugs.length) return;
    const next = [...manualSlugs];
    [next[i], next[j]] = [next[j], next[i]];
    onManualChange(next);
  };
  const remove = (slug: string) => onManualChange(manualSlugs.filter((s) => s !== slug));
  const add = (slug: string) => {
    if (manualSlugs.includes(slug)) return;
    if (manualSlugs.length >= 12) { toast.error("Maximum 12 products"); return; }
    onManualChange([...manualSlugs, slug]);
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-sm font-semibold">Hero products</Label>
        <p className="text-xs text-muted-foreground">Displays the first 6 of your selected pool inside the hero cards. Up to 12 products.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {HERO_SOURCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSourceChange(o.value)}
            className={`text-left rounded-md border p-3 hover:border-primary transition ${source === o.value ? "border-primary bg-primary/5" : ""}`}
          >
            <div className="text-sm font-semibold">{o.label}</div>
            <div className="text-xs text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>

      {source === "manual" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Search products to add</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 characters…" />
            {q.trim().length >= 2 && (
              <div className="mt-1 max-h-56 overflow-auto rounded-md border">
                {(search.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
                {(search.data ?? []).map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => add(p.slug)}
                    disabled={manualSlugs.includes(p.slug)}
                    className="flex w-full items-center justify-between gap-2 border-b p-2 text-left text-sm hover:bg-muted/40 disabled:opacity-50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{manualSlugs.includes(p.slug) ? "Added" : "Add"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">Selected ({manualSlugs.length}/12)</Label>
            </div>
            {manualSlugs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">No products selected yet.</div>
            ) : (
              <div className="space-y-1.5">
                {manualSlugs.map((slug, i) => {
                  const p = orderedSelected.find((x) => x.slug === slug);
                  return (
                    <div key={slug} className="flex items-center gap-2 rounded-md border p-2">
                      <span className="w-6 text-xs text-muted-foreground">#{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{p?.name ?? slug}</span>
                      <Button variant="outline" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" disabled={i === manualSlugs.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => remove(slug)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Category picker ----------------

const CATEGORY_SOURCE_OPTIONS: { value: HomeCategorySource; label: string; desc: string }[] = [
  { value: "manual", label: "Manual selection", desc: "Pick specific categories and set their order." },
  { value: "featured", label: "Featured categories", desc: "Curated featured list (managed below)." },
  { value: "latest", label: "Latest categories", desc: "Automatic — uses sort order and limit." },
];

function CategoryPicker({
  source, manualIds, featuredIds, onSourceChange, onManualChange, onFeaturedChange,
}: {
  source: HomeCategorySource;
  manualIds: string[];
  featuredIds: string[];
  onSourceChange: (s: HomeCategorySource) => void;
  onManualChange: (ids: string[]) => void;
  onFeaturedChange: (ids: string[]) => void;
}) {
  const cats = useQuery(categoriesQuery()).data ?? [];
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-sm font-semibold">Category source</Label>
        <p className="text-xs text-muted-foreground">Choose how the homepage decides which categories to render.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {CATEGORY_SOURCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSourceChange(o.value)}
            className={`text-left rounded-md border p-3 hover:border-primary transition ${source === o.value ? "border-primary bg-primary/5" : ""}`}
          >
            <div className="text-sm font-semibold">{o.label}</div>
            <div className="text-xs text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>

      {source === "manual" && (
        <CategoryList
          label="Selected categories"
          ids={manualIds}
          all={cats}
          onChange={onManualChange}
        />
      )}
      {source === "featured" && (
        <CategoryList
          label="Featured categories"
          ids={featuredIds}
          all={cats}
          onChange={onFeaturedChange}
        />
      )}
      {source === "latest" && (
        <div className="text-xs text-muted-foreground">Automatic — categories render by sort order, capped by the Limit above.</div>
      )}
    </div>
  );
}

function CategoryList({
  label, ids, all, onChange,
}: {
  label: string;
  ids: string[];
  all: { id: string; name: string; emoji: string }[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const byId = new Map(all.map((c) => [c.id, c]));
  const available = all.filter((c) => !ids.includes(c.id) && (q.trim() === "" || c.name.toLowerCase().includes(q.trim().toLowerCase())));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (id: string) => onChange(ids.filter((x) => x !== id));
  const add = (id: string) => { if (!ids.includes(id)) onChange([...ids, id]); };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Search categories to add</Label>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter…" />
        <div className="mt-1 max-h-56 overflow-auto rounded-md border">
          {available.length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
          {available.slice(0, 30).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => add(c.id)}
              className="flex w-full items-center justify-between gap-2 border-b p-2 text-left text-sm hover:bg-muted/40"
            >
              <span className="truncate">{c.emoji} {c.name}</span>
              <span className="text-xs text-muted-foreground">Add</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs">{label} ({ids.length})</Label>
        </div>
        {ids.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No categories selected — homepage will fall back to automatic (latest).
          </div>
        ) : (
          <div className="space-y-1.5">
            {ids.map((id, i) => {
              const c = byId.get(id);
              return (
                <div key={id} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="w-6 text-xs text-muted-foreground">#{i + 1}</span>
                  <span className="flex-1 truncate text-sm">{c ? `${c.emoji} ${c.name}` : `(missing: ${id})`}</span>
                  <Button variant="outline" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" disabled={i === ids.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => remove(id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Product section — manual product picker ----------------

function SectionProductPicker({ slugs, onChange }: { slugs: string[]; onChange: (slugs: string[]) => void }) {
  const [q, setQ] = useState("");
  const selected = useQuery({ ...productsBySlugsQuery(slugs), enabled: slugs.length > 0 });
  const search = useQuery({ ...searchQuery(q), enabled: q.trim().length >= 2 });
  const selectedProducts: Product[] = selected.data ?? [];
  const ordered = slugs
    .map((slug) => selectedProducts.find((p) => p.slug === slug))
    .filter(Boolean) as Product[];
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slugs.length) return;
    const next = [...slugs];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (slug: string) => onChange(slugs.filter((s) => s !== slug));
  const add = (slug: string) => {
    if (slugs.includes(slug)) return;
    onChange([...slugs, slug]);
  };
  return (
    <div className="space-y-3 rounded-md border p-3 bg-background">
      <div className="space-y-1.5">
        <Label className="text-xs">Search products to add</Label>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 characters…" />
        {q.trim().length >= 2 && (
          <div className="mt-1 max-h-56 overflow-auto rounded-md border">
            {(search.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
            {(search.data ?? []).map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => add(p.slug)}
                disabled={slugs.includes(p.slug)}
                className="flex w-full items-center justify-between gap-2 border-b p-2 text-left text-sm hover:bg-muted/40 disabled:opacity-50"
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{slugs.includes(p.slug) ? "Added" : "Add"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs">Selected products ({slugs.length})</Label>
        {slugs.length === 0 ? (
          <div className="mt-1 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No products selected — will fall back to Featured products automatically.
          </div>
        ) : (
          <div className="mt-1 space-y-1.5">
            {slugs.map((slug, i) => {
              const p = ordered.find((x) => x.slug === slug);
              return (
                <div key={slug} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="w-6 text-xs text-muted-foreground">#{i + 1}</span>
                  <span className="flex-1 truncate text-sm">{p?.name ?? slug}</span>
                  <Button variant="outline" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" disabled={i === slugs.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => remove(slug)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Product section — countdown editor ----------------

function SectionCountdownEditor({
  countdown,
  onChange,
}: {
  countdown: HomeProductSection["countdown"];
  onChange: (c: NonNullable<HomeProductSection["countdown"]>) => void;
}) {
  const c = countdown ?? { enabled: false, endsAt: "", label: "", hideAfterExpiry: true, expiredMessage: "" };
  const set = (patch: Partial<NonNullable<HomeProductSection["countdown"]>>) => onChange({ ...c, ...patch });
  return (
    <div className="space-y-3 rounded-md border p-3 bg-background">
      <Toggle label="Enable countdown" value={c.enabled} onChange={(v) => set({ enabled: v })} />
      {c.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Countdown end date/time</Label>
              <Input
                type="datetime-local"
                value={c.endsAt ? c.endsAt.slice(0, 16) : ""}
                onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })}
              />
            </div>
            <Field label="Countdown label (optional)" value={c.label ?? ""} onChange={(v) => set({ label: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Hide countdown after expiry" value={c.hideAfterExpiry} onChange={(v) => set({ hideAfterExpiry: v })} />
            <Field label="Expired message (optional)" value={c.expiredMessage ?? ""} onChange={(v) => set({ expiredMessage: v })} />
          </div>
        </>
      )}
    </div>
  );
}

