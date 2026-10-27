import { useState, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { forcaDaSenha, SENHA_MINIMA } from '@/lib/senha'
import type { ProvedorSocial } from '@/api/auth'

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function LogoMicrosoft() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

const provedores: Record<ProvedorSocial, { nome: string; logo: ReactNode }> = {
  google: { nome: 'Google', logo: <LogoGoogle /> },
  azure: { nome: 'Microsoft', logo: <LogoMicrosoft /> },
}

export function BotaoSocial({
  provedor,
  verbo,
  ...props
}: { provedor: ProvedorSocial; verbo: string } & ComponentProps<'button'>) {
  const { nome, logo } = provedores[provedor]
  return (
    <Button variant="outline" className="h-10 w-full font-semibold" {...props}>
      {logo} {verbo} com {nome}
    </Button>
  )
}

export function Divisor({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function CampoSenha(props: ComponentProps<'input'>) {
  const [visivel, setVisivel] = useState(false)
  return (
    <Input
      icone={<Lock />}
      type={visivel ? 'text' : 'password'}
      sufixo={
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visivel ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
        </button>
      }
      {...props}
    />
  )
}

const rotulosForca = ['', 'Senha fraca', 'Senha média', 'Senha boa', 'Senha forte']
const coresForca = ['', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success']

export function MedidorSenha({ senha }: { senha: string }) {
  const forca = forcaDaSenha(senha)
  if (!senha) return null
  return (
    <div className="mt-2 flex items-center gap-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1 w-7 rounded-full', i <= forca ? coresForca[forca] : 'bg-muted')} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{rotulosForca[forca]} · mínimo de {SENHA_MINIMA} caracteres</span>
    </div>
  )
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'sucesso'; children: ReactNode }) {
  const Icone = tipo === 'erro' ? CircleAlert : CircleCheck
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 rounded-md px-3.5 py-3 text-[13px] leading-snug',
        tipo === 'erro' ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-success',
      )}
    >
      <Icone size={16} strokeWidth={1.75} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/** Mensagem curta abaixo de um campo (ex.: credencial inválida). */
export function ErroDeCampo({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 text-[13px] text-destructive">
      {children}
    </p>
  )
}
