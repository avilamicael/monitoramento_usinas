import { useNavigate } from "react-router-dom";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useAuth } from "@/features/auth/useAuth";
import {
  useSunGlow,
  setSunGlow,
  useTheme,
  setTheme,
  type SunMode,
  type Theme,
} from "@/components/trylab/sun-store";

interface UserMenuProps {
  trigger: React.ReactNode;
}

const SUN_MODE_LABEL: Record<SunMode, string> = {
  tempo: "Tempo",
  scroll: "Scroll",
  off: "Off",
};

const THEME_LABEL: Record<Theme, string> = {
  light: "Claro",
  dark: "Escuro",
};

export function UserMenu({ trigger }: UserMenuProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const sun = useSunGlow();
  const theme = useTheme();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={12}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <div className="tl-sun-controls">
          <div className="tl-sun-controls-section">
            <label>Tema</label>
            <div className="tl-seg" role="radiogroup" aria-label="Tema">
              {(["light", "dark"] as Theme[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  role="radio"
                  aria-checked={theme === m}
                  className={theme === m ? "active" : ""}
                  onClick={() => setTheme(m)}
                >
                  {THEME_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="tl-sun-controls-divider" />

          <h4>Sol no fundo</h4>

          <div className="tl-sun-controls-section">
            <label>Modo</label>
            <div className="tl-seg" role="radiogroup" aria-label="Modo do sol">
              {(["tempo", "scroll", "off"] as SunMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  role="radio"
                  aria-checked={sun.mode === m}
                  className={sun.mode === m ? "active" : ""}
                  onClick={() => setSunGlow({ mode: m })}
                >
                  {SUN_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="tl-sun-controls-section">
            <label>Intensidade</label>
            <div className="tl-slider">
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={sun.intensity}
                onChange={(e) => setSunGlow({ intensity: Number(e.target.value) })}
                aria-label="Intensidade do sol"
              />
              <span>{sun.intensity}%</span>
            </div>
          </div>

          <div className="tl-sun-controls-divider" />

          <button type="button" className="tl-sun-controls-action" onClick={handleLogout}>
            <span>Sair</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
