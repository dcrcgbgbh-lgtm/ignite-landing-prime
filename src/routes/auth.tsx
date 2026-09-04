import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimOwnership, getOwnerStatus } from "@/lib/owner.functions";
import { Particles } from "@/components/site/Particles";
import { Flame, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso do proprietário | FF 2022 Elite" },
      {
        name: "description",
        content: "Área restrita de administração do FF 2022 Elite. Somente o proprietário do site.",
      },
      { property: "og:title", content: "Acesso do proprietário | FF 2022 Elite" },
      {
        property: "og:description",
        content: "Área restrita de administração do FF 2022 Elite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [status, setStatus] = useState<{ isOwner: boolean; ownerExists: boolean } | null>(null);

  const refreshStatus = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setStatus(null);
      return;
    }
    try {
      const s = await getOwnerStatus();
      setStatus(s);
      if (s.isOwner) navigate({ to: "/owner/dashboard", replace: true });
    } catch {
      setStatus({ isOwner: false, ownerExists: true });
    }
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (err) throw new Error(err.message);
        setInfo("Conta criada. Se for exigida confirmação por e-mail, confirme e faça login.");
      }
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      await claimOwnership();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar o proprietário.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus(null);
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 text-foreground">
      <Particles />
      <div
        className="glass relative z-10 w-[min(440px,94vw)] rounded-3xl p-7"
        style={{ boxShadow: "var(--shadow-glow), var(--shadow-elegant)" }}
      >
        <div className="mb-6 flex items-center gap-2">
          <span
            className="grid size-9 place-items-center rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Flame size={17} className="text-primary-foreground" />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-tight">Área do proprietário</p>
            <p className="text-xs text-muted-foreground">Acesso restrito • FF 2022 Elite</p>
          </div>
        </div>

        {status ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck size={16} className="text-primary" />
                Sessão ativa
              </p>
              <p className="mt-2 text-muted-foreground">
                {status.isOwner
                  ? "Você é o proprietário deste site."
                  : status.ownerExists
                    ? "Já existe um proprietário definido. Sua conta não tem acesso ao painel."
                    : "Nenhum proprietário definido ainda. Você pode ativar o primeiro acesso agora."}
              </p>
            </div>

            {!status.isOwner && !status.ownerExists && (
              <button
                onClick={claim}
                disabled={busy}
                className="btn-glow w-full rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                style={{ background: "var(--gradient-primary)" }}
              >
                {busy ? "Ativando..." : "Tornar-me proprietário"}
              </button>
            )}

            {status.isOwner && (
              <Link
                to="/owner/dashboard"
                className="btn-glow block w-full rounded-xl px-4 py-3 text-center text-sm font-bold text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
              >
                Ir para o Dashboard
              </Link>
            )}

            <button
              onClick={signOut}
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Sair da conta
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {mode === "login" ? "Primeiro acesso? Criar conta" : "Já tenho conta. Entrar"}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            {info}
          </p>
        )}
      </div>
    </div>
  );
}
