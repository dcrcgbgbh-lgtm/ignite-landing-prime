import { Fragment } from "react";
import { Instagram, MessageCircle, Music2 } from "lucide-react";
import type { SupportSettings } from "@/lib/site-config";

const CHANNELS = [
  { key: "whatsapp", icon: MessageCircle },
  { key: "tiktok", icon: Music2 },
  { key: "instagram", icon: Instagram },
] as const;

export function SupportLinks({ support, className = "" }: { support: SupportSettings; className?: string }) {
  const items = CHANNELS.filter(
    ({ key }) => support[`${key}_enabled`] && (support[`${key}_url`] ?? "").trim(),
  );
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground">Suporte:</span>
      {items.map(({ key, icon: Icon }) => (
        <a
          key={key}
          href={support[`${key}_url`].trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="glass glow-hover inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:text-primary-glow"
        >
          <Icon size={13} className="text-primary-glow" />
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
