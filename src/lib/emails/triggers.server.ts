// @ts-nocheck
// Server-only helpers that fan out transactional emails for lifecycle events.
import { enqueueEmail } from "./service.server";

export async function sendOrderConfirmation(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, email, customer_name, total, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.email) return;
  await enqueueEmail({
    templateKey: "order_confirmation",
    recipient: order.email,
    vars: {
      name: order.customer_name ?? "Customer",
      order_number: order.order_number,
      total: order.total,
      currency: order.currency === "USD" ? "$" : order.currency,
    },
  });
}

export async function sendPostPaymentEmails(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, email, customer_name, total, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.email) return;
  const currencySym = order.currency === "USD" ? "$" : order.currency;

  await enqueueEmail({
    templateKey: "payment_success",
    recipient: order.email,
    vars: { order_number: order.order_number, total: order.total, currency: currencySym },
  });

  const { data: assignments } = await supabaseAdmin
    .from("license_assignments")
    .select("license_keys(key_value), order_items(product_name)")
    .eq("order_id", orderId);
  if (assignments && assignments.length) {
    const block = assignments
      .map((a: any) => `${a.order_items?.product_name ?? "Product"}: ${a.license_keys?.key_value ?? ""}`)
      .join("\n");
    await enqueueEmail({
      templateKey: "license_delivery",
      recipient: order.email,
      vars: { order_number: order.order_number, license_block: block },
    });
  }

  const { data: downloads } = await supabaseAdmin
    .from("downloads")
    .select("file_url, order_items(product_name)")
    .eq("order_id", orderId);
  if (downloads && downloads.length) {
    const block = downloads
      .map((d: any) => `<p>${d.order_items?.product_name ?? "File"}: <a href="${d.file_url ?? "#"}">Download</a></p>`)
      .join("");
    await enqueueEmail({
      templateKey: "download_delivery",
      recipient: order.email,
      vars: { order_number: order.order_number, download_block: block },
    });
  }
}

export async function sendRefundEmail(orderId: string, amount: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, email, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.email) return;
  await enqueueEmail({
    templateKey: "refund",
    recipient: order.email,
    vars: {
      order_number: order.order_number,
      amount,
      currency: order.currency === "USD" ? "$" : order.currency,
    },
  });
}

export async function sendWelcomeEmail(email: string, name?: string) {
  await enqueueEmail({
    templateKey: "welcome",
    recipient: email,
    vars: { name: name ?? "there" },
  });
}
