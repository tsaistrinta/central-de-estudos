import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { mensagemDeErro } from '@/api/auth'

export function Cabecalho({ titulo, descricao, acoes, migalha }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; migalha?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {migalha && <div className="mb-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">{migalha}</div>}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-[13.5px] text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function Cartao({ titulo, acao, children, className }: { titulo?: ReactNode; acao?: { to: string; label: string } | ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-border bg-card', className)}>
      {titulo && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          {acao && typeof acao === 'object' && 'to' in (acao as object) ? (
            <Link to={(acao as { to: string }).to} className="text-[13px] text-primary hover:underline">
              {(acao as { label: string }).label}
            </Link>
          ) : (
            (acao as ReactNode)
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="px-4 pt-1 pb-5 text-sm text-muted-foreground">
      <p>{children}</p>
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}

export function Esqueleto({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 px-4 pb-4', className)} aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

export function ErroCarregar({ erro, onTentar }: { erro: unknown; onTentar: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
      {mensagemDeErro(erro)}{' '}
      <button className="font-semibold underline" onClick={onTentar}>
        Tentar de novo
      </button>
    </div>
  )
}

export function PontoMateria({ cor, className }: { cor: string; className?: string }) {
  return <i className={cn('inline-block size-2 shrink-0 rounded-[3px]', className)} style={{ background: cor }} />
}
