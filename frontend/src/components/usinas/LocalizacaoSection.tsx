/**
 * Seção "Localização" do detalhe da usina.
 *
 * Fluxo:
 * 1. CEP com máscara `00000-000`. Ao blur (ou click "Buscar"), consulta
 *    ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) e preenche endereço,
 *    bairro, cidade e UF automaticamente.
 * 2. Campos editáveis: endereço, bairro, cidade, UF (select 27 UFs).
 * 3. Latitude/longitude são read-only — preenchidos pelo botão "Atualizar
 *    localização" que aciona `POST /api/usinas/geocode/` com os campos.
 * 4. Ao salvar, se lat/lon estão vazios E há endereço suficiente, faz
 *    geocode automático antes de persistir.
 *
 * O endpoint de geocode usa Nominatim (OpenStreetMap), gratuito, com
 * rate limit de 1 req/s aplicado no backend. CORS direto do frontend
 * para Nominatim funciona, mas centralizamos no backend pra padronizar
 * User-Agent e cache.
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2Icon, MapPinIcon, SearchIcon } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

interface UsinaLocalizacao {
  cep?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

interface LocalizacaoSectionProps {
  usinaId: string | number
  inicial: UsinaLocalizacao
  onSalvo?: () => void
}

interface ViaCepResposta {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

interface GeocodeResposta {
  latitude: number
  longitude: number
  endereco_normalizado: string
}

function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8)
  if (digitos.length <= 5) return digitos
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

function temEnderecoSuficiente(loc: UsinaLocalizacao): boolean {
  const partes = [loc.endereco, loc.cidade, loc.estado]
  return partes.some((p) => (p ?? "").trim().length > 0)
}

export function LocalizacaoSection({ usinaId, inicial, onSalvo }: LocalizacaoSectionProps) {
  const [cep, setCep] = useState(formatarCep(inicial.cep ?? ""))
  const [endereco, setEndereco] = useState(inicial.endereco ?? "")
  const [bairro, setBairro] = useState(inicial.bairro ?? "")
  const [cidade, setCidade] = useState(inicial.cidade ?? "")
  const [estado, setEstado] = useState((inicial.estado ?? "").toUpperCase())
  const [latitude, setLatitude] = useState<string>(
    inicial.latitude !== null && inicial.latitude !== undefined ? String(inicial.latitude) : "",
  )
  const [longitude, setLongitude] = useState<string>(
    inicial.longitude !== null && inicial.longitude !== undefined ? String(inicial.longitude) : "",
  )

  const [buscandoCep, setBuscandoCep] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Re-sincroniza quando o detalhe da usina troca (refetch externo).
  // Padrão "syncing external props into state": após `onSalvo` o pai
  // refetcha e dispara um novo `inicial`; sem isso o form ficaria com os
  // valores antigos. Suprimimos as regras pertinentes do react-hooks plugin.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCep(formatarCep(inicial.cep ?? ""))
    setEndereco(inicial.endereco ?? "")
    setBairro(inicial.bairro ?? "")
    setCidade(inicial.cidade ?? "")
    setEstado((inicial.estado ?? "").toUpperCase())
    setLatitude(
      inicial.latitude !== null && inicial.latitude !== undefined ? String(inicial.latitude) : "",
    )
    setLongitude(
      inicial.longitude !== null && inicial.longitude !== undefined ? String(inicial.longitude) : "",
    )
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(inicial)])

  async function buscarCep() {
    const digitos = cep.replace(/\D/g, "")
    if (digitos.length !== 8) {
      toast.error("CEP deve ter 8 dígitos")
      return
    }
    setBuscandoCep(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const dados: ViaCepResposta = await resp.json()
      if (dados.erro) {
        toast.error("CEP não encontrado")
        return
      }
      if (dados.logradouro) setEndereco(dados.logradouro)
      if (dados.bairro) setBairro(dados.bairro)
      if (dados.localidade) setCidade(dados.localidade)
      if (dados.uf) setEstado(dados.uf.toUpperCase())
      toast.success("Endereço preenchido pelo CEP")
    } catch {
      toast.error("Falha ao consultar ViaCEP")
    } finally {
      setBuscandoCep(false)
    }
  }

  async function atualizarLocalizacao(): Promise<GeocodeResposta | null> {
    setGeocoding(true)
    try {
      const resp = await api.post<GeocodeResposta>("/usinas/geocode/", {
        cep: cep.replace(/\D/g, ""),
        endereco,
        bairro,
        cidade,
        estado,
      })
      setLatitude(String(resp.data.latitude))
      setLongitude(String(resp.data.longitude))
      toast.success("Latitude e longitude atualizadas")
      return resp.data
    } catch (err) {
      // Mensagens distintas para 404 (não encontrado) vs 503 (rede).
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(detail ?? "Falha ao consultar serviço de geocoding")
      return null
    } finally {
      setGeocoding(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    try {
      // Geocode automático: se lat/lon vazios e há endereço, tenta resolver.
      let latFinal = latitude
      let lonFinal = longitude
      if (
        (!latFinal || !lonFinal)
        && temEnderecoSuficiente({ endereco, cidade, estado })
      ) {
        const resultado = await atualizarLocalizacao()
        if (resultado) {
          latFinal = String(resultado.latitude)
          lonFinal = String(resultado.longitude)
        }
      }

      const payload = {
        cep: cep.replace(/\D/g, "")
          ? `${cep.replace(/\D/g, "").slice(0, 5)}-${cep.replace(/\D/g, "").slice(5)}`
          : "",
        endereco,
        bairro,
        cidade,
        estado,
        latitude: latFinal || null,
        longitude: lonFinal || null,
      }
      await api.patch(`/usinas/${usinaId}/`, payload)
      toast.success("Localização salva")
      onSalvo?.()
    } catch {
      toast.error("Falha ao salvar localização")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPinIcon className="size-4" />
          Localização
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* CEP + buscar */}
          <div className="space-y-1.5">
            <Label htmlFor="cep">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="cep"
                value={cep}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                onChange={(e) => setCep(formatarCep(e.target.value))}
                onBlur={() => {
                  const digitos = cep.replace(/\D/g, "")
                  if (digitos.length === 8 && !endereco) {
                    void buscarCep()
                  }
                }}
                disabled={salvando}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void buscarCep()}
                disabled={buscandoCep || cep.replace(/\D/g, "").length !== 8 || salvando}
                aria-label="Buscar endereço pelo CEP"
              >
                {buscandoCep ? <Loader2Icon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
              </Button>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua / Avenida, número"
              disabled={salvando}
            />
          </div>

          {/* Bairro */}
          <div className="space-y-1.5">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              disabled={salvando}
            />
          </div>

          {/* Cidade */}
          <div className="space-y-1.5">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
              disabled={salvando}
            />
          </div>

          {/* UF */}
          <div className="space-y-1.5">
            <Label htmlFor="estado">UF</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v)}
              disabled={salvando}
            >
              <SelectTrigger id="estado">
                <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Latitude / Longitude (read-only) */}
          <div className="space-y-1.5">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              value={latitude}
              readOnly
              placeholder="—"
              className="bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              value={longitude}
              readOnly
              placeholder="—"
              className="bg-muted"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Latitude/longitude são usadas pelo cálculo de sunrise/sunset (regra
          <span className="font-mono"> sem_geracao_horario_solar</span>). Sem
          coordenadas, o sistema usa a janela fixa configurada na empresa.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => void atualizarLocalizacao()}
            disabled={geocoding || salvando}
          >
            {geocoding ? (
              <>
                <Loader2Icon className="size-4 animate-spin mr-2" />
                Atualizando...
              </>
            ) : (
              <>
                <MapPinIcon className="size-4 mr-2" />
                Atualizar localização
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
          >
            {salvando ? (
              <>
                <Loader2Icon className="size-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
