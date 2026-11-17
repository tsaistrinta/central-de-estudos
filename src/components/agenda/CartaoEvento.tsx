import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BookOpen, Check, ExternalLink, KanbanSquare, MapPin, Pencil, RefreshCw, Sparkles, Trash2, User, Users, X } from 'lucide-react'
import { PilulaEvento, SeloStatus, SeloYara } from '@/components/foco/Selos'
import Votacao from '@/components/comunidade/Votacao'
import { apagarEvento } from '@/api/agenda'
import { criarTarefa, marcarPresenca } from '@/api/espaco'
import { MINUTOS_LEMBRETE, type ItemAgenda } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import { useAgora } from '@/lib/useAgora'

const dataLonga = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const hhmm = (d: Date) => d.toTimeString().slice(0, 5)

type Props = {
  item: ItemAgenda
  posicao: { x: number; y: number; lado: 'direita' | 'esquerda' }
  onFechar: () => void
  onEditar: (item: ItemAgenda) => void
  onPropor: (item: ItemAgenda) => void
}

function Linha({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] leading-snug">
      <span className="mt-0.5 text-muted-foreground">{icone}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Cartão rápido ao clicar num evento (tela 21), como no Outlook.
export default function CartaoEvento({ item, posicao, onFechar, onEditar, onPropor }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const e = item.evento
  const t = item.turma

  useEffect(() => {
    const fechar = (ev: MouseEvent | KeyboardEvent) => {
      if (ev instanceof KeyboardEvent ? ev.key === 'Escape' : !ref.current?.contains(ev.target as Node) && !(ev.target as HTMLElement).closest('.fc-event')) onFechar()
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', fechar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', fechar)
    }
  }, [onFechar])

  const apagar = useMutation({
    mutationFn: () => apagarEvento(e!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] })
      onFechar()
    },
  })
  const tarefa = useMutation({
    mutationFn: () => criarTarefa({ titulo: item.titulo, prazo: item.inicio.toISOString().slice(0, 10), disciplina_id: t?.disciplina_id ?? e?.disciplina_id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })
  const presenca = useMutation({
    mutationFn: (presente: boolean) => {
      const blocos = Math.max(1, Math.round((item.fim.getTime() - item.inicio.getTime()) / (50 * 6e4)))
      return marcarPresenca(item.aula!.turma_id, item.aula!.data, presente, blocos)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['frequencia'] }),
  })

  const agora = useAgora().getTime()
  const ehPessoal = e?.escopo === 'pessoal'
  const diasAte = Math.ceil((item.inicio.getTime() - agora) / 864e5)
  const jaAconteceu = item.inicio.getTime() < agora
  const lembretes = e?.lembretes ?? (e?.tipo === 'prova' ? [1440, 120] : e?.tipo === 'entrega' ? [2880, 180] : null)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={item.titulo}
      className="absolute z-40 w-[372px] max-w-[calc(100%-16px)] overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--sombra-pop)]"
      style={{ left: posicao.x, top: posicao.y }}
    >
      <div className="h-1.5" style={{ background: item.cor }} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {e && <PilulaEvento tipo={e.tipo} />}
            {item.tipo === 'aula' && <PilulaEvento tipo="aula" />}
            {item.tipo === 'proposta' && <SeloStatus status="nao_confirmado" />}
            {e && e.escopo !== 'pessoal' && <SeloStatus status={e.status} />}
            {e?.origem === 'yara' && <SeloYara rotulo={e.status === 'provavel' ? 'Sugestão da Yara' : 'Captado pela Yara'} />}
            {item.estilo === 'cancelado' && <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-semibold text-destructive">Cancelado</span>}
          </div>
          <div className="flex text-muted-foreground">
            {ehPessoal && (
              <button className="grid size-7 place-items-center rounded-md hover:bg-muted" onClick={() => onEditar(item)} aria-label="Editar">
                <Pencil size={15} strokeWidth={1.75} />
              </button>
            )}
            {ehPessoal && !e?.rrule && (
              <button className="grid size-7 place-items-center rounded-md hover:bg-muted hover:text-destructive" onClick={() => apagar.mutate()} aria-label="Apagar">
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            )}
            <button className="grid size-7 place-items-center rounded-md hover:bg-muted" onClick={onFechar} aria-label="Fechar">
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div>
          <h3 className={cn('text-[17px] leading-snug font-semibold tracking-tight', item.estilo === 'cancelado' && 'line-through')}>
            {item.proposta ? (item.proposta.dados.titulo ?? item.proposta.titulo) : t && item.tipo === 'evento' && !item.titulo.includes(t.disciplina.sigla ?? '§') ? `${item.titulo} · ${t.disciplina.nome}` : item.tipo === 'aula' ? t?.disciplina.nome : item.titulo}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
            {dataLonga(item.inicio)}
            {!item.diaTodo && ` · ${hhmm(item.inicio)} – ${hhmm(item.fim)}`}
            {item.diaTodo && item.fim.getTime() - item.inicio.getTime() > 864e5 && ` até ${dataLonga(new Date(item.fim.getTime() - 1))}`}
          </p>
        </div>

        {(e?.local || item.aula?.sala || item.proposta?.dados.local) && (
          <Linha icone={<MapPin size={15} strokeWidth={1.75} />}>{e?.local ?? item.aula?.sala ?? item.proposta?.dados.local}</Linha>
        )}
        {t && (
          <Linha icone={<User size={15} strokeWidth={1.75} />}>
            {t.professor_nome ?? 'Professor a confirmar'} · {t.disciplina.sigla ?? t.disciplina.nome}
          </Linha>
        )}
        {e?.descricao && <Linha icone={<BookOpen size={15} strokeWidth={1.75} />}>{e.descricao}</Linha>}
        {e?.documento_url && (
          <Linha icone={<ExternalLink size={15} strokeWidth={1.75} />}>
            <a href={e.documento_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Ver a fonte no site da Fatec
            </a>
          </Linha>
        )}
        {e?.status === 'confirmado_turma' && (
          <Linha icone={<RefreshCw size={15} strokeWidth={1.75} />}>Confirmado pela turma. Vira oficial quando o professor confirmar.</Linha>
        )}
        {lembretes && lembretes.length > 0 && (
          <Linha icone={<Bell size={15} strokeWidth={1.75} />}>{lembretes.map((m) => MINUTOS_LEMBRETE[m] ?? `${m} min antes`).join(' · ')}</Linha>
        )}
        {item.proposta && (
          <>
            {item.proposta.trecho_origem && (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed">
                <SeloYara /> leu: {item.proposta.trecho_origem}
              </div>
            )}
            {t && <Votacao proposta={item.proposta} turma={t} compacto />}
          </>
        )}
      </div>

      {!item.proposta && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5">
          {item.tipo === 'aula' && jaAconteceu ? (
            <>
              <span className="mr-1 text-[12.5px] text-muted-foreground">Você foi?</span>
              <button onClick={() => presenca.mutate(true)} className="inline-flex h-8 items-center gap-1 rounded-md border border-success/40 px-3 text-[12.5px] font-semibold text-success hover:bg-success-soft">
                <Check size={14} /> Fui
              </button>
              <button onClick={() => presenca.mutate(false)} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[12.5px] font-semibold hover:bg-muted">
                Faltei
              </button>
              {presenca.isSuccess && <span className="text-[12px] text-success">Anotado em Notas e faltas</span>}
            </>
          ) : (
            <>
              {(e?.tipo === 'prova' || e?.tipo === 'entrega') && (
                <Link to="/revisao" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover">
                  <Sparkles size={14} /> Plano até a prova
                </Link>
              )}
              {item.tipo === 'evento' && (
                <button onClick={() => tarefa.mutate()} disabled={tarefa.isSuccess} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-semibold hover:bg-muted">
                  <KanbanSquare size={14} /> {tarefa.isSuccess ? 'Tarefa criada' : 'Criar tarefa'}
                </button>
              )}
              {t && (
                <button onClick={() => onPropor(item)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Users size={14} /> Propor mudança
                </button>
              )}
            </>
          )}
          <span className="flex-1" />
          {!jaAconteceu && diasAte > 0 && <span className="text-[11.5px] text-muted-foreground">faltam {diasAte} dias</span>}
        </div>
      )}
    </div>
  )
}
