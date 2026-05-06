import {
  Outlet,
  Link,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="hud-label hud-bracket">ERROR · 404</p>
        <h1 className="font-display text-7xl text-foreground mt-4 uppercase">404</h1>
        <h2 className="mt-2 text-xl text-foreground uppercase tracking-wide">Sinal perdido</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A rota requisitada não existe ou foi descomissionada.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium uppercase tracking-wide hover:opacity-90"
          >
            Voltar à base
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CashFlow — Controle total do seu fluxo" },
      {
        name: "description",
        content: "CashFlow: cockpit financeiro pessoal. Receitas, despesas, metas e plano de ação para sair do vermelho.",
      },
      { name: "theme-color", content: "#050505" },
      { property: "og:title", content: "CashFlow — Controle total do seu fluxo" },
      {
        property: "og:description",
        content: "Cockpit financeiro pessoal. Sem emoji, sem enrolação. Só o sinal que importa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
