import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — TopupHut" }] }),
  component: () => <LegalPage
    title="Privacy Policy"
    subtitle="Last updated June 2026"
    sections={[
      { h: "Information we collect", p: "We collect the information you provide at signup or checkout (name, email, phone, billing address) plus standard usage data like IP, device and browser type." },
      { h: "How we use it", p: "To deliver your orders, prevent fraud, send transactional emails, and (only with your consent) marketing updates." },
      { h: "Sharing", p: "We never sell your data. We only share what's necessary with payment processors and email providers strictly to fulfil orders." },
      { h: "Cookies", p: "We use cookies to keep your cart, remember preferences and analyze traffic. You can disable them in your browser." },
      { h: "Your rights", p: "You can request export or deletion of your data at any time by emailing privacy@topuphut.com." },
    ]}
  />,
});
