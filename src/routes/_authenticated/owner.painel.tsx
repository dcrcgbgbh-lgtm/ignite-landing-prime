import type { CouponConfig } from "@/lib/site-config";
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerShell, Panel } from "@/components/owner/OwnerShell";
import {
  getAdminConfig,
  saveSetting,
  savePlan,
  saveBotRule,
  deleteBotRule,
} from "@/lib/owner.functions";
import type { SiteSettings } from "@/lib/site-config";
import { CheckCircle2, Loader2, Percent, Sparkles, Tag, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/painel")({
  head: () => ({
    meta: [
      { title: "Painel de configuração | FF 2022 Elite" },
      { name: "description", content: "Edite textos, vídeo, planos, Pix, FAQ e regras do bot do FF 2022 Elite." },
      { property: "og:title", content: "Painel de configuração | FF 2022 Elite" },
      { property: "og:description", content: "Configuração completa do site FF 2022 Elite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PainelPage,
});

type Config = Awaited<ReturnType<typeof getAdminConfig>>;
type Row = Record<string, unknown>;

const TABS = ["Hero", "Acesso e vídeo", "Bot", "Regras", "Planos", "FAQ", "Seções", "Chat", "Auditoria", "Suporte", "Cupom"] as const;

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      )}
    </label>
  );
}

function PainelPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Hero");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [couponSync, setCouponSync] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const couponHydrated = useRef(false);
  const couponSaveTimer = useRef<number | null>(null);

  const load = async () => {
    try {
      setCfg(await getAdminConfig());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!cfg) return;
    if (!couponHydrated.current) {
      couponHydrated.current = true;
      return;
    }
    if (tab !== "Cupom") return;
    if (couponSaveTimer.current) window.clearTimeout(couponSaveTimer.current);
    setCouponSync("saving");
    couponSaveTimer.current = window.setTimeout(async () => {
      try {
        await saveSetting({
          data: {
            key: "coupons",
            value: cfg.settings.coupons as unknown as Record<string, unknown>,
          },
        });
        setCouponSync("saved");
      } catch {
        setCouponSync("error");
      }
    }, 700);
    return () => {
      if (couponSaveTimer.current) window.clearTimeout(couponSaveTimer.current);
    };
  }, [cfg?.settings.coupons, tab]);

  if (!cfg) {
    return (
      <OwnerShell title="Painel">
        {msg ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{msg}</p>
        ) : (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </OwnerShell>
    );
  }

  const s = cfg.settings;
  const patch = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setCfg({ ...cfg, settings: { ...s, [key]: value } });

  const persist = async (key: keyof SiteSettings) => {
    setBusy(true);
    setMsg(null);
    try {
      await saveSetting({ data: { key: key as string, value: s[key] as unknown as Record<string, unknown> } });
      setMsg("Salvo com sucesso.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  };

  const SaveBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className="btn-glow rounded-xl px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      style={{ background: "var(--gradient-primary)" }}
    >
      Salvar
    </button>
  );

  const updatePlan = (idx: number, key: string, value: unknown) => {
    const plans = [...cfg.plans] as Row[];
    plans[idx] = { ...(plans[idx] as Row), [key]: value };
    setCfg({ ...cfg, plans: plans as Config["plans"] });
  };

  const updateRule = (idx: number, key: string, value: unknown) => {
    const rules = [...cfg.rules] as Row[];
    rules[idx] = { ...(rules[idx] as Row), [key]: value };
    setCfg({ ...cfg, rules: rules as Config["rules"] });
  };

  const updateCoupon = (idx: number, key: string, value: unknown) => {
    const coupons = [...s.coupons];
    coupons[idx] = { ...(coupons[idx] as CouponConfig), [key]: value } as CouponConfig;
    patch("coupons", coupons);
  };

  const addCoupon = () => {
    patch("coupons", [
      ...s.coupons,
      {
        id: crypto.randomUUID(),
        plan_id: "starter",
        code: "DESCONTO10",
        name: "Cupom de 10% OFF",
        discount_percent: 10,
        display_text: "Use o cupom DESCONTO10 e receba 10% de desconto.",
        enabled: true,
      },
    ]);
  };

  return (
    <OwnerShell title="Painel de configuração">
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl border px-3 py-2 text-xs transition-colors ${
              tab === t
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && (
        <p className="mb-4 rounded-xl border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
          {msg}
        </p>
      )}

      {tab === "Hero" && (
        <Panel title="Nome do site" actions={<SaveBtn onClick={() => void persist("branding")} />}>
          <Field
            label="Nome do site no topo"
            value={s.branding.site_name}
            onChange={(v) => patch("branding", { ...s.branding, site_name: v })}
          />
          <p className="mt-2 text-xs text-muted-foreground">Aparece no topo e rodapé. Não altera o título principal.</p>
        </Panel>
      )}

      {tab === "Hero" && <div className="h-4" />}

      {tab === "Hero" && (
        <Panel title="Hero e CTA" actions={<SaveBtn onClick={() => void persist("hero")} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título" value={s.hero.title} onChange={(v) => patch("hero", { ...s.hero, title: v })} />
            <Field label="CTA" value={s.hero.cta} onChange={(v) => patch("hero", { ...s.hero, cta: v })} />
            <div className="sm:col-span-2">
              <Field
                label="Subtítulo"
                value={s.hero.subtitle}
                onChange={(v) => patch("hero", { ...s.hero, subtitle: v })}
              />
            </div>
          </div>
        </Panel>
      )}

      {tab === "Acesso e vídeo" && (
        <div className="space-y-5">
          <Panel title="Textos do fluxo de acesso" actions={<SaveBtn onClick={() => void persist("access")} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título" value={s.access.title} onChange={(v) => patch("access", { ...s.access, title: v })} />
              <Field
                label="Descrição"
                value={s.access.description}
                onChange={(v) => patch("access", { ...s.access, description: v })}
              />
              <Field
                label="Rótulo acesso grátis"
                value={s.access.free_label}
                onChange={(v) => patch("access", { ...s.access, free_label: v })}
              />
              <Field
                label="Rótulo acesso pago"
                value={s.access.paid_label}
                onChange={(v) => patch("access", { ...s.access, paid_label: v })}
              />
              <Field
                label="URL do vídeo"
                value={s.access.video_url}
                onChange={(v) => patch("access", { ...s.access, video_url: v })}
              />
              <Field
                label="Capa / thumbnail (URL)"
                value={s.access.cover_url}
                onChange={(v) => patch("access", { ...s.access, cover_url: v })}
              />
              <Field
                label="Título do vídeo"
                value={s.access.video_title}
                onChange={(v) => patch("access", { ...s.access, video_title: v })}
              />
              <Field
                label="Duração"
                value={s.access.video_duration}
                onChange={(v) => patch("access", { ...s.access, video_duration: v })}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Descrição do vídeo"
                  value={s.access.video_description}
                  onChange={(v) => patch("access", { ...s.access, video_description: v })}
                  textarea
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.access.video_enabled}
                  onChange={(e) => patch("access", { ...s.access, video_enabled: e.target.checked })}
                />
                Vídeo ativo
              </label>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
              <div className="aspect-video w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-black/50">
                {s.access.video_enabled && s.access.video_url ? (
                  /\.(mp4|webm|ogg)(\?|$)/i.test(s.access.video_url) ? (
                    <video
                      src={s.access.video_url}
                      poster={s.access.cover_url || undefined}
                      controls
                      className="size-full object-cover"
                    />
                  ) : (
                    <iframe src={s.access.video_url} title="Pré-visualização" className="size-full" />
                  )
                ) : s.access.cover_url ? (
                  <img src={s.access.cover_url} alt="Capa do vídeo" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted-foreground">
                    Nenhum vídeo configurado
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Acesso grátis" actions={<SaveBtn onClick={() => void persist("free_access")} />}>
            <div className="grid gap-3">
              <Field
                label="Link do TikTok"
                value={s.free_access.tiktok_url}
                onChange={(v) => patch("free_access", { ...s.free_access, tiktok_url: v })}
              />
              <Field
                label="Instrução do print"
                value={s.free_access.print_hint}
                onChange={(v) => patch("free_access", { ...s.free_access, print_hint: v })}
                textarea
              />
            </div>
          </Panel>
        </div>
      )}

      {tab === "Bot" && (
        <div className="space-y-5">
          <Panel
            title="Mensagem do TikTok Lite"
            actions={<SaveBtn onClick={() => void persist("bot_messages")} />}
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.bot_messages.steps_enabled}
                  onChange={(e) =>
                    patch("bot_messages", { ...s.bot_messages, steps_enabled: e.target.checked })
                  }
                />
                Ativar esta mensagem no bot
              </label>
              <p className="text-xs text-muted-foreground">
                Controla a mensagem "🚀 Acesso rápido e simples", incluindo o link do TikTok e o passo a passo.
                Desative aqui para ela deixar de aparecer no chat.
              </p>
              <Field
                label="Título da mensagem"
                value={s.bot_messages.steps_title}
                onChange={(v) => patch("bot_messages", { ...s.bot_messages, steps_title: v })}
              />
              <Field
                label="Passos (um por linha)"
                value={(s.bot_messages.steps ?? []).join("\n")}
                onChange={(v) =>
                  patch("bot_messages", { ...s.bot_messages, steps: v.split("\n").filter(Boolean) })
                }
                textarea
              />
            </div>
          </Panel>

          <Panel
            title="Mensagem GHOST XITS"
            actions={<SaveBtn onClick={() => void persist("bot_messages")} />}
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.bot_messages.profile_enabled}
                  onChange={(e) =>
                    patch("bot_messages", { ...s.bot_messages, profile_enabled: e.target.checked })
                  }
                />
                Ativar esta mensagem no bot
              </label>
              <p className="text-xs text-muted-foreground">
                Controla a mensagem final automática com GHOST XITS. Desative aqui para removê-la do chat.
              </p>
              <Field
                label="Texto da mensagem"
                value={s.bot_messages.profile}
                onChange={(v) => patch("bot_messages", { ...s.bot_messages, profile: v })}
                textarea
              />
            </div>
          </Panel>

          <Panel title="Outras mensagens automáticas" actions={<SaveBtn onClick={() => void persist("bot_messages")} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(s.bot_messages) as (keyof typeof s.bot_messages)[])
                .filter(
                  (k) =>
                    ![
                      "steps",
                      "steps_enabled",
                      "profile_enabled",
                      "profile",
                      "steps_title",
                    ].includes(k),
                )
                .map((k) => (
                  <Field
                    key={k}
                    label={
                      k === "greeting_morning"
                        ? "Bom dia"
                        : k === "greeting_afternoon"
                          ? "Boa tarde"
                          : k === "greeting_evening"
                            ? "Boa noite"
                            : k
                    }
                    value={String(s.bot_messages[k] ?? "")}
                    onChange={(v) => patch("bot_messages", { ...s.bot_messages, [k]: v })}
                    textarea
                  />
                ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === "Regras" && (
        <Panel
          title="Regras do bot (sem IA)"
          actions={
            <button
              onClick={async () => {
                await saveBotRule({
                  data: { label: "Nova regra", keywords: [], response: "", priority: 0, active: true, delay_ms: 600 },
                });
                await load();
              }}
              className="rounded-xl border border-border/60 px-3 py-2 text-xs"
            >
              + Nova regra
            </button>
          }
        >
          <div className="space-y-4">
            {(cfg.rules as Row[]).map((r, i) => (
              <div key={String(r['id'] ?? i)} className="rounded-xl border border-border/60 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Rótulo" value={String(r['label'] ?? "")} onChange={(v) => updateRule(i, "label", v)} />
                  <Field
                    label="Palavras-chave (vírgula)"
                    value={((r['keywords'] as string[]) ?? []).join(", ")}
                    onChange={(v) =>
                      updateRule(i, "keywords", v.split(",").map((x) => x.trim()).filter(Boolean))
                    }
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Resposta"
                      value={String(r['response'] ?? "")}
                      onChange={(v) => updateRule(i, "response", v)}
                      textarea
                    />
                  </div>
                  <Field
                    label="Prioridade"
                    value={String(r['priority'] ?? 0)}
                    onChange={(v) => updateRule(i, "priority", Number(v) || 0)}
                  />
                  <Field
                    label="Delay (ms)"
                    value={String(r['delay_ms'] ?? 600)}
                    onChange={(v) => updateRule(i, "delay_ms", Number(v) || 0)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r['active'] === true}
                      onChange={(e) => updateRule(i, "active", e.target.checked)}
                    />
                    Ativa
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r['ask_for_print'] === true}
                      onChange={(e) => updateRule(i, "ask_for_print", e.target.checked)}
                    />
                    Pedir print
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <SaveBtn
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await saveBotRule({ data: r });
                        setMsg("Regra salva.");
                        await load();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!window.confirm("Excluir regra?")) return;
                      await deleteBotRule({ data: { id: String(r['id']) } });
                      await load();
                    }}
                    className="rounded-xl border border-destructive/50 px-3 py-2 text-xs text-destructive"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "Planos" && (
        <div className="space-y-4">
          {(cfg.plans as Row[]).map((p, i) => (
            <Panel
              key={String(p['id'])}
              title={String(p['name'])}
              actions={
                <SaveBtn
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await savePlan({ data: p });
                      setMsg("Plano salvo.");
                      await load();
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : "Falha ao salvar plano.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome" value={String(p['name'] ?? "")} onChange={(v) => updatePlan(i, "name", v)} />
                <Field label="Preço" value={String(p['price'] ?? "")} onChange={(v) => updatePlan(i, "price", v)} />
                <Field label="CTA" value={String(p['cta'] ?? "")} onChange={(v) => updatePlan(i, "cta", v)} />
                <Field label="Selo" value={String(p['badge'] ?? "")} onChange={(v) => updatePlan(i, "badge", v)} />
                <Field
                  label="Ordem"
                  value={String(p['sort_order'] ?? 0)}
                  onChange={(v) => updatePlan(i, "sort_order", Number(v) || 0)}
                />
                <Field
                  label="Checkout URL"
                  value={String(p['checkout_url'] ?? "")}
                  onChange={(v) => updatePlan(i, "checkout_url", v)}
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Benefícios (um por linha)"
                    value={((p['features'] as string[]) ?? []).join("\n")}
                    onChange={(v) => updatePlan(i, "features", v.split("\n").filter(Boolean))}
                    textarea
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Payload Pix"
                    value={String(p['pix_payload'] ?? "")}
                    onChange={(v) => updatePlan(i, "pix_payload", v)}
                    textarea
                  />
                </div>
                {(["active", "highlight", "vip"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p[k] === true}
                      onChange={(e) => updatePlan(i, k, e.target.checked)}
                    />
                    {k === "active" ? "Ativo" : k === "highlight" ? "Destaque" : "VIP"}
                  </label>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {tab === "FAQ" && (
        <Panel
          title="Perguntas frequentes"
          actions={<SaveBtn onClick={() => void persist("faq")} />}
        >
          <div className="space-y-3">
            {s.faq.items.map((item, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
                <Field
                  label="Pergunta"
                  value={item.q}
                  onChange={(v) => {
                    const items = [...s.faq.items];
                    items[i] = { ...item, q: v };
                    patch("faq", { items });
                  }}
                />
                <Field
                  label="Resposta"
                  value={item.a}
                  onChange={(v) => {
                    const items = [...s.faq.items];
                    items[i] = { ...item, a: v };
                    patch("faq", { items });
                  }}
                  textarea
                />
                <button
                  onClick={() => patch("faq", { items: s.faq.items.filter((_, j) => j !== i) })}
                  className="justify-self-start rounded-xl border border-destructive/50 px-3 py-2 text-xs text-destructive"
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              onClick={() => patch("faq", { items: [...s.faq.items, { q: "", a: "" }] })}
              className="rounded-xl border border-border/60 px-3 py-2 text-xs"
            >
              + Nova pergunta
            </button>
          </div>
        </Panel>
      )}

      {tab === "Seções" && (
        <Panel title="Seções visíveis" actions={<SaveBtn onClick={() => void persist("sections")} />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.keys(s.sections).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.sections[k] === true}
                  onChange={(e) => patch("sections", { ...s.sections, [k]: e.target.checked })}
                />
                {k}
              </label>
            ))}
          </div>
        </Panel>
      )}

      {tab === "Cupom" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="group rounded-2xl border border-border/60 bg-card/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary-glow"><Tag size={17} /></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
              </div>
              <p className="mt-3 text-2xl font-black">{s.coupons.length}</p>
              <p className="text-xs text-muted-foreground">cupons cadastrados</p>
            </div>
            <div className="group rounded-2xl border border-border/60 bg-card/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={17} /></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ativos</span>
              </div>
              <p className="mt-3 text-2xl font-black">{s.coupons.filter((c) => c.enabled).length}</p>
              <p className="text-xs text-muted-foreground">disponíveis no checkout</p>
            </div>
            <div className="group rounded-2xl border border-border/60 bg-card/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-400"><Percent size={17} /></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Desconto</span>
              </div>
              <p className="mt-3 text-2xl font-black">
                {s.coupons.length ? Math.round(s.coupons.reduce((sum, c) => sum + Number(c.discount_percent || 0), 0) / s.coupons.length) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">média dos descontos</p>
            </div>
          </div>

          <Panel
            title="Central de cupons"
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className={couponSync === "saving" ? "size-1.5 animate-pulse rounded-full bg-amber-400" : couponSync === "error" ? "size-1.5 rounded-full bg-red-400" : "size-1.5 rounded-full bg-emerald-400"} />
                  {couponSync === "saving" ? "Sincronizando..." : couponSync === "error" ? "Erro ao sincronizar" : "Sincronizado em tempo real"}
                </span>
                <button
                  type="button"
                  onClick={addCoupon}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-bold text-primary-glow transition-all hover:-translate-y-0.5 hover:bg-primary/10"
                >
                  <Sparkles size={14} /> Novo cupom
                </button>
                <SaveBtn onClick={() => void persist("coupons")} />
              </div>
            }
          >
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-glow"><Zap size={17} /></span>
              <div>
                <p className="text-sm font-bold text-foreground">Cupons por plano + sincronização automática</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Cada cupom fica vinculado a um plano específico. As alterações são salvas automaticamente e chegam ao checkout público sem precisar recarregar a página.
                </p>
              </div>
            </div>

            {s.coupons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary-glow"><Tag size={20} /></span>
                <p className="mt-3 font-bold">Nenhum cupom criado</p>
                <p className="mt-1 text-xs text-muted-foreground">Crie seu primeiro cupom para liberar uma oferta no checkout.</p>
                <button type="button" onClick={addCoupon} className="mt-4 rounded-xl px-4 py-2.5 text-xs font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                  Criar primeiro cupom
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {s.coupons.map((coupon, i) => (
                  <div key={coupon.id} className="group rounded-2xl border border-border/60 bg-card/30 p-4 transition-all duration-300 hover:border-primary/30 hover:bg-card/50">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-glow"><Tag size={18} /></span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{coupon.name || "Novo cupom"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="rounded-full border border-border/60 bg-background/30 px-2 py-0.5">{coupon.code || "SEM CÓDIGO"}</span>
                            <span>•</span>
                            <span>{coupon.plan_id === "starter" ? "Elite Starter · R$ 9,99" : coupon.plan_id === "premium" ? "Elite Premium · R$ 14,90" : "Elite VIP · R$ 29,90"}</span>
                            <span>•</span>
                            <span className="font-bold text-primary-glow">{coupon.discount_percent}% OFF</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${coupon.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {coupon.enabled ? "Ativo" : "Desativado"}
                        </span>
                        <button
                          type="button"
                          onClick={() => patch("coupons", s.coupons.filter((_, index) => index !== i))}
                          className="rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-border/50 bg-background/20 p-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Plano do cupom</span>
                        <select
                          value={coupon.plan_id}
                          onChange={(e) => updateCoupon(i, "plan_id", e.target.value)}
                          className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
                        >
                          <option value="starter">R$ 9,99 — Elite Starter</option>
                          <option value="premium">R$ 14,90 — Elite Premium</option>
                          <option value="vip">R$ 29,90 — Elite VIP</option>
                        </select>
                      </label>
                      <Field label="Código do cupom" value={coupon.code} onChange={(v) => updateCoupon(i, "code", v.toUpperCase().replace(/\s+/g, ""))} />
                      <Field label="Nome do cupom" value={coupon.name} onChange={(v) => updateCoupon(i, "name", v)} />
                      <Field
                        label="Desconto (%)"
                        value={String(coupon.discount_percent)}
                        onChange={(v) => updateCoupon(i, "discount_percent", Math.min(100, Math.max(0, Number(v) || 0)))}
                      />
                      <div className="sm:col-span-2">
                        <Field label="Texto mostrado ao cliente" value={coupon.display_text} onChange={(v) => updateCoupon(i, "display_text", v)} />
                      </div>
                      <label className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/30 px-3 py-2.5 text-sm">
                        <input type="checkbox" checked={coupon.enabled} onChange={(e) => updateCoupon(i, "enabled", e.target.checked)} />
                        <span><strong className="block text-xs">Cupom ativo</strong><span className="text-[11px] text-muted-foreground">Disponível para este plano</span></span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
      {tab === "Suporte" && (
        <Panel title="Canais de suporte" actions={<SaveBtn onClick={() => void persist("support")} />}>
          <div className="space-y-5">
            {(["whatsapp", "tiktok", "instagram"] as const).map((c) => (
              <div key={c} className="grid gap-3 rounded-xl border border-border/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field
                  label={`URL ${c}`}
                  value={s.support[`${c}_url`]}
                  onChange={(v) => patch("support", { ...s.support, [`${c}_url`]: v })}
                />
                <Field
                  label="Rótulo"
                  value={s.support[`${c}_label`]}
                  onChange={(v) => patch("support", { ...s.support, [`${c}_label`]: v })}
                />
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.support[`${c}_enabled`]}
                    onChange={(e) => patch("support", { ...s.support, [`${c}_enabled`]: e.target.checked })}
                  />
                  Ativo
                </label>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["show_in_free_access", "Mostrar no acesso grátis"],
                ["show_in_chat", "Mostrar no chat"],
                ["show_in_paid_access", "Mostrar na página de compra"],
              ] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.support[k]}
                    onChange={(e) => patch("support", { ...s.support, [k]: e.target.checked })}
                  />
                  {l}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Canais com URL vazia não aparecem no site, mesmo ativos.</p>
          </div>
        </Panel>
      )}

      {tab === "Chat" && (
        <Panel title="Configurações do chat" actions={<SaveBtn onClick={() => void persist("chat")} />}>
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
              <input type="checkbox" checked={s.chat.enabled} onChange={(e) => patch("chat", { ...s.chat, enabled: e.target.checked })} className="mt-1" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{s.chat.enabled ? "Chat aberto para todos" : "Chat fechado para todos"}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{s.chat.enabled ? "Visitantes podem iniciar conversas e enviar mensagens e prints." : "Visitantes não podem iniciar conversas nem enviar mensagens ou prints. Conversas existentes são preservadas."}</span>
              </span>
            </label>
            <Field label="Mensagem exibida quando o chat estiver fechado" value={s.chat.closed_message} onChange={(v) => patch("chat", { ...s.chat, closed_message: v })} textarea />
            <p className="text-xs text-muted-foreground">Salve para aplicar a configuração globalmente. Os botões de TikTok e WhatsApp usam os links cadastrados na aba Suporte.</p>
          </div>
        </Panel>
      )}

      {tab === "Auditoria" && (
        <Panel title="Histórico de alterações">
          {(cfg.audit as Row[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="divide-y divide-border/50 text-sm">
              {(cfg.audit as Row[]).map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">{String(a['action'])}</span>
                  <span className="text-xs text-muted-foreground">{String(a['entity'])}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(String(a['created_at'])).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </OwnerShell>
  );
}
