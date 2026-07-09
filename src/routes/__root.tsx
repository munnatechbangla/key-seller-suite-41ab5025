import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { ThemeProviderEffect } from "@/components/site/ThemeToggle";
import { ThemeStyleInjector } from "@/components/site/ThemeStyleInjector";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/stores";
import { useSettings } from "@/lib/cms/settings";
import { useSiteFavicon } from "@/lib/cms/site-logo";
import { AnalyticsScripts } from "@/components/site/AnalyticsScripts";
import { SeoCenterInjector } from "@/components/site/SeoCenterInjector";
import { seoMeta, organizationJsonLd, websiteJsonLd, jsonLdScript } from "@/lib/cms/seo";
import { SetupGate } from "@/components/setup/SetupGate";
import { RecentlyPurchasedPopup } from "@/components/site/RecentlyPurchasedPopup";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#6C5CE7" },
      ...seoMeta({}),
      { title: "Lovable App" },
      { property: "og:title", content: "Lovable App" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "description", content: "A premium WordPress theme for selling digital products like subscriptions, software, and gift cards." },
      { property: "og:description", content: "A premium WordPress theme for selling digital products like subscriptions, software, and gift cards." },
      { name: "twitter:description", content: "A premium WordPress theme for selling digital products like subscriptions, software, and gift cards." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/431d109d-252e-4236-845a-1b82ee936955/id-preview-c9fd796f--06a3a9fd-1615-4829-8074-1236e3531897.lovable.app-1782565996883.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/431d109d-252e-4236-845a-1b82ee936955/id-preview-c9fd796f--06a3a9fd-1615-4829-8074-1236e3531897.lovable.app-1782565996883.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" },
    ],
    scripts: [
      jsonLdScript(organizationJsonLd()),
      jsonLdScript(websiteJsonLd()),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const initAuth = useAuth((s) => s.init);
  const loadSettings = useSettings((s) => s.load);
  const favicon = useSiteFavicon();
  useEffect(() => initAuth(), [initAuth]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { import("@/lib/cms/homepage").then((m) => m.useHomepage.getState().load()); }, []);
  useEffect(() => { import("@/lib/cms/marketplace").then((m) => m.useMarketplace.getState().load()); }, []);
  useEffect(() => { import("@/lib/sentry").then((m) => m.initSentry()); }, []);
  useEffect(() => {
    if (typeof document === "undefined" || !favicon) return;
    const ensure = (rel: string) => {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
      if (!link) { link = document.createElement("link"); link.rel = rel; document.head.appendChild(link); }
      return link;
    };
    ensure("icon").href = favicon;
    ensure("shortcut icon").href = favicon;
    ensure("apple-touch-icon").href = favicon;
  }, [favicon]);


  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProviderEffect />
      <ThemeStyleInjector />
      <AnalyticsScripts />
      <SeoCenterInjector />
      <SetupGate />
      <div className="pb-16 lg:pb-0">
        <Outlet />
      </div>
      <MobileBottomNav />
      <RecentlyPurchasedPopup />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
