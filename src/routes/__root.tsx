import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, RefreshCw, SearchX, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-gradient-soft px-4 py-12">
      <div className="pointer-events-none absolute -left-28 top-12 h-64 w-64 rounded-full bg-brand-blue/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-12 h-64 w-64 rounded-full bg-brand-orange/15 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-border bg-gradient-card p-7 text-center shadow-elegant sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold text-primary">Սխալ 404</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Էջը չի գտնվել</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Հնարավոր է՝ էջի հասցեն փոխվել է կամ այն այլևս հասանելի չէ։
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-base hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Վերադառնալ գլխավոր էջ
        </Link>
      </section>
    </main>
  );
}

function ErrorComponent({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-gradient-soft px-4 py-12">
      <section className="relative w-full max-w-md rounded-[2rem] border border-border bg-gradient-card p-7 text-center shadow-elegant sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-bold text-foreground">Էջը չբեռնվեց</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ժամանակավոր խնդիր առաջացավ։ Փորձիր կրկին կամ վերադարձիր գլխավոր էջ։
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-base hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Փորձել կրկին
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-base hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Գլխավոր էջ
          </a>
        </div>
      </section>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Էջմիածնի Երիտասարդական Տուն" },
      {
        name: "description",
        content:
          "AI-ով աշխատող երիտասարդական հարթակ Էջմիածնի երիտասարդների համար․ նախագծեր, քվեստներ, միջոցառումներ և անհատական AI օգնական։",
      },
      { name: "author", content: "Էջմիածնի Երիտասարդական Տուն" },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f9fcfd" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#111827" },
      { property: "og:title", content: "Էջմիածնի Երիտասարդական Տուն" },
      {
        property: "og:description",
        content:
          "AI-ով աշխատող երիտասարդական հարթակ Էջմիածնի երիտասարդների համար․ նախագծեր, քվեստներ, միջոցառումներ և անհատական AI օգնական։",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Էջմիածնի Երիտասարդական Տուն" },
      {
        name: "twitter:description",
        content:
          "AI-ով աշխատող երիտասարդական հարթակ Էջմիածնի երիտասարդների համար․ նախագծեր, քվեստներ, միջոցառումներ և անհատական AI օգնական։",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/pwa-192.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // Noto Sans/Serif Armenian back up Inter/Fraunces, which have no Armenian glyphs.
        href: "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+Armenian:wght@400;500;600;700&family=Noto+Serif+Armenian:wght@500;700&display=swap",
      },
    ],
    scripts: [
      {
        // Apply the saved (or system) theme before first paint to avoid a flash.
        children:
          '(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();',
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hy" suppressHydrationWarning>
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthInvalidator />
        <AppShell>
          <Outlet />
        </AppShell>
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Refresh router/query state when Supabase rotates or replaces the session. */
function AuthInvalidator() {
  const { session, loading } = useAuth();
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    void router.invalidate();
    void queryClient.invalidateQueries();
  }, [loading, queryClient, router, session?.access_token]);

  return null;
}
