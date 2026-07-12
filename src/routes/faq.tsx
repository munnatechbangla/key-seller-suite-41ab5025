import { createFileRoute } from "@tanstack/react-router";
import { CmsPageView } from "@/components/site/CmsPageView";

export const Route = createFileRoute("/faq")({
  component: () => <CmsPageView slug="faq" />,
});
