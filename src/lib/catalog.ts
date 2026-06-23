export type Category = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  count: number;
};

export type Product = {
  slug: string;
  name: string;
  category: string;
  emoji: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  badge?: "Hot" | "New" | "-50%" | "Trending" | "Best Seller";
  delivery: string;
  short: string;
};

export const categories: Category[] = [
  { slug: "ai-tools", name: "AI Tools", emoji: "🤖", description: "ChatGPT Plus, Claude, Midjourney & more", count: 24 },
  { slug: "streaming", name: "Streaming", emoji: "🎬", description: "Netflix, Prime, Disney+, HBO", count: 32 },
  { slug: "music", name: "Music", emoji: "🎧", description: "Spotify, YouTube Music, Tidal", count: 18 },
  { slug: "design", name: "Design & Creative", emoji: "🎨", description: "Canva Pro, CapCut Pro, Adobe", count: 21 },
  { slug: "iptv", name: "IPTV", emoji: "📺", description: "4K Live TV & VOD packages", count: 12 },
  { slug: "software", name: "Software Licenses", emoji: "💻", description: "Windows, Office, IDE keys", count: 27 },
  { slug: "antivirus", name: "Antivirus", emoji: "🛡️", description: "Norton, Kaspersky, Bitdefender", count: 14 },
  { slug: "gift-cards", name: "Gift Cards", emoji: "🎁", description: "Amazon, Steam, PlayStation, iTunes", count: 36 },
  { slug: "hosting", name: "Hosting & Domains", emoji: "🌐", description: "Web hosting, VPS, premium domains", count: 19 },
  { slug: "courses", name: "Courses & eBooks", emoji: "📚", description: "Premium learning content", count: 45 },
];

export const products: Product[] = [
  { slug: "chatgpt-plus", name: "ChatGPT Plus — 1 Month", category: "ai-tools", emoji: "🤖", price: 7.99, oldPrice: 20, rating: 4.9, reviews: 1284, badge: "Best Seller", delivery: "Instant", short: "Access GPT-4o, advanced data analysis & priority speeds." },
  { slug: "canva-pro", name: "Canva Pro — 1 Year", category: "design", emoji: "🎨", price: 9.99, oldPrice: 54, rating: 4.8, reviews: 892, badge: "Hot", delivery: "5 min", short: "Unlimited premium templates, Magic Studio & brand kits." },
  { slug: "capcut-pro", name: "CapCut Pro — 1 Year", category: "design", emoji: "🎞️", price: 12.99, oldPrice: 74.99, rating: 4.7, reviews: 612, badge: "-50%", delivery: "Instant", short: "AI editing, cloud storage and premium effects unlocked." },
  { slug: "netflix-premium", name: "Netflix Premium 4K", category: "streaming", emoji: "🎬", price: 6.99, oldPrice: 22.99, rating: 4.9, reviews: 2103, badge: "Trending", delivery: "Instant", short: "4K UHD, 4 screens, HDR & spatial audio." },
  { slug: "spotify-premium", name: "Spotify Premium", category: "music", emoji: "🎧", price: 4.99, oldPrice: 11.99, rating: 4.9, reviews: 1576, delivery: "Instant", short: "Ad-free, offline downloads and lossless audio." },
  { slug: "youtube-premium", name: "YouTube Premium Family", category: "streaming", emoji: "📺", price: 5.49, oldPrice: 22.99, rating: 4.8, reviews: 1432, badge: "New", delivery: "10 min", short: "Ad-free YouTube + Music for the whole family." },
  { slug: "iptv-12m", name: "IPTV 4K — 12 Months", category: "iptv", emoji: "📡", price: 39.99, oldPrice: 99, rating: 4.7, reviews: 421, badge: "Hot", delivery: "30 min", short: "20K+ live channels, sports, VOD library, anti-freeze." },
  { slug: "office-365", name: "Microsoft 365 Family", category: "software", emoji: "💼", price: 19.99, oldPrice: 99.99, rating: 4.8, reviews: 754, delivery: "Instant", short: "Word, Excel, PowerPoint + 1TB OneDrive — 6 users." },
];

export const featured = products.slice(0, 4);
export const trending = products.slice(2, 6);
export const bestSellers = [products[0], products[3], products[7], products[1]];
