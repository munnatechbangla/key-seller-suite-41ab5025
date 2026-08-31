/**
 * Centralized support channel configuration.
 *
 * Add, remove, reorder, enable/disable, or re-label channels here without
 * touching the SupportCenter UI component.
 */

export type SupportChannelId = "whatsapp" | "telegram" | "messenger" | "email" | "discord" | "livechat";

export interface SupportChannel {
  id: SupportChannelId;
  label: string;
  url: string;
  /** Opens in a new tab. Set false for in-app live-chat routes later. */
  external: boolean;
  /** Whether the channel appears in the floating menu. */
  enabled: boolean;
  /** Tailwind/text color hint used by the icon wrapper. */
  color: string;
}

/**
 * Default TopupHut support channels.
 * Keep IDs stable so analytics/shortcuts can reference them.
 */
export const defaultSupportChannels: SupportChannel[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    url: "https://wa.me/8801511632313",
    external: true,
    enabled: true,
    color: "#25D366",
  },
  {
    id: "telegram",
    label: "Telegram",
    url: "https://t.me/topuphut",
    external: true,
    enabled: true,
    color: "#0088CC",
  },
  {
    id: "messenger",
    label: "Messenger",
    url: "https://m.me/TopupHut.Official",
    external: true,
    enabled: true,
    color: "#0084FF",
  },
];

/** Channels visible in the floating menu, in array order. */
export function getVisibleChannels(channels: SupportChannel[] = defaultSupportChannels): SupportChannel[] {
  return channels.filter((c) => c.enabled);
}
