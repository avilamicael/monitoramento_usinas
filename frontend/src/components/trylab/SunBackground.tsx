import { useEffect } from "react";
import { useSunGlow } from "@/components/trylab/sun-store";

/**
 * Renderiza o fundo dramático (gradient + grain) e o sun-orb.
 * Sincroniza variáveis CSS conforme o modo selecionado.
 *
 * Modos:
 *   tempo  — orb fixo no canto superior direito; cor/intensidade variam com a hora
 *   scroll — orb segue o scroll em arco
 *   off    — sem orb, gradiente base do céu noturno
 */
export function SunBackground() {
  const { mode, intensity } = useSunGlow();

  // Aplica modo + intensidade no html (data attrs + CSS vars)
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.tlSun = mode;
    root.style.setProperty("--sun-intensity", (intensity / 100).toFixed(2));
    return () => {
      // Não limpa intencionalmente — outros mounts podem reusar
    };
  }, [mode, intensity]);

  // Posicionamento do orb (cor/altitude/x/y) conforme o modo
  useEffect(() => {
    if (mode === "off") return;
    const root = document.documentElement;

    const update = () => {
      if (mode === "tempo") {
        const now = new Date();
        const h = now.getHours() + now.getMinutes() / 60;
        const dayProgress = Math.max(0, Math.min(1, (h - 6) / 12));
        const altitude = Math.sin(dayProgress * Math.PI);
        const hue = 30 + altitude * 55;
        const intensityFactor = 0.15 + altitude * 0.85;
        root.style.setProperty("--sun-x", "88%");
        root.style.setProperty("--sun-y", "16%");
        root.style.setProperty("--sun-alt", intensityFactor.toFixed(3));
        root.style.setProperty("--sun-hue", hue.toFixed(1));
      } else if (mode === "scroll") {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, window.scrollY / max));
        const x = 8 + progress * 84;
        const y = 70 - Math.sin(progress * Math.PI) * 58;
        root.style.setProperty("--sun-x", `${x}%`);
        root.style.setProperty("--sun-y", `${y}%`);
        root.style.setProperty("--sun-alt", Math.sin(progress * Math.PI).toFixed(3));
        root.style.setProperty("--sun-hue", "60");
      }
    };

    update();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    let interval = 0;
    if (mode === "scroll") {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else if (mode === "tempo") {
      interval = window.setInterval(update, 60_000);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (interval) window.clearInterval(interval);
      cancelAnimationFrame(raf);
    };
  }, [mode]);

  return (
    <>
      <div className="tl-bg-scene" aria-hidden="true" />
      {mode !== "off" && <div className="tl-sun-orb" aria-hidden="true" />}
      <div className="tl-bg-grain" aria-hidden="true" />
    </>
  );
}
