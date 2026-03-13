import { useEffect, useState } from "react";

const words = ["tokens", "water", "energy", "carbon"] as const;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);

    return () => {
      media.removeEventListener?.("change", update);
    };
  }, []);

  return reduced;
}

export function HeroBanner() {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % words.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92))] px-6 py-8 shadow-sm sm:px-8 sm:py-10">
      <div className="absolute inset-y-0 right-0 hidden w-40 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_68%)] sm:block" />
      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl">
          Understand your agent{" "}
          <span className="inline-grid min-w-[6ch] justify-items-start align-baseline text-left text-accent">
            <span
              key={words[activeIndex]}
              className={reducedMotion ? undefined : "hero-word"}
            >
              {words[activeIndex]}
            </span>
          </span>{" "}
          footprint locally.
        </h1>
      </div>
    </section>
  );
}
