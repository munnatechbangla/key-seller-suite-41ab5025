import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — TopupHut" }] }),
  component: () => <LegalPage
    title="Terms & Conditions"
    subtitle="Please read these before placing an order"
    sections={[
      { h: "Acceptance", p: "By using TopupHut, you agree to these terms. If you do not agree, please do not use our services." },
      { h: "Accounts", p: "You're responsible for keeping your login credentials secure and for activity under your account." },
      { h: "Products", p: "All products are digital and resold under fair-use and supplier agreements. Subscription terms vary per listing." },
      { h: "Warranty", p: "Each product includes a stated warranty period. Outside that period, replacements are offered at our discretion." },
      { h: "Misuse", p: "Reselling, sharing accounts externally, or any form of abuse will void warranty and may result in account suspension." },
      { h: "Liability", p: "TopupHut is not liable for indirect or consequential losses. Total liability is limited to the order amount." },
    ]}
  />,
});
