import { createFileRoute, useRouter } from "@tanstack/react-router";
import { errMsg } from "@/lib/utils";
import { changePassword, logout as logoutFn, updateProfile } from "@/server/auth.fn";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({ meta: [{ title: "Perfil — CashFlow" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.displayName ?? "");
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ data: { displayName } });
      toast.success("Perfil atualizado");
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const changePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Senha precisa ter pelo menos 8 caracteres");
    setSaving(true);
    try {
      await changePassword({ data: { currentPassword, newPassword: password } });
      toast.success("Senha alterada");
      setPassword("");
      setCurrentPassword("");
    } catch (err) {
      toast.error(errMsg(err, "Erro ao alterar senha"));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await logoutFn();
    router.navigate({ to: "/" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <HudLabel>USUÁRIO</HudLabel>
        <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Perfil</h1>
      </div>

      <BrutalCard className="p-5">
        <HudLabel>IDENTIFICAÇÃO</HudLabel>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-mono">
          <div>
            <div className="hud-label">EMAIL</div>
            <div className="mt-1 text-foreground">{user?.email}</div>
          </div>
          <div>
            <div className="hud-label">USER ID</div>
            <div className="mt-1 text-foreground truncate text-xs">{user?.id}</div>
          </div>
        </div>
      </BrutalCard>

      <BrutalCard className="p-5">
        <form onSubmit={saveProfile} className="space-y-3">
          <HudLabel>NOME DE EXIBIÇÃO</HudLabel>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider font-medium"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </BrutalCard>

      <BrutalCard className="p-5">
        <form onSubmit={changePass} className="space-y-3">
          <HudLabel>ALTERAR SENHA</HudLabel>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Senha atual"
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mín. 8)"
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={saving || password.length < 8 || !currentPassword}
            className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider font-medium disabled:opacity-50"
          >
            Atualizar senha
          </button>
        </form>
      </BrutalCard>

      <BrutalCard className="p-5 border-[color:var(--flare)]/40">
        <HudLabel>ZONA DE PERIGO</HudLabel>
        <button
          onClick={logout}
          className="mt-3 inline-flex items-center gap-2 bg-[color:var(--flare)] text-white px-4 py-2 text-xs uppercase tracking-wider font-medium"
        >
          <LogOut className="size-3.5" /> Encerrar sessão
        </button>
      </BrutalCard>
    </div>
  );
}
