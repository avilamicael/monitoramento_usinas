import AlertasPage from "@/pages/alertas/AlertasPage";

/**
 * Listagem de alertas restrita a usinas com monitoramento ativo (premium).
 * Reaproveita integralmente `AlertasPage`, fixando a flag `premium`.
 */
export default function AlertasPremiumPage() {
  return <AlertasPage premium titulo="Alertas Premium" />;
}
