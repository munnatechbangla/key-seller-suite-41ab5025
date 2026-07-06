// Registry of supported product content block types.

export type ProductBlockTypeKey =
  | "rich_text" | "heading" | "image" | "gallery" | "video" | "youtube" | "vimeo"
  | "code" | "markdown" | "accordion" | "faq" | "icon_list" | "feature_list"
  | "comparison_table" | "pricing_table" | "notice" | "alert" | "button"
  | "divider" | "spacer" | "quote" | "timeline" | "steps" | "statistics"
  | "custom_html" | "download_card" | "license_info" | "subscription_info"
  | "activation_info";

export type ProductBlockDef = {
  key: ProductBlockTypeKey;
  label: string;
  group: "Text" | "Media" | "Content" | "Data" | "Layout" | "Product";
  description: string;
  defaults: Record<string, unknown>;
};

export const PRODUCT_BLOCK_TYPES: ProductBlockDef[] = [
  { key: "rich_text", label: "Rich Text", group: "Text", description: "Formatted paragraph HTML.", defaults: { html: "<p>Your rich text…</p>" } },
  { key: "heading", label: "Heading", group: "Text", description: "Section heading.", defaults: { level: 2, text: "Section heading", align: "left" } },
  { key: "quote", label: "Quote", group: "Text", description: "Highlighted quote.", defaults: { text: "Great product!", cite: "" } },
  { key: "markdown", label: "Markdown", group: "Text", description: "GitHub-flavored markdown.", defaults: { md: "## Hello\n\n- item 1\n- item 2" } },
  { key: "code", label: "Code Block", group: "Text", description: "Syntax-highlighted code.", defaults: { language: "ts", code: "console.log('hi')" } },

  { key: "image", label: "Image", group: "Media", description: "Single image w/ caption.", defaults: { url: "", alt: "", caption: "", align: "center" } },
  { key: "gallery", label: "Image Gallery", group: "Media", description: "Multi-image grid.", defaults: { images: [] } },
  { key: "video", label: "Video (upload)", group: "Media", description: "Direct video URL.", defaults: { url: "", autoplay: false, loop: false, muted: true } },
  { key: "youtube", label: "YouTube Embed", group: "Media", description: "YouTube video.", defaults: { video_id: "", autoplay: false } },
  { key: "vimeo", label: "Vimeo Embed", group: "Media", description: "Vimeo video.", defaults: { video_id: "", autoplay: false } },

  { key: "accordion", label: "Accordion", group: "Content", description: "Collapsible items.", defaults: { items: [{ title: "Item", body: "Body" }] } },
  { key: "faq", label: "FAQ", group: "Content", description: "Schema-ready FAQ.", defaults: { items: [{ q: "Question?", a: "Answer." }] } },
  { key: "icon_list", label: "Icon List", group: "Content", description: "Icons + text list.", defaults: { items: [{ icon: "Check", text: "Feature" }] } },
  { key: "feature_list", label: "Feature List", group: "Content", description: "Icon + title + description.", defaults: { items: [{ icon: "Star", title: "Feature", description: "Details" }] } },
  { key: "comparison_table", label: "Comparison Table", group: "Data", description: "Unlimited rows/columns.", defaults: { headers: ["Feature", "Us", "Them"], rows: [["Speed", "Fast", "Slow"]] } },
  { key: "pricing_table", label: "Pricing Table", group: "Data", description: "Plans/pricing.", defaults: { plans: [{ name: "Basic", price: "$9", features: ["1 seat"], cta: { label: "Buy", href: "" } }] } },
  { key: "statistics", label: "Statistics", group: "Data", description: "KPI cards.", defaults: { items: [{ label: "Users", value: "10k+" }] } },
  { key: "timeline", label: "Timeline", group: "Content", description: "Chronological steps.", defaults: { items: [{ title: "Milestone", date: "2026", body: "" }] } },
  { key: "steps", label: "Steps", group: "Content", description: "Numbered steps.", defaults: { items: [{ title: "Step 1", body: "Do this" }] } },

  { key: "notice", label: "Notice Box", group: "Content", description: "Informational box.", defaults: { title: "Notice", body: "Read this carefully.", tone: "info" } },
  { key: "alert", label: "Alert", group: "Content", description: "Colored alert.", defaults: { text: "Important message", tone: "warning" } },
  { key: "button", label: "Button", group: "Content", description: "CTA button.", defaults: { label: "Learn more", href: "#", variant: "default", align: "left" } },

  { key: "divider", label: "Divider", group: "Layout", description: "Horizontal rule.", defaults: { thickness: 1 } },
  { key: "spacer", label: "Spacer", group: "Layout", description: "Vertical space.", defaults: { height: 32 } },
  { key: "custom_html", label: "Custom HTML", group: "Content", description: "Trusted raw HTML.", defaults: { html: "<div>Custom</div>" } },

  { key: "download_card", label: "Download Card", group: "Product", description: "Dynamic download info.", defaults: { version: "", file_size: "", compatibility: "", release_date: "" } },
  { key: "license_info", label: "License Information", group: "Product", description: "License type, activation, warranty.", defaults: { license_type: "", activation: "", warranty: "", replacement: "" } },
  { key: "subscription_info", label: "Subscription Information", group: "Product", description: "Profiles, duration, renewal, warranty.", defaults: { profiles: "", duration: "", renewal: "", warranty: "" } },
  { key: "activation_info", label: "Activation Information", group: "Product", description: "Processing time, login needs, warranty, support.", defaults: { processing_time: "", need_login: false, warranty: "", support: "" } },
];

export function findProductBlockDef(key: string): ProductBlockDef | undefined {
  return PRODUCT_BLOCK_TYPES.find((b) => b.key === key);
}
