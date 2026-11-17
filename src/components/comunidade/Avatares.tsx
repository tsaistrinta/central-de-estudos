import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { corDaPessoa, inicial, ROTULO_PAPEL } from '@/lib/pessoas'
import type { Pessoa } from '@/types'

export function Avatar({ pessoa, id, tamanho = 28, className }: { pessoa?: Pessoa; id: string; tamanho?: number; className?: string }) {
  return (
    <span
      title={pessoa?.nome}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.42), background: pessoa?.papel === 'professor' ? 'var(--foreground)' : corDaPessoa(id) }}
    >
      {inicial(pessoa?.nome)}
    </span>
  )
}

/** Avatares empilhados (até `max`) + "+N". */
export function Pilha({ ids, pessoas, max = 5, tamanho = 24 }: { ids: string[]; pessoas: Map<string, Pessoa>; max?: number; tamanho?: number }) {
  return (
    <span className="flex items-center">
      {ids.slice(0, max).map((id, i) => (
        <Avatar key={id} id={id} pessoa={pessoas.get(id)} tamanho={tamanho} className={cn('border-2 border-card', i > 0 && '-ml-2')} />
      ))}
      {ids.length > max && <span className="ml-1.5 text-xs text-muted-foreground">+{ids.length - max}</span>}
    </span>
  )
}

export type Grupo = { rotulo: string; ids: string[]; classe: string }

/** Lista de quem votou ou reagiu, como curtidas. Abre num popover ao clicar. */
export function ListaDePessoas({ titulo, grupos, pessoas, gatilho, legenda }: { titulo: string; grupos: Grupo[]; pessoas: Map<string, Pessoa>; gatilho: React.ReactNode; legenda?: string }) {
  const [aberto, setAberto] = useState(false)
  const [filtro, setFiltro] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', fechar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', fechar)
    }
  }, [aberto])
  const total = grupos.reduce((n, g) => n + g.ids.length, 0)
  const visiveis = filtro === null ? grupos : [grupos[filtro]]
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((a) => !a)} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
        {gatilho}
      </button>
      {aberto && (
        <div className="absolute right-0 bottom-full z-40 mb-2 w-[300px] rounded-xl border border-border bg-popover shadow-[var(--sombra-pop)]">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <b className="text-sm">
              {titulo} · {total}
            </b>
            <button onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
              <X size={15} />
            </button>
          </div>
          <div className="flex gap-1.5 px-3.5 pt-2.5">
            <button onClick={() => setFiltro(null)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', filtro === null ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
              Todos
            </button>
            {grupos.map((g, i) => (
              <button key={g.rotulo} onClick={() => setFiltro(i)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', filtro === i ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                {g.rotulo} {g.ids.length}
              </button>
            ))}
          </div>
          <ul className="max-h-72 overflow-y-auto px-3.5 py-1.5">
            {visiveis.flatMap((g) =>
              g.ids.map((id) => {
                const p = pessoas.get(id)
                return (
                  <li key={g.rotulo + id} className="flex items-center gap-2.5 border-b border-muted py-2 last:border-0">
                    <Avatar id={id} pessoa={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{p?.nome ?? 'Alguém da turma'}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{ROTULO_PAPEL[p?.papel ?? 'aluno']}</span>
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', g.classe)}>{g.rotulo}</span>
                  </li>
                )
              }),
            )}
            {total === 0 && <li className="py-3 text-center text-[13px] text-muted-foreground">Ninguém ainda.</li>}
          </ul>
          {legenda && <p className="px-3.5 pb-3 text-xs text-muted-foreground">{legenda}</p>}
        </div>
      )}
    </div>
  )
}
