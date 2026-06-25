import type { IconName } from "./icons";

export type NavItem = { to: string; label: string; exact?: boolean };
export type FooterColumn = { title: string; links: { label: string; href: string }[] };
export type SocialLink = { icon: IconName; href: string; label: string };
export type PaymentBadge = { code: string; label: string };
export type AnnouncementBar = { enabled: boolean; icon: IconName; html: string };

export const siteConfig = {
  name: "DigitalNest",
  brandSplit: { lead: "Digital", accent: "Nest" },
  tagline: "Premium digital products at unbeatable prices.",
  description:
    "Premium digital products at unbeatable prices. Instant delivery, secure payments, and 24/7 support — trusted by 200,000+ customers worldwide.",
  email: "support@digitalnest.com",
  whatsapp: "",
  telegram: "",
  newsletter: {
    title: "Newsletter",
    subtitle: "Get exclusive deals & 10% off your first order.",
    placeholder: "you@email.com",
  },
};

export const primaryNav: NavItem[] = [
  { to: "/", label: "Home", exact: true },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
      { label: "Categories", href: "/categories" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Track Order", href: "/track-order" },
      { label: "Support Center", href: "/support" },
      { label: "Refund Policy", href: "/refund" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export const socialLinks: SocialLink[] = [
  { icon: "Facebook", href: "#", label: "Facebook" },
  { icon: "Twitter", href: "#", label: "Twitter" },
  { icon: "Instagram", href: "#", label: "Instagram" },
  { icon: "Youtube", href: "#", label: "YouTube" },
];

export const paymentBadges: PaymentBadge[] = [
  { code: "VISA", label: "Visa" },
  { code: "MC", label: "Mastercard" },
  { code: "AMEX", label: "American Express" },
  { code: "PP", label: "PayPal" },
  { code: "STRIPE", label: "Stripe" },
  { code: "BTC", label: "Bitcoin" },
];

export const announcementBar: AnnouncementBar = {
  enabled: true,
  icon: "Zap",
  html: "Flash Sale — Up to <b>70% OFF</b> on premium digital products. Instant delivery 24/7.",
};
