import type { IconName } from "./icons";

export type HeroBadge = { icon: IconName; text: string };
export type HeroTrustItem = { icon: IconName; label: string };
export type HeroCta = { label: string; to?: string; href?: string; variant: "primary" | "ghost"; icon?: IconName };
export type HeroConfig = {
  badge: HeroBadge;
  title: { lead: string; accent: string };
  description: string;
  ctas: HeroCta[];
  trustItems: HeroTrustItem[];
  floatingProductSlugs: string[];
};

export type TrustStripItem = { icon: IconName; title: string; desc: string };
export type WhyChooseItem = { icon: IconName; title: string; desc: string };
export type StatItem = { value: string; label: string };
export type Testimonial = { name: string; role: string; text: string; emoji: string; rating: number };
export type Faq = { q: string; a: string };
export type CountdownConfig = { hours: number; minutes: number; seconds: number };
export type NewsletterCta = {
  badge: { icon: IconName; text: string };
  title: string;
  subtitle: string;
  placeholder: string;
  button: { icon: IconName; label: string };
};

export type ProductSection = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  source: "featured" | "trending" | "bestSellers";
  limit?: number;
};

export const heroConfig: HeroConfig = {
  badge: { icon: "Sparkles", text: "Trusted by 200,000+ customers worldwide" },
  title: { lead: "Premium digital products,", accent: "delivered in seconds." },
  description:
    "ChatGPT Plus, Netflix, Canva Pro, Spotify, IPTV, software keys & gift cards — up to 70% off retail. Instant activation, lifetime warranty, 24/7 support.",
  ctas: [
    { label: "Browse Products", to: "/products", variant: "primary", icon: "ArrowRight" },
    { label: "Watch Demo", href: "#", variant: "ghost", icon: "Play" },
  ],
  trustItems: [
    { icon: "Zap", label: "Instant delivery" },
    { icon: "Shield", label: "Secure checkout" },
    { icon: "RefreshCw", label: "Money-back guarantee" },
  ],
  floatingProductSlugs: ["chatgpt-plus", "netflix-premium", "canva-pro", "iptv-12m", "spotify-premium", "youtube-premium"],
};

export const trustStripItems: TrustStripItem[] = [
  { icon: "Zap", title: "Instant Delivery", desc: "Email + dashboard, 24/7" },
  { icon: "Shield", title: "100% Secure", desc: "Encrypted payments" },
  { icon: "RefreshCw", title: "Money-Back", desc: "30-day guarantee" },
  { icon: "Headphones", title: "Live Support", desc: "WhatsApp, chat, email" },
];

export const whyChooseItems: WhyChooseItem[] = [
  { icon: "Zap", title: "Lightning Fast", desc: "Auto-delivery within seconds of payment. No waiting, no hassle." },
  { icon: "Shield", title: "Authentic & Warranted", desc: "Every license verified. Lifetime replacement guarantee." },
  { icon: "Gift", title: "Best Prices", desc: "Save up to 70% vs official retail. Bulk discounts available." },
  { icon: "Headphones", title: "24/7 Support", desc: "WhatsApp, live chat, email — real humans, not bots." },
  { icon: "Award", title: "Trusted Vendor", desc: "200K+ orders delivered with 4.9★ rating." },
  { icon: "Clock", title: "Easy Refunds", desc: "Not happy? Get your money back within 30 days." },
];

export const statsItems: StatItem[] = [
  { value: "200K+", label: "Happy customers" },
  { value: "250+", label: "Digital products" },
  { value: "4.9★", label: "Average rating" },
  { value: "24/7", label: "Support uptime" },
];

export const testimonials: Testimonial[] = [
  { name: "Sarah M.", role: "Designer", emoji: "👩‍🎨", rating: 5, text: "Got Canva Pro for a fraction of the price and it activated in under a minute. Insane service." },
  { name: "James K.", role: "Developer", emoji: "👨‍💻", rating: 5, text: "Bought ChatGPT Plus here three times. Always instant, always works. Support is unmatched." },
  { name: "Priya R.", role: "Student", emoji: "👩‍🎓", rating: 5, text: "Spotify + Netflix for less than my morning coffee. DigitalNest is now my go-to." },
];

export const homeFaqs: Faq[] = [
  { q: "How fast is delivery?", a: "Most products are delivered automatically within seconds of payment confirmation, directly to your dashboard and email." },
  { q: "Is it safe and legal?", a: "Yes. All our products are authentic, sourced through authorized channels, and come with a lifetime replacement warranty." },
  { q: "What payment methods do you accept?", a: "Stripe, PayPal, bKash, Nagad, Rocket, SSLCommerz, crypto and direct bank transfer." },
  { q: "Do you offer refunds?", a: "Absolutely — 30-day money-back guarantee if the product doesn't work as advertised." },
  { q: "Can I use my purchase on multiple devices?", a: "Each product page lists exact device limits. Most subscriptions support 1–5 simultaneous devices." },
];

export const flashDealCountdown: CountdownConfig = { hours: 11, minutes: 42, seconds: 18 };

export const productSections: ProductSection[] = [
  { id: "flash", eyebrow: "⚡ Flash deals", title: "Limited time offers", subtitle: "Hurry — these prices vanish in 24 hours.", source: "trending" },
  { id: "featured", eyebrow: "Hand picked", title: "Featured products", subtitle: "Customer favorites this week.", source: "featured" },
  { id: "best", eyebrow: "🔥 Best sellers", title: "What everyone's buying", source: "bestSellers" },
];

export const categoriesSection = {
  eyebrow: "Shop by category",
  title: "Everything digital, one marketplace",
  subtitle: "From AI tools to streaming, software to gift cards — discover 250+ premium products.",
  viewAllLabel: "View all",
};

export const whyChooseSection = {
  eyebrow: "Why DigitalNest",
  title: "The smarter way to buy digital",
};

export const testimonialsSection = {
  eyebrow: "Loved by customers",
  title: "What our buyers say",
};

export const faqSection = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
};

export const newsletterCta: NewsletterCta = {
  badge: { icon: "Users", text: "Join 200,000+ smart buyers" },
  title: "Save 70% on your favorite digital products.",
  subtitle: "Get exclusive coupons, flash sales and early access — straight to your inbox.",
  placeholder: "Enter your email",
  button: { icon: "Check", label: "Subscribe" },
};
