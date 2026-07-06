// Provider abstraction for the Notification Engine.
// Real delivery uses adapters loaded on-demand server-side (client bundle-safe).
import type { NotificationChannel } from "./events";

export type OutboundNotification = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  payload?: Record<string, unknown>;
};

export type ProviderResult =
  | { ok: true; providerMessageId?: string; httpStatus?: number }
  | { ok: false; error: string; httpStatus?: number };

export interface NotificationProvider {
  channel: NotificationChannel;
  send(msg: OutboundNotification): Promise<ProviderResult>;
}

const noop = (channel: NotificationChannel): NotificationProvider => ({
  channel,
  async send() {
    return { ok: false, error: `provider_not_configured:${channel}` };
  },
});

const registry: Record<NotificationChannel, NotificationProvider> = {
  email: noop("email"),
  whatsapp: noop("whatsapp"),
  sms: noop("sms"),
  push: noop("push"),
  webhook: noop("webhook"),
};

export function registerProvider(p: NotificationProvider) {
  registry[p.channel] = p;
}

export function getProvider(ch: NotificationChannel): NotificationProvider {
  return registry[ch];
}
