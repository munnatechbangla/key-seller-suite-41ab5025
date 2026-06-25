import { siteName } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { useLegalPage } from "@/lib/cms/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: `Privacy Policy — ${siteName()}` }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const s = useSettings((st) => st.settings);
  const email = s.contact.support_email || "support@example.com";
  const { data: page } = useLegalPage("privacy");

  const fallbackSections = [
    { h: "Information we collect", p: "We collect the information you provide at signup or checkout (name, email, phone, billing address) plus standard usage data like IP, device and browser type." },
    { h: "How we use it", p: "To deliver your orders, prevent fraud, send transactional emails, and (only with your consent) marketing updates." },
    { h: "Sharing", p: "We never sell your data. We only share what's necessary with payment processors and email providers strictly to fulfil orders." },
    { h: "Cookies", p: "We use cookies to keep your cart, remember preferences and analyze traffic. You can disable them in your browser." },
    { h: "Your rights", p: `You can request export or deletion of your data at any time by emailing ${email}.` },
  ];

  return (
    <LegalPage
      title={page?.title ?? "Privacy Policy"}
      subtitle={page?.subtitle ?? "Last updated June 2026"}
      sections={page?.content?.sections ?? fallbackSections}
      bodyMd={page?.content?.body_md ?? null}
    />
  );
}
