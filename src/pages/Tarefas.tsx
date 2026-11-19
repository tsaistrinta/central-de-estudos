import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CalendarDays, Check, Plus, Trash2 } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { apagarTarefa, atualizarTarefa, criarTarefa, listarTarefas, moverTarefa } from '@/api/espaco'
import { Cabecalho, Esqueleto, PontoMateria } from '@/components/foco/Base'
import { cn } from '@/lib/utils'
import type { ColunaTarefa, MinhaTurma, Tarefa } from '@/types'

// Tela 06 · Tarefas em Kanban. Arraste entre as colunas; tarefas também nascem do cartão de um evento.
const COLUNAS: { id: ColunaTarefa; nome: string }[] = [
  { id: 'a_fazer', nome: 'A fazer' },
  { id: 'fazendo', nome: 'Fazendo' },
  { id: 'feito', nome: 'Feito' },
]

function CartaoTarefa({ t, turmas }: { t: Tarefa; turmas: MinhaTurma[] }) {
  const qc = useQueryClient()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id })
  const disc = turmas.find((x) => x.disciplina_id === t.disciplina_id)?.disciplina
  const feitas = t.subtarefas.filter((s) => s.feita).length
  const invalidar = () => qc.invalidateQueries({ queryKey: ['tarefas'] })
  const apagar = useMutation({ mutationFn: () => apagarTarefa(t.id), onSettled: invalidar })
  const alternarSub = useMutation({
    mutationFn: (i: number) => atualizarTarefa(t.id, { subtarefas: t.subtarefas.map((s, j) => (j === i ? { ...s, feita: !s.feita } : s)) }),
    onSettled: invalidar,
  })
  const hoje = new Date().toISOString().slice(0, 10)
  const atrasada = t.prazo && t.prazo < hoje && t.coluna !== 'feito'

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn('group rounded-lg border border-border bg-card p-3 shadow-sm', isDragging && 'z-10 shadow-lg ring-2 ring-primary/30')}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <p className={cn('text-sm font-medium', t.coluna === 'feito' && 'text-muted-foreground line-through')}>{t.titulo}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {disc && (
            <span className="inline-flex items-center gap-1.5">
              <PontoMateria cor={`var(--subject-${disc.cor})`} /> {disc.sigla}
            </span>
          )}
          {t.prazo && (
            <span className={cn('inline-flex items-center gap-1 font-mono', atrasada && 'text-destructive')}>
              <CalendarDays size={11} /> {t.prazo.slice(8, 10)}/{t.prazo.slice(5, 7)}
            </span>
          )}
          {t.subtarefas.length > 0 && (
            <span className="font-mono">
              {feitas}/{t.subtarefas.length}
            </span>
          )}
        </div>
      </div>
      {t.subtarefas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {t.subtarefas.map((s, i) => (
            <li key={i}>
              <button onClick={() => alternarSub.mutate(i)} className="flex items-center gap-2 text-left text-[12.5px]">
                <span className={cn('grid size-3.5 place-items-center rounded-[3px] border', s.feita ? 'border-success bg-success text-white' : 'border-border')}>{s.feita && <Check size={9} strokeWidth={3} />}</span>
                <span className={cn(s.feita && 'text-muted-foreground line-through')}>{s.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => apagar.mutate()} className="mt-1 hidden text-[11.5px] text-muted-foreground group-hover:inline-flex hover:text-destructive">
        <Trash2 size={12} className="mr-1" /> apagar
      </button>
    </div>
  )
}

function Coluna({ id, nome, children, total }: { id: ColunaTarefa; nome: string; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn('flex min-h-[420px] flex-col gap-2.5 rounded-lg border border-border bg-background p-3', isOver && 'border-primary bg-accent/30')}>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold">{nome}</span>
        <span className="font-mono text-xs text-muted-foreground">{total}</span>
      </div>
      {children}
    </div>
  )
}

export default function Tarefas() {
  const qc = useQueryClient()
  const tarefas = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [disc, setDisc] = useState('')
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const mover = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: ColunaTarefa }) => moverTarefa(id, coluna),
    onMutate: async ({ id, coluna }) => {
      await qc.cancelQueries({ queryKey: ['tarefas'] })
      const antes = qc.getQueryData<Tarefa[]>(['tarefas'])
      qc.setQueryData<Tarefa[]>(['tarefas'], (l) => l?.map((t) => (t.id === id ? { ...t, coluna } : t)))
      return { antes }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['tarefas'], ctx?.antes),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })
  const criar = useMutation({
    mutationFn: () => criarTarefa({ titulo: titulo.trim(), prazo: prazo || null, disciplina_id: disc || null }),
    onSuccess: () => {
      setTitulo('')
      setPrazo('')
      qc.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })

  function aoSoltar(e: DragEndEvent) {
    const coluna = e.over?.id as ColunaTarefa | undefined
    const t = tarefas.data?.find((x) => x.id === e.active.id)
    if (coluna && t && t.coluna !== coluna) mover.mutate({ id: t.id, coluna })
  }

  function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (titulo.trim()) criar.mutate()
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Tarefas" descricao="Trabalhos, listas e entregas. Arraste o cartão para mudar de coluna." />
      <form onSubmit={aoCriar} className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nova tarefa…" className="h-9 min-w-[220px] flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-primary" />
        <select aria-label="Matéria da tarefa" value={disc} onChange={(e) => setDisc(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">Sem matéria</option>
          {(turmas.data ?? []).map((t) => (
            <option key={t.id} value={t.disciplina_id}>
              {t.disciplina.sigla ?? t.disciplina.nome}
            </option>
          ))}
        </select>
        <input type="date" aria-label="Prazo da tarefa" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-9 rounded-md border border-border px-2 text-sm" />
        <button type="submit" disabled={!titulo.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          <Plus size={16} /> Adicionar
        </button>
      </form>
      {tarefas.isLoading ? (
        <Esqueleto linhas={4} />
      ) : (
        <DndContext sensors={sensores} onDragEnd={aoSoltar}>
          <div className="grid gap-4 md:grid-cols-3">
            {COLUNAS.map((c) => {
              const lista = (tarefas.data ?? []).filter((t) => t.coluna === c.id)
              return (
                <Coluna key={c.id} id={c.id} nome={c.nome} total={lista.length}>
                  {lista.map((t) => (
                    <CartaoTarefa key={t.id} t={t} turmas={turmas.data ?? []} />
                  ))}
                  {lista.length === 0 && <p className="px-1 py-6 text-center text-[12.5px] text-faint">Solte aqui</p>}
                </Coluna>
              )
            })}
          </div>
        </DndContext>
      )}
    </div>
  )
}
