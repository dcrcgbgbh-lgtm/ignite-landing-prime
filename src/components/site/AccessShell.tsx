import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Flame, Play } from "lucide-react";
import { Particles } from "@/components/site/Particles";
import type { AccessSettings } from "@/lib/site-config";

export function AccessShell({ children, siteName }: { children: ReactNode; siteName?: string }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Particles />

      <header className="fixed inset-x-0 top-0 z-40 mx-auto mt-4 flex w-[min(1180px,92vw)] items-center justify-between rounded-2xl px-4 py-3 glass">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Flame size={16} className="text-primary-foreground" />
          </span>
          <span className="truncate font-display text-sm font-bold">{siteName || "FF 2022 Elite"}</span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar ao site
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-[min(880px,92vw)] px-1 pb-20 pt-28">{children}</main>
    </div>
  );
}

export function AccessVideoCard({ access }: { access: AccessSettings }) {
  const url = (access.video_url ?? "").trim();
  const cover = (access.cover_url ?? "").trim();
  const enabled = access.video_enabled !== false;

  const isFile = /\.(mp4|webm|ogg)(\?|$)/i.test(url);

  return (
    <article
      className="glass overflow-hidden rounded-3xl"
      style={{ boxShadow: "var(--shadow-glow), var(--shadow-elegant)" }}
    >
      <div className="relative aspect-video w-full bg-black/60">
        {enabled && url ? (
          isFile ? (
            <video
              src={url}
              poster={cover || undefined}
              controls
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
          ) : (
            <iframe
              src={url}
              title={access.video_title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          )
        ) : (
          <div className="relative grid size-full place-items-center">
            {cover ? (
              <img
                src={cover}
                alt={access.video_title}
                className="absolute inset-0 size-full object-cover opacity-50"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: "var(--gradient-hero)" }}
                aria-hidden
              />
            )}
            <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
              <span
                className="grid size-16 place-items-center rounded-2xl"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Play size={24} className="text-primary-foreground" />
              </span>
              <p className="font-display text-sm font-bold">Vídeo em preparação</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                A explicação em vídeo será publicada aqui em breve. Você já pode seguir com as
                opções abaixo.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold sm:text-xl">{access.video_title}</h2>
          {access.video_duration ? (
            <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
              {access.video_duration}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {access.video_description}
        </p>
      </div>
    </article>
  );
}
