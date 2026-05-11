import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { EmpresaInput, EmpresaSuperadmin } from '@/features/superadmin/types'
import { Switch } from '@/components/trylab/Switch'

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/i, 'Slug aceita apenas letras, números e hifens.')
    .max(100)
    .optional()
    .or(z.literal('')),
  cnpj: z.string().trim().max(20).optional().or(z.literal('')),
  cidade: z.string().trim().max(120).optional().or(z.literal('')),
  uf: z
    .string()
    .trim()
    .max(2)
    .regex(/^[A-Za-z]{0,2}$/, 'UF aceita até 2 letras.')
    .optional()
    .or(z.literal('')),
  is_active: z.boolean(),
})

type EmpresaFormValues = z.infer<typeof schema>

interface Props {
  inicial?: EmpresaSuperadmin
  onSubmit: (dados: EmpresaInput) => Promise<void>
  onCancel: () => void
  salvando: boolean
}

export function EmpresaForm({ inicial, onSubmit, onCancel, salvando }: Props) {
  const form = useForm<EmpresaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: inicial?.nome ?? '',
      slug: inicial?.slug ?? '',
      cnpj: inicial?.cnpj ?? '',
      cidade: inicial?.cidade ?? '',
      uf: inicial?.uf ?? '',
      is_active: inicial?.is_active ?? true,
    },
  })

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      slug: values.slug || undefined,
      cnpj: values.cnpj || '',
      cidade: values.cidade || '',
      uf: values.uf ? values.uf.toUpperCase() : '',
      is_active: values.is_active,
    })
  })

  const errors = form.formState.errors

  return (
    <form onSubmit={submit} style={{ maxWidth: 640 }}>
      <div className="tl-form-grid">
        <div className="tl-field" style={{ gridColumn: '1 / -1' }}>
          <label className="tl-field-label" htmlFor="emp-nome">
            Nome *
          </label>
          <input
            id="emp-nome"
            className={'tl-input' + (errors.nome ? ' invalid' : '')}
            autoComplete="off"
            disabled={salvando}
            {...form.register('nome')}
          />
          {errors.nome && (
            <p style={{ fontSize: 11, color: 'var(--tl-crit)', margin: 0 }}>
              {errors.nome.message}
            </p>
          )}
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="emp-slug">
            Slug
          </label>
          <input
            id="emp-slug"
            className={'tl-input' + (errors.slug ? ' invalid' : '')}
            placeholder="auto a partir do nome"
            disabled={!!inicial || salvando}
            {...form.register('slug')}
          />
          <p className="tl-fine-text" style={{ margin: 0 }}>
            {inicial ? 'Slug é imutável após criação.' : 'Deixe em branco para gerar.'}
          </p>
          {errors.slug && (
            <p style={{ fontSize: 11, color: 'var(--tl-crit)', margin: 0 }}>
              {errors.slug.message}
            </p>
          )}
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="emp-cnpj">
            CNPJ
          </label>
          <input
            id="emp-cnpj"
            className="tl-input"
            placeholder="00.000.000/0001-00"
            disabled={salvando}
            {...form.register('cnpj')}
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="emp-cidade">
            Cidade
          </label>
          <input
            id="emp-cidade"
            className="tl-input"
            disabled={salvando}
            {...form.register('cidade')}
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="emp-uf">
            UF
          </label>
          <input
            id="emp-uf"
            className={'tl-input' + (errors.uf ? ' invalid' : '')}
            maxLength={2}
            style={{ textTransform: 'uppercase' }}
            disabled={salvando}
            {...form.register('uf')}
          />
          {errors.uf && (
            <p style={{ fontSize: 11, color: 'var(--tl-crit)', margin: 0 }}>
              {errors.uf.message}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Switch
          checked={form.watch('is_active')}
          onChange={(v) =>
            form.setValue('is_active', v, { shouldDirty: true, shouldTouch: true })
          }
          disabled={salvando}
          label="Empresa ativa"
        />
      </div>

      <div className="tl-form-actions" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="tl-btn ghost"
          onClick={onCancel}
          disabled={salvando}
        >
          Cancelar
        </button>
        <button type="submit" className="tl-btn-primary" disabled={salvando}>
          {salvando ? 'Salvando…' : inicial ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}
