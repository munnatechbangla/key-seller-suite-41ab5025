import { createFileRoute } from "@tanstack/react-router";
import { CmsPageView } from "@/components/site/CmsPageView";

export const Route = createFileRoute("/$slug")({
  component: SlugPage,
});

function SlugPage() {
  const { slug } = Route.useParams();
  return <CmsPageView slug={slug} />;
}
