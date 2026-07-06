// Provider abstraction for the Notification Engine.
// Architecture only — no real delivery yet. Future providers plug in here.
import type { NotificationChannel } from "./events";

export type OutboundNotification = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  payload?: Record<string, unknown>;
};

export type ProviderResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

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

// Registry — swap in real providers later without touching callers.
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
