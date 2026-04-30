import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/useAuth'
import { extrairErroUsuario } from '@/hooks/use-usuarios'
import type { PapelUsuario, Usuario, UsuarioWrite } from '@/types/usuarios'

const PAPEL_LABELS: Record<PapelUsuario, string> = {
  superadmin: 'Superadmin (acesso total + multi-empresa)',
  administrador: 'Administrador (gestão da empresa)',
  operacional: 'Operacional (apenas leitura)',
}

interface UsuarioFormDialogProps {
  usuario: Usuario | null
  open: boolean
  onClose: () => void
  onSubmit: (payload: UsuarioWrite | Partial<UsuarioWrite>, id: number | null) => Promise<void>
}

export function UsuarioFormDialog({
  usuario,
  open,
  onClose,
  onSubmit,
}: UsuarioFormDialogProps) {
  const isEditing = usuario !== null
  const { user: usuarioAtual } = useAuth()
  const podeAtribuirSuperadmin = usuarioAtual?.papel === 'superadmin'

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [papel, setPapel] = useState<PapelUsuario>('operacional')
  const [isActive, setIsActive] = useState(true)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (usuario) {
      setUsername(usuario.username)
      setEmail(usuario.email)
      setFirstName(usuario.first_name)
      setLastName(usuario.last_name)
      setPapel(usuario.papel ?? 'operacional')
      setIsActive(usuario.is_active)
      setPassword('')
    } else {
      setUsername('')
      setEmail('')
      setFirstName('')
      setLastName('')
      setPapel('operacional')
      setIsActive(true)
      setPassword('')
    }
  }, [usuario, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) {
      toast.error('Nome de usuário é obrigatório.')
      return
    }
    if (!firstName.trim()) {
      toast.error('Nome é obrigatório.')
      return
    }
    if (!isEditing && !password) {
      toast.error('Senha é obrigatória para novo usuário.')
      return
    }
    if (password && password.length < 6) {
      toast.error('Senha precisa ter pelo menos 6 caracteres.')
      return
    }

    const payload: UsuarioWrite = {
      username: username.trim(),
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      is_staff: papel === 'administrador' || papel === 'superadmin',
      is_active: isActive,
      papel,
    }
    if (password) payload.password = password

    setSaving(true)
    try {
      await onSubmit(payload, usuario?.id ?? null)
      toast.success(isEditing ? 'Usuário atualizado.' : 'Usuário criado.')
      onClose()
    } catch (err) {
      toast.error(extrairErroUsuario(err, 'Erro ao salvar usuário.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar — ${usuario?.username}` : 'Novo Usuário'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Deixe a senha em branco para manter a atual.' : 'Preencha os dados do novo usuário.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Nome de usuário (login)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Nome *</Label>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Sobrenome</Label>
              <Input
                id="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{isEditing ? 'Nova senha (opcional)' : 'Senha'}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? 'Em branco = manter atual' : 'Mínimo 6 caracteres'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="papel">Papel</Label>
            <Select
              value={papel}
              onValueChange={(v) => setPapel(v as PapelUsuario)}
            >
              <SelectTrigger id="papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operacional">{PAPEL_LABELS.operacional}</SelectItem>
                <SelectItem value="administrador">{PAPEL_LABELS.administrador}</SelectItem>
                {(podeAtribuirSuperadmin || papel === 'superadmin') && (
                  <SelectItem value="superadmin">{PAPEL_LABELS.superadmin}</SelectItem>
                )}
              </SelectContent>
            </Select>
            {!podeAtribuirSuperadmin && papel === 'superadmin' && (
              <p className="text-xs text-muted-foreground">
                Apenas superadmins podem alterar este papel.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4"
            />
            Usuário ativo
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
