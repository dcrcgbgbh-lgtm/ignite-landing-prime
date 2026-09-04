import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerStatus } from "@/lib/owner.functions";
import { BarChart3, LogOut, MessagesSquare, Settings2, ShieldAlert, Loader2 } from "lucide-react";

const NAV = [
  { to: "/owner/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/owner/mensagens", label: "Mensagens", icon: MessagesSquare },
  { to: "/owner/painel", label: "Painel", icon: Settings2 },
] as const;

export function OwnerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    let alive = true;
    getOwnerStatus()
      .then((s) => alive && setState(s.isOwner ? "ok" : "denied"))
      .catch(() => alive && setState("denied"));
    return () => {
      alive = false;
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="glass w-[min(420px,94vw)] rounded-3xl p-7 text-center">
          <ShieldAlert className="mx-auto mb-3 text-primary" />
          <p className="font-display text-lg font-bold">Acesso negado</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva do proprietário do site.
          </p>
          <Link
            to="/auth"
            className="btn-glow mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1180px,94vw)] flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold">FF 2022 Elite · OWNER</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-primary/15 [&.active]:text-foreground"
                activeProps={{ className: "active" }}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut size={14} />
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-[min(1180px,94vw)] py-7">
        <h1 className="mb-6 font-display text-2xl font-bold">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
