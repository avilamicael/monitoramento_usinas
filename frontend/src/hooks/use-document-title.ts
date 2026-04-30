import { useEffect } from "react"

const APP_NAME = "Monitoramento Solar"

/**
 * Sincroniza o `<title>` do navegador com o nome da página.
 * Formato: "<página> · Monitoramento Solar". Sem `titulo`, mantém só o app name.
 */
export function useDocumentTitle(titulo?: string | null): void {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${APP_NAME}` : APP_NAME
  }, [titulo])
}
