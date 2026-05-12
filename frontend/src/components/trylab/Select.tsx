/**
 * Select TryLab — combobox customizado em substituição ao <select> nativo.
 * Adaptado de claude-design/components-page.jsx::CustomSelect.
 *
 * Recursos:
 *  - Navegação por teclado: ↑/↓ move, Enter seleciona, Esc fecha.
 *  - Click fora fecha.
 *  - Marca a opção ativa com check.
 *  - Suporta um label opcional (placeholder quando value vazio).
 *  - Acessibilidade: role="listbox"/"option", aria-selected.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type SelectOption<V extends string = string> = readonly [
  value: V,
  label: ReactNode,
]

interface SelectProps<V extends string = string> {
  value: V
  onChange: (value: V) => void
  options: ReadonlyArray<SelectOption<V>>
  placeholder?: string
  disabled?: boolean
  /** Largura mínima do trigger, padrão 130px. */
  minWidth?: number | string
  /** Alinha o menu à direita do trigger (útil quando o trigger está perto da borda). */
  alignMenuRight?: boolean
  /** id para forwarding em <label htmlFor>. */
  id?: string
  /** aria-label quando não houver `<label>` externo. */
  ariaLabel?: string
}

export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  minWidth,
  alignMenuRight,
  id,
  ariaLabel,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const ref = useRef<HTMLDivElement | null>(null)
  const current = options.find(([v]) => v === value)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIdx((i) => Math.min(options.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        e.preventDefault()
        onChange(options[focusIdx][0])
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, focusIdx, options, onChange])

  function toggle() {
    if (disabled) return
    setOpen((o) => !o)
    setFocusIdx(options.findIndex(([v]) => v === value))
  }

  return (
    <div className={'tl-cs' + (open ? ' open' : '')} ref={ref}>
      <button
        type="button"
        id={id}
        className="tl-cs-trigger"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={minWidth !== undefined ? { minWidth } : undefined}
      >
        <span className={'tl-cs-value' + (current ? '' : ' placeholder')}>
          {current ? current[1] : placeholder || 'Selecionar'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tl-cs-chev"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className={'tl-cs-menu' + (alignMenuRight ? ' align-right' : '')}
          role="listbox"
        >
          {options.map(([v, l], i) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              className={
                'tl-cs-opt' +
                (v === value ? ' selected' : '') +
                (i === focusIdx ? ' focused' : '')
              }
              onMouseEnter={() => setFocusIdx(i)}
              onClick={() => {
                onChange(v)
                setOpen(false)
              }}
            >
              <span>{l}</span>
              {v === value && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
