import { createFileRoute } from "@tanstack/react-router";
import { CmsPageView } from "@/components/site/CmsPageView";

export const Route = createFileRoute("/track-order")({
  component: () => <CmsPageView slug="track-order" />,
});
