/**
 * Switch (toggle) TryLab — input[type=checkbox] estilizado.
 * Aceita um label opcional.
 */
import type { ReactNode } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id?: string
  ariaLabel?: string
  label?: ReactNode
}

export function Switch({
  checked,
  onChange,
  disabled,
  id,
  ariaLabel,
  label,
}: SwitchProps) {
  const input = (
    <input
      type="checkbox"
      role="switch"
      id={id}
      className="tl-switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-checked={checked}
    />
  )
  if (!label) return input
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12.5,
        color: 'var(--tl-fg)',
      }}
    >
      {input}
      {label}
    </label>
  )
}
