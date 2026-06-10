import { createFileRoute, Link } from "@tanstack/react-router";
import { HudLabel } from "@/components/hud-label";

// TODO(SMTP): quando houver provedor de e-mail (ex.: Resend/SES via VPS),
// implementar fluxo de reset por token enviado por e-mail:
// 1. tabela password_reset_tokens (token hash, user_id, expires_at)
// 2. server fn requestPasswordReset(email) → envia link
// 3. server fn resetPassword(token, newPassword)
export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [{ title: "Recuperar senha — CashFlow" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border bg-[var(--surface)] p-8 space-y-6">
        <HudLabel>RECUPERAR</HudLabel>
        <h1 className="font-display text-3xl uppercase">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          A redefinição por e-mail ainda não está disponível nesta versão self-hosted.
        </p>
        <ul className="text-sm text-muted-foreground space-y-2 font-mono">
          <li>▸ Lembra a senha? Entre e troque em Perfil → Alterar senha.</li>
          <li>
            ▸ Perdeu o acesso? O administrador pode redefinir sua senha diretamente no servidor.
          </li>
        </ul>
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-primary uppercase font-mono"
        >
          ← Voltar para o login
        </Link>
      </div>
    </div>
  );
}
