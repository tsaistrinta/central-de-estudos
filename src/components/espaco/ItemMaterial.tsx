import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Clock, ExternalLink, FileText, Link2, ShieldCheck, StickyNote, Trash2, Users } from 'lucide-react'
import { apagarMaterial, atualizarMaterial, linkDoArquivo } from '@/api/espaco'
import { meuIdSincrono } from '@/lib/identidade'
import { tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import type { Material } from '@/types'

const ICONES = { arquivo: FileText, link: Link2, anotacao: StickyNote }

export default function ItemMaterial({ m, rodape }: { m: Material; rodape?: React.ReactNode }) {
  const qc = useQueryClient()
  const Icone = ICONES[m.tipo]
  const meu = m.dono_id === meuIdSincrono()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['materiais'] })
  const revisar = useMutation({ mutationFn: () => atualizarMaterial(m.id, { status_revisao: m.status_revisao === 'ja_revisei' ? 'estudar_depois' : 'ja_revisei' }), onSettled: invalidar })
  const apagar = useMutation({ mutationFn: () => apagarMaterial(m.id), onSettled: invalidar })

  async function abrir() {
    if (m.tipo === 'link' && m.url) window.open(m.url, '_blank', 'noreferrer')
    if (m.tipo === 'arquivo' && m.arquivo_chave_r2) window.open(await linkDoArquivo(m.arquivo_chave_r2), '_blank', 'noreferrer')
  }

  return (
    <li className="flex flex-col gap-2 border-b border-muted px-4 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <Icone size={16} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <button onClick={abrir} className="flex max-w-full items-center gap-1.5 text-left text-sm font-medium hover:text-primary" disabled={m.tipo === 'anotacao'}>
            <span className="truncate">{m.titulo}</span>
            {m.tipo !== 'anotacao' && <ExternalLink size={12} className="shrink-0 text-muted-foreground" />}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {m.oficial && (
              <span className="inline-flex items-center gap-1 text-primary">
                <ShieldCheck size={11} /> Oficial do professor
              </span>
            )}
            {!m.oficial && m.turma_id && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} /> Da turma
              </span>
            )}
            {m.semana && <span>Semana {m.semana}</span>}
            <span>{tempoRelativo(m.criado_em)}</span>
          </div>
          {m.tipo === 'anotacao' && m.conteudo && <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{m.conteudo}</p>}
        </div>
        <button
          onClick={() => revisar.mutate()}
          className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold', m.status_revisao === 'ja_revisei' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}
          title="Alternar status de revisão"
        >
          {m.status_revisao === 'ja_revisei' ? <CircleCheck size={12} /> : <Clock size={12} />}
          {m.status_revisao === 'ja_revisei' ? 'Já revisei' : 'Estudar depois'}
        </button>
        {meu && (
          <button onClick={() => apagar.mutate()} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Apagar">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {rodape}
    </li>
  )
}
