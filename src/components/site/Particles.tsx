import { useMemo } from "react";

export function Particles({ count = 34 }: { count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        size: 1 + ((i * 13) % 4),
        delay: (i * 0.83) % 18,
        duration: 16 + ((i * 7) % 18),
        red: i % 3 === 0,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute bottom-[-10vh] rounded-full"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            background: d.red ? "var(--primary-glow)" : "oklch(1 0 0 / 0.6)",
            boxShadow: d.red ? "0 0 10px var(--primary-glow)" : "0 0 6px oklch(1 0 0 / 0.4)",
            animation: `float-particle ${d.duration}s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
