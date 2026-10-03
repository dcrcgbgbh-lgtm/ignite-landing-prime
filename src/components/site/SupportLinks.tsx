import { Fragment } from "react";
import { Instagram, MessageCircle, Music2 } from "lucide-react";
import type { SupportSettings } from "@/lib/site-config";

const CHANNELS = [
  { key: "whatsapp", icon: MessageCircle, iconClass: "text-[#25D366]" },
  { key: "tiktok", icon: Music2, iconClass: "text-white drop-shadow-[1px_1px_0_#8b5cf6] [filter:drop-shadow(-1px_-1px_0_#ec4899)]" },
  { key: "instagram", icon: Instagram, iconClass: "text-[#e879f9]" },
] as const;

type SupportChannel = (typeof CHANNELS)[number]["key"];

function getExternalUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function SupportLinks({ support, className = "", channels, floating = false }: { support: SupportSettings; className?: string; channels?: readonly SupportChannel[]; floating?: boolean }) {
  const items = CHANNELS.flatMap((channel) => {
    const { key } = channel;
    const url = getExternalUrl(support[`${key}_url`]);
    return (!channels || channels.includes(key)) && support[`${key}_enabled`] && url
      ? [{ ...channel, url }]
      : [];
  });
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {!floating && <span className="text-xs text-muted-foreground">Suporte:</span>}
      {items.map(({ key, icon: Icon, iconClass, url }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={floating
            ? "glass glow-hover inline-flex min-h-11 items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 hover:text-primary-glow"
            : "glass glow-hover inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:text-primary-glow"}
        >
          <Icon size={floating ? 18 : 15} className={iconClass} />
          {support[`${key}_label`] || key}
        </a>
      ))}
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-semibold text-primary-glow underline underline-offset-2"
          >
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
