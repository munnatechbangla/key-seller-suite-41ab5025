// Event catalog for the Notification Engine.
// Adding a new notification event = add here + create templates in admin.
export const NOTIFICATION_EVENTS = [
  { key: "order.created", label: "Order Created" },
  { key: "payment.received", label: "Payment Received" },
  { key: "payment.failed", label: "Payment Failed" },
  { key: "order.completed", label: "Order Completed" },
  { key: "order.manual_review", label: "Manual Review" },
  { key: "inventory.assigned", label: "Inventory Assigned" },
  { key: "license.assigned", label: "License Assigned" },
  { key: "subscription.assigned", label: "Subscription Assigned" },
  { key: "subscription.expiring", label: "Subscription Expiring" },
  { key: "subscription.renewed", label: "Subscription Renewed" },
  { key: "subscription.cancelled", label: "Subscription Cancelled" },
  { key: "subscription.expired", label: "Subscription Expired" },
  { key: "support.ticket_created", label: "Support Ticket Created" },
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]["key"];

export const NOTIFICATION_CHANNELS = ["email", "whatsapp", "sms", "push", "webhook"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const TEMPLATE_VARIABLES = [
  "customer_name",
  "order_number",
  "product_name",
  "download_link",
  "license_key",
  "subscription_email",
  "subscription_password",
  "expiry_date",
  "remaining_days",
  "support_link",
] as const;

export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = key.split(".").reduce<any>((a, k) => (a == null ? a : a[k]), vars);
    return v == null ? "" : String(v);
  });
}
