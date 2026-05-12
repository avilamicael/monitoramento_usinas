/**
 * Form de localização da usina em estilo TryLab.
 * Substitui o LocalizacaoSection (shadcn) dentro do tl-card da
 * UsinaDetalhePage quando o usuário entra em modo de edição.
 *
 * Mantém a mesma lógica do componente antigo:
 *  - CEP busca ViaCEP no blur ou no click do botão.
 *  - Botão "Atualizar localização" → POST /usinas/geocode/ (Nominatim).
 *  - Salvar → PATCH /usinas/<id>/. Se lat/lon vazios e há endereço,
 *    faz geocode automático antes de persistir.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, MapPinIcon, SearchIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Select } from '@/components/trylab/Select'

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
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
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 5) return digitos
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

function temEnderecoSuficiente(loc: UsinaLocalizacao): boolean {
  const partes = [loc.endereco, loc.cidade, loc.estado]
  return partes.some((p) => (p ?? '').trim().length > 0)
}

interface LocalizacaoFormTlProps {
  usinaId: string | number
  inicial: UsinaLocalizacao
  onSalvo: () => void
}

export function LocalizacaoFormTl({ usinaId, inicial, onSalvo }: LocalizacaoFormTlProps) {
  const [cep, setCep] = useState(formatarCep(inicial.cep ?? ''))
  const [endereco, setEndereco] = useState(inicial.endereco ?? '')
  const [bairro, setBairro] = useState(inicial.bairro ?? '')
  const [cidade, setCidade] = useState(inicial.cidade ?? '')
  const [estado, setEstado] = useState((inicial.estado ?? '').toUpperCase())
  const [latitude, setLatitude] = useState<string>(
    inicial.latitude !== null && inicial.latitude !== undefined ? String(inicial.latitude) : '',
  )
  const [longitude, setLongitude] = useState<string>(
    inicial.longitude !== null && inicial.longitude !== undefined ? String(inicial.longitude) : '',
  )
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCep(formatarCep(inicial.cep ?? ''))
    setEndereco(inicial.endereco ?? '')
    setBairro(inicial.bairro ?? '')
    setCidade(inicial.cidade ?? '')
    setEstado((inicial.estado ?? '').toUpperCase())
    setLatitude(
      inicial.latitude !== null && inicial.latitude !== undefined ? String(inicial.latitude) : '',
    )
    setLongitude(
      inicial.longitude !== null && inicial.longitude !== undefined ? String(inicial.longitude) : '',
    )
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(inicial)])

  async function buscarCep() {
    const digitos = cep.replace(/\D/g, '')
    if (digitos.length !== 8) {
      toast.error('CEP deve ter 8 dígitos')
      return
    }
    setBuscandoCep(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const dados: ViaCepResposta = await resp.json()
      if (dados.erro) {
        toast.error('CEP não encontrado')
        return
      }
      if (dados.logradouro) setEndereco(dados.logradouro)
      if (dados.bairro) setBairro(dados.bairro)
      if (dados.localidade) setCidade(dados.localidade)
      if (dados.uf) setEstado(dados.uf.toUpperCase())
      toast.success('Endereço preenchido pelo CEP')
    } catch {
      toast.error('Falha ao consultar ViaCEP')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function atualizarLocalizacao(): Promise<GeocodeResposta | null> {
    setGeocoding(true)
    try {
      const resp = await api.post<GeocodeResposta>('/usinas/geocode/', {
        cep: cep.replace(/\D/g, ''),
        endereco,
        bairro,
        cidade,
        estado,
      })
      setLatitude(String(resp.data.latitude))
      setLongitude(String(resp.data.longitude))
      toast.success('Latitude e longitude atualizadas')
      return resp.data
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(detail ?? 'Falha ao consultar serviço de geocoding')
      return null
    } finally {
      setGeocoding(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    try {
      let latFinal = latitude
      let lonFinal = longitude
      if (
        (!latFinal || !lonFinal) &&
        temEnderecoSuficiente({ endereco, cidade, estado })
      ) {
        const resultado = await atualizarLocalizacao()
        if (resultado) {
          latFinal = String(resultado.latitude)
          lonFinal = String(resultado.longitude)
        }
      }
      const digitos = cep.replace(/\D/g, '')
      const payload = {
        cep: digitos ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : '',
        endereco,
        bairro,
        cidade,
        estado,
        latitude: latFinal || null,
        longitude: lonFinal || null,
      }
      await api.patch(`/usinas/${usinaId}/`, payload)
      toast.success('Localização salva')
      onSalvo()
    } catch {
      toast.error('Falha ao salvar localização')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="tl-form-grid">
        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-cep">
            CEP
          </label>
          <div className="tl-field-row">
            <input
              id="loc-cep"
              className="tl-input"
              value={cep}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              onChange={(e) => setCep(formatarCep(e.target.value))}
              onBlur={() => {
                const digitos = cep.replace(/\D/g, '')
                if (digitos.length === 8 && !endereco) void buscarCep()
              }}
              disabled={salvando}
            />
            <button
              type="button"
              className="tl-icon-btn"
              onClick={() => void buscarCep()}
              disabled={buscandoCep || cep.replace(/\D/g, '').length !== 8 || salvando}
              aria-label="Buscar endereço pelo CEP"
              title="Buscar"
            >
              {buscandoCep ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SearchIcon className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-endereco">
            Endereço
          </label>
          <input
            id="loc-endereco"
            className="tl-input"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua / Avenida, número"
            disabled={salvando}
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-bairro">
            Bairro
          </label>
          <input
            id="loc-bairro"
            className="tl-input"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            placeholder="Bairro"
            disabled={salvando}
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-cidade">
            Cidade
          </label>
          <input
            id="loc-cidade"
            className="tl-input"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Cidade"
            disabled={salvando}
          />
        </div>

        <div className="tl-field">
          <span className="tl-field-label">UF</span>
          <Select
            value={estado}
            onChange={setEstado}
            disabled={salvando}
            placeholder="—"
            options={[
              ['', '—'],
              ...UFS.map((uf) => [uf, uf] as [string, string]),
            ]}
            ariaLabel="UF"
          />
        </div>

        <div />

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-lat">
            Latitude
          </label>
          <input
            id="loc-lat"
            className="tl-input"
            value={latitude}
            readOnly
            placeholder="—"
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="loc-lon">
            Longitude
          </label>
          <input
            id="loc-lon"
            className="tl-input"
            value={longitude}
            readOnly
            placeholder="—"
          />
        </div>
      </div>

      <p className="tl-fine-text">
        Latitude/longitude são usadas pelo cálculo de sunrise/sunset (regra
        <code> sem_geracao_horario_solar</code>). Sem coordenadas, o sistema
        usa a janela fixa configurada na empresa.
      </p>

      <div className="tl-form-actions">
        <button
          type="button"
          className="tl-btn ghost"
          onClick={() => void atualizarLocalizacao()}
          disabled={geocoding || salvando}
        >
          {geocoding ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <MapPinIcon className="size-3.5" />
          )}
          {geocoding ? 'Atualizando…' : 'Atualizar localização'}
        </button>
        <button
          type="button"
          className="tl-btn-primary"
          onClick={() => void salvar()}
          disabled={salvando}
        >
          {salvando ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              Salvando…
            </>
          ) : (
            'Salvar'
          )}
        </button>
      </div>
    </div>
  )
}
