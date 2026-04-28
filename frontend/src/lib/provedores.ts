export const PROVEDOR_LABELS: Record<string, string> = {
  solis: 'Solis Cloud',
  hoymiles: 'Hoymiles S-Cloud',
  fusionsolar: 'Huawei FusionSolar',
  auxsol: 'AuxSol Cloud',
  solarman: 'Solarman Pro',
  foxess: 'FoxESS Cloud',
}

export function rotularProvedor(tipo: string | null | undefined): string {
  if (!tipo) return '—'
  return PROVEDOR_LABELS[tipo] || tipo
}
