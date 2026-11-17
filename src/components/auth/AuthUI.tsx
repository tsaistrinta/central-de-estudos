import { useState, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Eye, EyeOff, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { forcaDaSenha, SENHA_MINIMA } from '@/lib/senha'

/** Código de 6 dígitos em caixas separadas; aceita colar o código inteiro. */
export function CampoCodigo({ valor, onChange, autoFocus }: { valor: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const digitos = Array.from({ length: 6 }, (_, i) => valor[i] ?? '')
  function aoDigitar(i: number, texto: string, alvo: HTMLInputElement) {
    const limpo = texto.replace(/\D/g, '')
    if (limpo.length > 1) {
      onChange(limpo.slice(0, 6))
      return
    }
    const novo = digitos.slice()
    novo[i] = limpo
    onChange(novo.join('').slice(0, 6))
    if (limpo && alvo.nextElementSibling instanceof HTMLInputElement) alvo.nextElementSibling.focus()
  }
  return (
    <div className="flex justify-between gap-2">
      {digitos.map((d, i) => (
        <input
          key={i}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1}`}
          autoFocus={autoFocus && i === 0}
          value={d}
          maxLength={6}
          onChange={(e) => aoDigitar(i, e.target.value, e.target)}
          onKeyDown={(e) => {
            const alvo = e.currentTarget
            if (e.key === 'Backspace' && !d && alvo.previousElementSibling instanceof HTMLInputElement) alvo.previousElementSibling.focus()
          }}
          className="h-12 w-full min-w-0 rounded-md border border-border bg-card text-center font-mono text-xl font-semibold outline-none focus:border-primary focus:ring-[3px] focus:ring-accent"
        />
      ))}
    </div>
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
