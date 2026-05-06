import { createRouter, useRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center border border-border p-8 bg-[var(--surface)]">
        <p className="hud-label hud-bracket text-[color:var(--flare)]">SISTEMA · FALHA</p>
        <h1 className="font-display text-3xl text-foreground mt-4 uppercase">
          Ocorreu uma falha
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo travou no fluxo. Tente novamente.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto border border-border p-3 text-left font-mono text-xs text-[color:var(--flare)]">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wide font-medium"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="border border-border bg-transparent px-4 py-2 text-sm uppercase tracking-wide text-foreground"
          >
            Base
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
