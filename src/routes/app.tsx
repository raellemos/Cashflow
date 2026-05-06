import { createFileRoute, Outlet, Link, redirect, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  Wallet,
  Target,
  PieChart,
  ListChecks,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  PiggyBank,
} from "lucide-react";
import { HudLabel } from "@/components/hud-label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/" });
  },
  component: AppLayout,
});

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/transactions", label: "Transações", icon: ArrowLeftRight },
  { to: "/app/categories", label: "Categorias", icon: Tags },
  { to: "/app/contas", label: "Contas", icon: Wallet },
  { to: "/app/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { to: "/app/metas", label: "Metas", icon: Target },
  { to: "/app/relatorios", label: "Relatórios", icon: PieChart },
  { to: "/app/plano", label: "Plano de ação", icon: ListChecks },
  { to: "/app/perfil", label: "Perfil", icon: UserIcon },
] as const;

function AppLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => setOpenMobile(false), [location.pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border flex-col bg-[var(--surface)] sticky top-0 h-screen">
        <SidebarContent currentPath={location.pathname} onLogout={logout} email={user?.email ?? ""} />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpenMobile(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-border bg-[var(--surface)] flex flex-col">
            <SidebarContent currentPath={location.pathname} onLogout={logout} email={user?.email ?? ""} />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        {/* Topbar */}
        <header className="border-b border-border bg-background sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="flex items-center justify-between px-4 md:px-8 h-14">
            <button onClick={() => setOpenMobile(true)} className="lg:hidden p-2 -ml-2">
              <Menu className="size-5" />
            </button>
            <div className="hidden lg:block">
              <HudLabel>SISTEMA · CASHFLOW</HudLabel>
            </div>
            <div className="flex items-center gap-3">
              <span className="hud-label hidden md:inline">{user?.email}</span>
              <div className="size-2 bg-primary lime-glow" />
              <span className="hud-label">ONLINE</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarContent({
  currentPath,
  onLogout,
  email,
}: {
  currentPath: string;
  onLogout: () => void;
  email: string;
}) {
  return (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <Link to="/app/dashboard" className="flex items-center gap-3">
          <div className="size-8 bg-primary" />
          <div className="leading-none">
            <div className="font-display uppercase text-lg">CashFlow</div>
            <div className="hud-label" style={{ fontSize: 9 }}>COCKPIT</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item) => {
          const active = currentPath === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors",
                active
                  ? "border-primary bg-[var(--surface-elevated)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-[var(--surface-elevated)]/40",
              )}
            >
              <Icon className="size-4" />
              <span className="uppercase tracking-wide font-medium" style={{ fontSize: 13 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div>
          <HudLabel bracket={false}>USER</HudLabel>
          <div className="text-xs font-mono text-foreground truncate">{email}</div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 border border-border py-2 text-xs uppercase tracking-wider hover:bg-[color:var(--flare)] hover:text-white hover:border-[color:var(--flare)]"
        >
          <LogOut className="size-3.5" />
          Sair
        </button>
      </div>
    </>
  );
}
