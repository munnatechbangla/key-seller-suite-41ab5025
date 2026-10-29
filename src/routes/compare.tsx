import { createFileRoute, redirect } from "@tanstack/react-router";

// Compare has been retired from the storefront. Keep this route as a safe
// redirect so existing bookmarks and search-engine links continue to work.
export const Route = createFileRoute("/compare")({
  beforeLoad: () => {
    throw redirect({ to: "/products" });
  },
});
