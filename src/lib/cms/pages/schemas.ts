// Per-page CMS content schemas. Stored inside legal_pages.content JSONB.
// Defaults mirror the current hardcoded values so unedited pages stay pixel-identical.

export type Hero = { title: string; subtitle: string; image?: string };

export type AboutContent = {
  hero: Hero;
  stats?: Array<{ icon: string; value: string; label: string }>;
  story?: { badge: string; heading: string; paragraphs: string[] };
  team?: Array<{ name: string; role: string; avatar?: string; bio?: string }>;
  mission?: string;
  vision?: string;
  cta?: { title: string; subtitle: string; button_label: string; button_url: string };
};

export type ContactContent = {
  hero: Hero;
  form: { title: string; subtitle: string; submit_label: string; success_message: string };
  email?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  address?: string;
  map_embed?: string;
  hours?: Array<{ day: string; hours: string }>;
};

export type FaqCategory = { id: string; name: string };
export type FaqEntry = { category_id?: string; q: string; a: string };
// Backwards-compatible legacy shape
export type FaqGroup = { name: string; items: Array<{ q: string; a: string }> };
export type FaqContent = {
  hero: Hero;
  search_placeholder: string;
  categories?: FaqCategory[];
  items?: FaqEntry[];
  faq_groups?: FaqGroup[]; // legacy compatibility (existing rows)
  cta?: { title: string; subtitle: string; button_label: string; button_url: string };
};

export type SupportContent = {
  hero: Hero;
  cards: Array<{ icon: string; title: string; body: string; link?: string }>;
  contact_methods: Array<{ icon: string; label: string; value: string; href: string; color?: string }>;
  ticket_form: { heading: string; submit_label: string; success_message: string };
  cta?: { title: string; subtitle: string; button_label: string; button_url: string };
};

export type TrackOrderContent = {
  hero: Hero;
  tracker: { heading: string; placeholder_order: string; placeholder_email: string; button_label: string; help_text: string };
  faq?: Array<{ q: string; a: string }>;
};

export type LegalSection = { h: string; p: string };
export type LegalRichContent = {
  hero?: { title?: string; subtitle?: string };
  sections?: LegalSection[];
  body_md?: string;
};

export type AnyPageContent =
  | AboutContent
  | ContactContent
  | FaqContent
  | SupportContent
  | TrackOrderContent
  | LegalRichContent;

// ==================== Defaults ====================

export const defaults = {
  about: {
    hero: {
      title: "Digital, done right.",
      subtitle:
        "We started {name} to make premium digital products affordable, accessible and instantly available — for everyone, everywhere.",
    },
    stats: [
      { icon: "Users", value: "200K+", label: "Customers worldwide" },
      { icon: "Zap", value: "250+", label: "Digital products" },
      { icon: "Award", value: "4.9★", label: "Average rating" },
      { icon: "Globe", value: "120+", label: "Countries served" },
    ],
    story: {
      badge: "Our story",
      heading: "Built by digital natives, for digital natives.",
      paragraphs: [
        "{name} was founded in 2021 with a simple belief — premium software and subscriptions should not cost more than the value they provide. By partnering directly with global vendors and automating delivery, we cut out the middlemen and pass the savings to you.",
        "Today, we serve over 200,000 customers across 120 countries — students, freelancers, agencies and small businesses who deserve world-class tools without the world-class price tag.",
      ],
    },
    team: [],
    mission: "",
    vision: "",
    cta: { title: "", subtitle: "", button_label: "", button_url: "" },
  } as AboutContent,

  contact: {
    hero: {
      title: "Get in touch",
      subtitle: "Questions, orders, partnerships — we'd love to hear from you.",
    },
    form: {
      title: "Send a message",
      subtitle: "",
      submit_label: "Send message",
      success_message: "Thanks — we'll reply within an hour.",
    },
    hours: [],
  } as ContactContent,

  faq: {
    hero: {
      title: "Frequently asked questions",
      subtitle: "Quick answers to the things customers ask most",
    },
    search_placeholder: "Search FAQs…",
    faq_groups: [
      {
        name: "Orders & Delivery",
        items: [
          { q: "How fast is delivery?", a: "Most products are delivered instantly. Some (like IPTV) may take up to 30 minutes." },
          { q: "Where will I receive my product?", a: "Activation details and download links are sent to the email used during checkout." },
          { q: "I didn't receive my order — what now?", a: "Check spam first, then contact our 24/7 live chat. Most issues are resolved in minutes." },
        ],
      },
      {
        name: "Payments",
        items: [
          { q: "Which payment methods do you accept?", a: "Stripe, PayPal, SSLCommerz, bKash, Nagad, Rocket, crypto and bank transfer." },
          { q: "Is checkout secure?", a: "Yes, all transactions use 256-bit SSL encryption and PCI-compliant processors." },
        ],
      },
      {
        name: "Warranty & Refunds",
        items: [
          { q: "Do products come with warranty?", a: "Yes — every order includes a full subscription warranty. We'll replace any account that stops working." },
          { q: "What's your refund policy?", a: "Full refund within 24 hours if the product can't be delivered or activated. See Refund Policy for details." },
        ],
      },
    ],
  } as FaqContent,

  support: {
    hero: {
      title: "Support center",
      subtitle: "We're here 24/7. Pick the fastest way to reach us.",
    },
    cards: [
      { icon: "HelpCircle", title: "FAQ", body: "Quick answers", link: "/faq" },
      { icon: "FileText", title: "Track order", body: "Check your delivery", link: "/track-order" },
      { icon: "RefreshCcw", title: "Refunds", body: "Refund policy & requests", link: "/refund" },
    ],
    contact_methods: [
      { icon: "MessageCircle", label: "Live chat", value: "Average reply in 2 min", href: "#", color: "bg-emerald-500" },
    ],
    ticket_form: {
      heading: "Open a support ticket",
      submit_label: "Submit ticket",
      success_message: "Ticket submitted — we'll reply within an hour.",
    },
  } as SupportContent,

  "track-order": {
    hero: {
      title: "Track your order",
      subtitle: "Enter your order ID and email to see status",
    },
    tracker: {
      heading: "",
      placeholder_order: "Order ID (e.g. TH-20260624-ABC123)",
      placeholder_email: "Email used at checkout",
      button_label: "Track order",
      help_text: "",
    },
    faq: [],
  } as TrackOrderContent,

  privacy: {
    sections: [
      { h: "Information we collect", p: "We collect the information you provide at signup or checkout (name, email, phone, billing address) plus standard usage data like IP, device and browser type." },
      { h: "How we use it", p: "To deliver your orders, prevent fraud, send transactional emails, and (only with your consent) marketing updates." },
      { h: "Sharing", p: "We never sell your data. We only share what's necessary with payment processors and email providers strictly to fulfil orders." },
      { h: "Cookies", p: "We use cookies to keep your cart, remember preferences and analyze traffic. You can disable them in your browser." },
      { h: "Your rights", p: "You can request export or deletion of your data at any time by emailing {email}." },
    ],
  } as LegalRichContent,

  terms: {
    sections: [
      { h: "Acceptance", p: "By using {name}, you agree to these terms. If you do not agree, please do not use our services." },
      { h: "Accounts", p: "You're responsible for keeping your login credentials secure and for activity under your account." },
      { h: "Products", p: "All products are digital and resold under fair-use and supplier agreements. Subscription terms vary per listing." },
      { h: "Warranty", p: "Each product includes a stated warranty period. Outside that period, replacements are offered at our discretion." },
      { h: "Misuse", p: "Reselling, sharing accounts externally, or any form of abuse will void warranty and may result in account suspension." },
      { h: "Liability", p: "{name} is not liable for indirect or consequential losses. Total liability is limited to the order amount." },
    ],
  } as LegalRichContent,

  refund: {
    sections: [
      { h: "Eligibility", p: "Refunds are issued in full if the product cannot be delivered or activated within 24 hours of purchase." },
      { h: "Non-refundable cases", p: "Once a product is delivered and activated successfully, it is not eligible for refund — but warranty/replacement still applies." },
      { h: "How to request", p: "Open a support ticket from your account dashboard or email {email} with your order ID." },
      { h: "Processing time", p: "Refunds are processed back to the original payment method within 3–7 business days." },
    ],
  } as LegalRichContent,
} as const;

export type PageSlug = keyof typeof defaults;

export const PAGE_META: Record<PageSlug, { title: string; description: string; frontendPath: string }> = {
  about: { title: "About", description: "Company story, team & values", frontendPath: "/about" },
  contact: { title: "Contact", description: "Contact form & channels", frontendPath: "/contact" },
  faq: { title: "FAQ", description: "Frequently asked questions", frontendPath: "/faq" },
  support: { title: "Support Center", description: "Support channels & ticket form", frontendPath: "/support" },
  "track-order": { title: "Track Order", description: "Order tracker page", frontendPath: "/track-order" },
  privacy: { title: "Privacy Policy", description: "Legal — privacy policy", frontendPath: "/privacy" },
  terms: { title: "Terms & Conditions", description: "Legal — terms of service", frontendPath: "/terms" },
  refund: { title: "Refund Policy", description: "Legal — refund policy", frontendPath: "/refund" },
};

export const PAGE_SLUGS = Object.keys(PAGE_META) as PageSlug[];

// Simple {token} interpolation for defaults (e.g. {name}, {email})
export function interpolate(text: string, vars: Record<string, string | undefined>): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
