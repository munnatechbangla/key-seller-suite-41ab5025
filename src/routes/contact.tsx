import { createFileRoute } from "@tanstack/react-router";
import { CmsPageView } from "@/components/site/CmsPageView";

export const Route = createFileRoute("/contact")({
  component: () => <CmsPageView slug="contact" />,
});
