import { siteName } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/refund")({
  head: () => ({ meta: [{ title: `Refund Policy — ${siteName()}` }] }),
  component: RefundPage,
});

function RefundPage() {
  const email = useSettings((st) => st.settings.contact.support_email) || "support@example.com";
  return (
    <LegalPage
      title="Refund Policy"
      subtitle="Our promise: you get what you pay for"
      sections={[
        { h: "Eligibility", p: "Refunds are issued in full if the product cannot be delivered or activated within 24 hours of purchase." },
        { h: "Non-refundable cases", p: "Once a product is delivered and activated successfully, it is not eligible for refund — but warranty/replacement still applies." },
        { h: "How to request", p: `Open a support ticket from your account dashboard or email ${email} with your order ID.` },
        { h: "Processing time", p: "Refunds are processed back to the original payment method within 3–7 business days." },
      ]}
    />
  );
}
