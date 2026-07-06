// Registry of supported product page section types.
// Add a new type here + handle it in ProductLayoutRenderer.tsx.

export type ProductSectionTypeKey =
  | "gallery"
  | "breadcrumb"
  | "title"
  | "price"
  | "purchase_card"
  | "stock_status"
  | "delivery_info"
  | "description"
  | "highlights"
  | "specifications"
  | "whats_included"
  | "requirements"
  | "compatibility"
  | "features"
  | "faq"
  | "reviews"
  | "related_products"
  | "recently_viewed"
  | "support_card"
  | "trust_badges"
  | "cta"
  | "custom_html"
  | "spacer"
  | "divider";

export type ProductSectionCommonStyle = {
  background_color?: string;
  background_image?: string;
  padding?: string;
  margin?: string;
  container_width?: "sm" | "md" | "lg" | "xl" | "full";
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  animation?: "none" | "fade" | "slide-up" | "zoom";
  custom_class?: string;
};

export type ProductSectionDef = {
  key: ProductSectionTypeKey;
  label: string;
  group: "Media" | "Info" | "Purchase" | "Content" | "Social" | "Layout";
  description: string;
  defaults: Record<string, unknown>;
};

export const PRODUCT_SECTION_TYPES: ProductSectionDef[] = [
  { key: "gallery", label: "Product Gallery", group: "Media", description: "Main image + thumbnails.", defaults: { zoom: true, thumbnails: "left" } },
  { key: "breadcrumb", label: "Breadcrumb", group: "Info", description: "Navigation trail.", defaults: {} },
  { key: "title", label: "Product Title", group: "Info", description: "Product name with badges.", defaults: { show_rating: true } },
  { key: "price", label: "Price", group: "Purchase", description: "Price with discount %.", defaults: { show_old_price: true } },
  { key: "purchase_card", label: "Purchase Card", group: "Purchase", description: "Quantity + Buy/Add to cart.", defaults: { show_wishlist: true, show_compare: true } },
  { key: "stock_status", label: "Stock Status", group: "Purchase", description: "Availability indicator.", defaults: {} },
  { key: "delivery_info", label: "Delivery Information", group: "Purchase", description: "Instant delivery / ETA.", defaults: { text: "Instant digital delivery to your email" } },
  { key: "description", label: "Product Description", group: "Content", description: "Long description.", defaults: {} },
  { key: "highlights", label: "Product Highlights", group: "Content", description: "Bullet highlights.", defaults: { items: [] } },
  { key: "specifications", label: "Specifications", group: "Content", description: "Key/value spec table.", defaults: { items: [] } },
  { key: "whats_included", label: "What's Included", group: "Content", description: "In-the-box items.", defaults: { items: [] } },
  { key: "requirements", label: "Requirements", group: "Content", description: "System / usage requirements.", defaults: { items: [] } },
  { key: "compatibility", label: "Compatibility", group: "Content", description: "Compatible platforms.", defaults: { items: [] } },
  { key: "features", label: "Features", group: "Content", description: "Feature grid.", defaults: { items: [] } },
  { key: "faq", label: "FAQ", group: "Content", description: "Product FAQs.", defaults: {} },
  { key: "reviews", label: "Reviews", group: "Social", description: "Customer reviews.", defaults: { limit: 10 } },
  { key: "related_products", label: "Related Products", group: "Social", description: "Related items grid.", defaults: { limit: 4 } },
  { key: "recently_viewed", label: "Recently Viewed", group: "Social", description: "Recently viewed items.", defaults: { limit: 4 } },
  { key: "support_card", label: "Support Card", group: "Info", description: "Contact / help block.", defaults: { title: "Need help?", text: "Our team is available 24/7." } },
  { key: "trust_badges", label: "Trust Badges", group: "Info", description: "Security / guarantee badges.", defaults: { items: ["Secure Checkout", "Money-back Guarantee", "24/7 Support"] } },
  { key: "cta", label: "Call To Action", group: "Content", description: "Banner with button.", defaults: { title: "Ready to buy?", button: { label: "Add to cart", href: "" } } },
  { key: "custom_html", label: "Custom HTML", group: "Content", description: "Trusted raw HTML.", defaults: { html: "<div class='text-center py-6'>Custom block</div>" } },
  { key: "spacer", label: "Spacer", group: "Layout", description: "Vertical space.", defaults: { height: 48 } },
  { key: "divider", label: "Divider", group: "Layout", description: "Horizontal rule.", defaults: { thickness: 1 } },
];

export function findProductSectionDef(key: string): ProductSectionDef | undefined {
  return PRODUCT_SECTION_TYPES.find((s) => s.key === key);
}
