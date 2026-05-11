/**
 * PanelDiagram — telhado isométrico 3D com microinversores e suas strings.
 * Adaptado de claude-design/usina-detail.jsx::PanelDiagram para consumir
 * o snapshot real de cada inversor da usina.
 *
 * Mapeamento:
 *   - cada inversor da usina → um "grupo" (microinversor) na grid.
 *   - cada string MPPT do `strings_mppt` → um "painel" dentro do grupo.
 *   - estado:
 *       inversor offline ......... painel offline
 *       string com 0 W / sem dado  painel warning (se inversor online)
 *       senão .................... painel online
 *
 * O usuário pode hover em cada painel pra ver tensão CC, corrente CC e
 * potência. Click no rótulo do grupo abre o `InverterPanel` (drawer).
 */
import { useRef, useState, type MouseEvent } from 'react'
import type { InversorResumo } from '@/types/usinas'

interface PanelInfo {
  key: string
  inversorIdx: number
  stringIdx: number
  state: 'online' | 'warning' | 'offline'
  voltage: number | null
  current: number | null
  power: number
}

interface Tip extends PanelInfo {
  x: number
  y: number
  below: boolean
  sn: string
  modelo: string
  // Fallback inversor-level — usado quando o provedor não expõe
  // tensão/corrente por string (Solarman, Solis, AuxSol e FusionSolar
  // reportam só a potência da string; só Hoymiles traz V/I por string).
  invTensaoDc: number | null
  invCorrenteDc: number | null
}

interface PanelDiagramProps {
  inversores: InversorResumo[]
  capacidadeKwp: number | null | undefined
  onSelectInverter: (idx: number) => void
}

/**
 * Normaliza strings_mppt para uma lista uniforme de painéis.
 * Provedores expõem em formatos diferentes:
 *   Hoymiles: {1: {tensao: 19.8, corrente: 0.01}}
 *   Solis/AuxSol/Solarman: {string1: 16.94}  // potência W
 *   FusionSolar: {mppt_1_cap: 2696.49}       // energia acumulada kWh
 */
function extrairStrings(
  mppt: Record<string, unknown> | null | undefined,
): { idx: number; voltage: number | null; current: number | null; power: number }[] {
  if (!mppt) return []
  const lista: { idx: number; voltage: number | null; current: number | null; power: number }[] = []
  let counter = 0

  for (const [chave, val] of Object.entries(mppt)) {
    if (val === null || val === undefined) continue
    counter++

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, number | null | undefined>
      const v = typeof obj.tensao === 'number' ? obj.tensao : null
      const a = typeof obj.corrente === 'number' ? obj.corrente : null
      const w = v && a ? v * a : 0
      lista.push({ idx: counter, voltage: v, current: a, power: w })
      continue
    }

    const num = Number(val)
    if (Number.isNaN(num)) continue

    // FusionSolar reporta energia acumulada — não temos potência instantânea
    if (chave.toLowerCase().includes('cap')) {
      lista.push({ idx: counter, voltage: null, current: null, power: num > 0 ? 1 : 0 })
      continue
    }

    lista.push({ idx: counter, voltage: null, current: null, power: num })
  }

  return lista
}

function statusInversor(inv: InversorResumo): 'online' | 'warning' | 'offline' {
  const e = inv.ultimo_snapshot?.estado
  if (!e || e === 'offline') return 'offline'
  if (e === 'aviso') return 'warning'
  return 'online'
}

export function PanelDiagram({ inversores, capacidadeKwp, onSelectInverter }: PanelDiagramProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)

  const totalPaineis = inversores.reduce((acc, inv) => {
    return acc + extrairStrings(inv.ultimo_snapshot?.strings_mppt).length
  }, 0)

  function onPanelEnter(e: MouseEvent<HTMLDivElement>, data: PanelInfo, inv: InversorResumo) {
    const scene = sceneRef.current
    if (!scene) return
    const sr = scene.getBoundingClientRect()
    const pr = e.currentTarget.getBoundingClientRect()
    const x = pr.left + pr.width / 2 - sr.left
    const yTop = pr.top - sr.top
    const yBot = pr.bottom - sr.top
    const flipBelow = yTop < 180
    const snap = inv.ultimo_snapshot
    setTip({
      ...data,
      x,
      y: flipBelow ? yBot : yTop,
      below: flipBelow,
      sn: inv.numero_serie,
      modelo: inv.modelo,
      invTensaoDc: snap?.tensao_dc_v ?? null,
      invCorrenteDc: snap?.corrente_dc_a ?? null,
    })
    setHoverKey(data.key)
  }

  function onPanelLeave() {
    setTip(null)
    setHoverKey(null)
  }

  // Quantas colunas de grupos: cap a 4 (igual ref usa 3). Se 1 inversor, 1 col.
  const cols = Math.min(Math.max(inversores.length, 1), 4)

  return (
    <div className="tl-card tl-3d-card">
      <div className="tl-card-head">
        <div>
          <div className="tl-card-title">
            <span>Layout dos painéis</span>
          </div>
          <div className="tl-card-sub">
            {inversores.length} inversor{inversores.length === 1 ? '' : 'es'} · {totalPaineis}{' '}
            painel{totalPaineis === 1 ? '' : 'eis'}
            {capacidadeKwp ? ` · ${capacidadeKwp} kWp` : ''}
          </div>
        </div>
        <div className="tl-legend">
          <span>
            <i className="dot ok" /> ativo
          </span>
          <span>
            <i className="dot warn" /> atenção
          </span>
          <span>
            <i className="dot off" /> offline
          </span>
        </div>
      </div>
      <div className="tl-3d-scene" ref={sceneRef}>
        <div className="tl-roof" style={{ '--tl-roof-cols': cols } as React.CSSProperties}>
          {inversores.map((inv, ii) => {
            const invStatus = statusInversor(inv)
            const strings = extrairStrings(inv.ultimo_snapshot?.strings_mppt)
            const snap = inv.ultimo_snapshot

            return (
              <div
                key={inv.id}
                className="tl-group"
                onClick={() => onSelectInverter(ii)}
                role="button"
                tabIndex={0}
              >
                <div className="tl-group-label">
                  <span className="tl-dot" data-status={invStatus} aria-hidden />
                  <span>{inv.numero_serie.slice(-4)}</span>
                  <em>{snap?.pac_kw ? snap.pac_kw.toFixed(2) : '0.00'} kW</em>
                </div>
                <div className="tl-panels">
                  {strings.length === 0 ? (
                    // Sem dados de strings — mostrar 4 painéis offline pra ter forma
                    Array.from({ length: 4 }).map((_, si) => (
                      <div key={si} className="tl-panel" data-state="offline">
                        <span className="tl-cells">
                          {Array.from({ length: 6 }).map((_, c) => (
                            <i key={c} />
                          ))}
                        </span>
                      </div>
                    ))
                  ) : (
                    strings.map((s) => {
                      let panelState: 'online' | 'warning' | 'offline'
                      if (invStatus === 'offline') panelState = 'offline'
                      else if (s.power <= 0) panelState = 'warning'
                      else panelState = 'online'

                      const key = `${ii}-${s.idx}`
                      const data: PanelInfo = {
                        key,
                        inversorIdx: ii,
                        stringIdx: s.idx,
                        state: panelState,
                        voltage: s.voltage,
                        current: s.current,
                        power: s.power,
                      }
                      return (
                        <div
                          key={key}
                          className={'tl-panel' + (hoverKey === key ? ' hov' : '')}
                          data-state={panelState}
                          onMouseEnter={(e) => onPanelEnter(e, data, inv)}
                          onMouseLeave={onPanelLeave}
                        >
                          <span className="tl-cells">
                            {Array.from({ length: 6 }).map((_, c) => (
                              <i key={c} />
                            ))}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="tl-sun-hint" aria-hidden />
        {tip && (
          <div className={'tl-tip2' + (tip.below ? ' below' : '')} style={{ left: tip.x, top: tip.y }}>
            <div className="tl-tip2-head">
              <span className="tl-tip2-dot" data-state={tip.state} />
              <span className="tl-tip2-title">String {tip.stringIdx}</span>
              <span className="tl-tip2-state">
                {tip.state === 'online' ? 'OK' : tip.state === 'warning' ? 'Atenção' : 'Offline'}
              </span>
            </div>
            <div className="tl-tip2-grid">
              <div className="tl-tip2-cell">
                <span>Potência</span>
                <strong>
                  {tip.power > 0 ? tip.power.toFixed(0) : '—'}
                  <em>W</em>
                </strong>
              </div>
              <div className="tl-tip2-cell">
                <span>
                  Tensão CC
                  {tip.voltage === null && tip.invTensaoDc !== null && (
                    <em style={{ fontStyle: 'normal', marginLeft: 3, opacity: 0.7 }}> · inv</em>
                  )}
                </span>
                <strong>
                  {tip.voltage !== null
                    ? tip.voltage.toFixed(1)
                    : tip.invTensaoDc !== null
                      ? tip.invTensaoDc.toFixed(1)
                      : '—'}
                  <em>V</em>
                </strong>
              </div>
              <div className="tl-tip2-cell">
                <span>
                  Corrente
                  {tip.current === null && tip.invCorrenteDc !== null && (
                    <em style={{ fontStyle: 'normal', marginLeft: 3, opacity: 0.7 }}> · inv</em>
                  )}
                </span>
                <strong>
                  {tip.current !== null
                    ? tip.current.toFixed(2)
                    : tip.invCorrenteDc !== null
                      ? tip.invCorrenteDc.toFixed(2)
                      : '—'}
                  <em>A</em>
                </strong>
              </div>
              <div className="tl-tip2-cell">
                <span>Estado</span>
                <strong>
                  {tip.state === 'online' ? 'Gerando' : tip.state === 'warning' ? 'Zero' : 'Off'}
                </strong>
              </div>
            </div>
            <div className="tl-tip2-foot">
              <span>{tip.modelo || 'Inversor'}</span>
              <strong className="mono">{tip.sn.slice(-8)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
