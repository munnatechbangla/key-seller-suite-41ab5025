// Central registry of supported homepage section types.
// Adding a new type: add here + handle it in SectionRenderer.tsx.

export type SectionTypeKey =
  | "hero"
  | "announcement"
  | "features"
  | "categories"
  | "featured_categories"
  | "featured_products"
  | "latest_products"
  | "best_selling_products"
  | "trending_products"
  | "flash_sale"
  | "collections"
  | "brands"
  | "testimonials"
  | "customer_counter"
  | "statistics"
  | "faq"
  | "blog_posts"
  | "newsletter"
  | "video"
  | "text_image"
  | "gallery"
  | "cta"
  | "custom_html"
  | "spacer"
  | "divider";

export type DataSource =
  | "manual"
  | "latest"
  | "featured"
  | "best_sellers"
  | "trending"
  | "category"
  | "collection"
  | "brand"
  | "blog_category";

export type SectionCommonStyle = {
  background_color?: string;
  background_image?: string;
  overlay?: string;
  padding?: string; // e.g. "80px 0"
  margin?: string;
  border_radius?: string;
  container_width?: "sm" | "md" | "lg" | "xl" | "full";
  dark_mode?: boolean;
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  animation?: "none" | "fade" | "slide-up" | "zoom";
  custom_class?: string;
};

export type SectionBase = {
  title?: string;
  subtitle?: string;
  description?: string;
  style?: SectionCommonStyle;
};

export type SectionDef = {
  key: SectionTypeKey;
  label: string;
  group: "Marketing" | "Products" | "Content" | "Media" | "Layout";
  description: string;
  defaults: Record<string, unknown>;
};

export const SECTION_TYPES: SectionDef[] = [
  { key: "hero", label: "Hero Banner", group: "Marketing", description: "Full-width slideshow with headline, CTAs, image.", defaults: { slides: [{ title: "Welcome", subtitle: "", description: "", button1: { label: "Shop now", href: "/products" }, button2: { label: "", href: "" }, image: "", badge: "", countdown: null, background: "", overlay: "" }] } },
  { key: "announcement", label: "Announcement Bar", group: "Marketing", description: "Thin promo strip at top.", defaults: { text: "Flash sale — 70% off", icon: "Zap", link: "/products" } },
  { key: "features", label: "Features Strip", group: "Content", description: "Icon + title + subtitle in a row.", defaults: { items: [{ icon: "ShieldCheck", title: "Secure", desc: "Trusted payments" }] } },
  { key: "categories", label: "Categories", group: "Products", description: "Grid or carousel of categories.", defaults: { layout: "grid", limit: 10, source: "category" as DataSource } },
  { key: "featured_categories", label: "Featured Categories", group: "Products", description: "Curated categories.", defaults: { layout: "grid", items: [] } },
  { key: "featured_products", label: "Featured Products", group: "Products", description: "Highlight featured items.", defaults: { layout: "grid", rows: 1, columns: 4, limit: 8, sort: "newest", source: "featured" as DataSource } },
  { key: "latest_products", label: "Latest Products", group: "Products", description: "Most recent products.", defaults: { layout: "grid", limit: 8, source: "latest" as DataSource } },
  { key: "best_selling_products", label: "Best Selling", group: "Products", description: "Top sellers.", defaults: { layout: "grid", limit: 8, source: "best_sellers" as DataSource } },
  { key: "trending_products", label: "Trending", group: "Products", description: "Trending products.", defaults: { layout: "grid", limit: 8, source: "trending" as DataSource } },
  { key: "flash_sale", label: "Flash Sale", group: "Products", description: "Deal-of-the-day with countdown.", defaults: { limit: 6, source: "featured" as DataSource, ends_at: null } },
  { key: "collections", label: "Collections", group: "Products", description: "Named collections grid.", defaults: { items: [] } },
  { key: "brands", label: "Brands", group: "Products", description: "Logo strip.", defaults: { items: [] } },
  { key: "testimonials", label: "Testimonials", group: "Content", description: "Customer quotes.", defaults: { items: [{ avatar: "", name: "Jane Doe", designation: "Customer", stars: 5, comment: "Great service!" }] } },
  { key: "customer_counter", label: "Customer Counter", group: "Marketing", description: "Live/animated visitor counter.", defaults: { label: "Happy customers", value: 200000 } },
  { key: "statistics", label: "Statistics", group: "Marketing", description: "KPI cards.", defaults: { items: [{ label: "Orders", value: "50k+", icon: "ShoppingBag" }] } },
  { key: "faq", label: "FAQ", group: "Content", description: "Accordion Q&A.", defaults: { items: [{ q: "How fast is delivery?", a: "Instant." }] } },
  { key: "blog_posts", label: "Blog Posts", group: "Content", description: "Latest blog articles.", defaults: { limit: 3, source: "latest" as DataSource } },
  { key: "newsletter", label: "Newsletter", group: "Marketing", description: "Signup form.", defaults: { title: "Get 10% off", description: "Subscribe for deals.", button: "Subscribe", background: "" } },
  { key: "video", label: "Video", group: "Media", description: "Embedded video.", defaults: { url: "", poster: "" } },
  { key: "text_image", label: "Text + Image", group: "Content", description: "Two-column text and image.", defaults: { image: "", image_position: "right", body: "" } },
  { key: "gallery", label: "Image Gallery", group: "Media", description: "Image grid.", defaults: { images: [] } },
  { key: "cta", label: "Call To Action", group: "Marketing", description: "Big banner with button.", defaults: { title: "Ready?", subtitle: "", button: { label: "Get started", href: "/products" }, image: "", background: "" } },
  { key: "custom_html", label: "Custom HTML", group: "Content", description: "Trusted raw HTML.", defaults: { html: "<div class='text-center py-10'>Custom HTML block</div>" } },
  { key: "spacer", label: "Spacer", group: "Layout", description: "Vertical spacing.", defaults: { height: 48 } },
  { key: "divider", label: "Divider", group: "Layout", description: "Horizontal rule.", defaults: { thickness: 1, color: "" } },
];

export function findSectionDef(key: string): SectionDef | undefined {
  return SECTION_TYPES.find((s) => s.key === key);
}
