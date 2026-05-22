import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HudLabel } from "@/components/hud-label";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "CashFlow — Cockpit financeiro pessoal" },
      {
        name: "description",
        content: "Entre no CashFlow. Brutalismo, lime e zero enrolação no controle do seu dinheiro.",
      },
    ],
  }),
  component: LandingLogin,
});

function LandingLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Real-time clock for HUD flavor (client-only to avoid hydration mismatch)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail e entre.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-[1.2fr_1fr]">
      {/* Manifesto side */}
      <section className="relative border-b lg:border-b-0 lg:border-r border-border p-8 md:p-14 flex flex-col justify-between min-h-[60vh] lg:min-h-screen overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none" />

        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary" />
            <span className="font-display text-xl uppercase">CashFlow</span>
          </div>
          <HudLabel>v.1.0 · BR</HudLabel>
        </header>

        <div className="relative space-y-6 max-w-2xl">
          <HudLabel>SISTEMA · COCKPIT FINANCEIRO</HudLabel>
          <h1 className="font-display uppercase leading-[0.92] text-5xl md:text-7xl xl:text-8xl">
            Controle <span className="text-primary">total</span> do seu fluxo.
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg">
            Receitas, despesas, metas, cartões e plano de quitação em um único cockpit.
            Brutalista, rápido e sem distrações.
          </p>
          <div className="flex flex-wrap gap-2">
            {["RECEITAS", "DESPESAS", "ORÇAMENTOS", "METAS", "RELATÓRIOS", "PLANO DE AÇÃO"].map((t) => (
              <span key={t} className="hud-label border border-border px-2.5 py-1.5">
                {t}
              </span>
            ))}
          </div>
        </div>

        <footer className="relative grid grid-cols-3 gap-4 border-t border-border pt-4 text-xs">
          <div>
            <HudLabel bracket={false}>UPTIME</HudLabel>
            <div className="font-mono text-foreground">99.99%</div>
          </div>
          <div>
            <HudLabel bracket={false}>LOCAL TIME</HudLabel>
            <div className="font-mono text-foreground" suppressHydrationWarning>
              {now ? now.toLocaleTimeString("pt-BR") : "--:--:--"}
            </div>
          </div>
          <div>
            <HudLabel bracket={false}>NODE</HudLabel>
            <div className="font-mono text-foreground">SA-EAST · 01</div>
          </div>
        </footer>
      </section>

      {/* Auth side */}
      <section className="p-8 md:p-14 flex items-center bg-[var(--surface)]">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div>
            <HudLabel>{mode === "login" ? "ACESSO" : "NOVO USUÁRIO"}</HudLabel>
            <h2 className="font-display text-3xl md:text-4xl uppercase mt-2">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
          </div>

          <div className="flex border border-border">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-mono ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 text-xs uppercase tracking-wider font-mono ${mode === "signup" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Nome">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@dominio.com"
                className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 font-medium uppercase tracking-wider text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Conectando..." : mode === "login" ? "Entrar →" : "Criar conta →"}
            </button>

            <div className="flex items-center justify-between pt-2">
              <Link to="/recuperar-senha" className="text-xs text-muted-foreground hover:text-primary uppercase tracking-wider font-mono">
                Esqueci a senha
              </Link>
              <span className="hud-label">SSL · 256</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="hud-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
