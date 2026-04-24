import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      nav("/");
    } catch {
      setError("Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-[var(--color-muted)] rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">Entrar</h1>
        <label className="block">
          <span className="text-sm">Usuário</span>
          <input
            className="mt-1 w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Senha</span>
          <input
            type="password"
            className="mt-1 w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
