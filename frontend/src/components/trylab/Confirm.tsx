/**
 * Confirm dialog TryLab — modal compacto de confirmação para ações
 * destrutivas / irreversíveis.
 *
 * Substitui AlertDialog do shadcn nas páginas migradas.
 */
import { useEffect, type ReactNode } from 'react'

interface ConfirmProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function Confirm({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="tl-confirm-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="tl-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tl-confirm-title"
      >
        <h2 className="tl-confirm-title" id="tl-confirm-title">
          {title}
        </h2>
        {description && <div className="tl-confirm-desc">{description}</div>}
        <div className="tl-confirm-actions">
          <button type="button" className="tl-btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="tl-btn-primary"
            onClick={onConfirm}
            style={
              destructive
                ? {
                    background: 'oklch(0.5 0.18 25)',
                    borderColor: 'oklch(0.55 0.2 25)',
                    color: 'white',
                  }
                : undefined
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
