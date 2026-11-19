import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { tenantAtual } from '@/api/academico'
import { apagarAvaliacao, avaliacoesDasTurmas, criarAvaliacao, minhaFrequencia, minhasNotas, salvarNota } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, PontoMateria } from '@/components/foco/Base'
import { useDadosAgenda } from '@/components/agenda/useDadosAgenda'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/texto'
import type { Avaliacao, MinhaTurma, Nota } from '@/types'

// Tela 07 · Notas e faltas. Controle pessoal: o oficial continua sendo o SIGA.
// Regra das Fatecs: média final ≥ 6,0 e frequência ≥ 75%.
const MEDIA_MINIMA = 6
const FREQ_MINIMA = 0.75
const BLOCO_MIN = 50

function CampoNota({ avaliacao, nota }: { avaliacao: Avaliacao; nota?: Nota }) {
  const qc = useQueryClient()
  const [valor, setValor] = useState(nota?.valor?.toString().replace('.', ',') ?? '')
  const salvar = useMutation({
    mutationFn: (v: number | null) => salvarNota(avaliacao.id, v),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notas'] }),
  })
  return (
    <input
      value={valor}
      inputMode="decimal"
      placeholder="—"
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        const n = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
        if (n === null || (!Number.isNaN(n) && n >= 0 && n <= 10)) salvar.mutate(n)
      }}
      className="h-8 w-16 rounded-md border border-border text-center font-mono text-sm outline-none focus:border-primary"
    />
  )
}

function CartaoTurma({ t, avaliacoes, notas, aulasPrevistas, faltas }: { t: MinhaTurma; avaliacoes: Avaliacao[]; notas: Nota[]; aulasPrevistas: number; faltas: number }) {
  const qc = useQueryClient()
  const [nome, setNome] = useState('')
  const [peso, setPeso] = useState('1')
  const criar = useMutation({
    mutationFn: () => criarAvaliacao({ turma_id: t.id, nome: nome.trim(), peso: Number(peso.replace(',', '.')) || 1 }),
    onSuccess: () => {
      setNome('')
      qc.invalidateQueries({ queryKey: ['avaliacoes'] })
    },
  })
  const apagar = useMutation({ mutationFn: (id: string) => apagarAvaliacao(id), onSettled: () => qc.invalidateQueries({ queryKey: ['avaliacoes'] }) })

  const comNota = avaliacoes.map((a) => ({ a, n: notas.find((n) => n.avaliacao_id === a.id)?.valor ?? null }))
  const pesoTotal = avaliacoes.reduce((s, a) => s + a.peso, 0)
  const pesoFeito = comNota.filter((x) => x.n !== null).reduce((s, x) => s + x.a.peso, 0)
  const somaFeita = comNota.reduce((s, x) => s + (x.n ?? 0) * x.a.peso, 0)
  const parcial = pesoFeito ? somaFeita / pesoFeito : null
  const precisa = pesoTotal > pesoFeito ? (MEDIA_MINIMA * pesoTotal - somaFeita) / (pesoTotal - pesoFeito) : null
  const freq = aulasPrevistas ? 1 - faltas / aulasPrevistas : 1
  const podeFaltar = Math.max(0, Math.floor(aulasPrevistas * (1 - FREQ_MINIMA)) - faltas)
  const risco = (parcial !== null && parcial < MEDIA_MINIMA && precisa !== null && precisa > 8) || podeFaltar <= 2

  return (
    <Cartao
      titulo={
        <span className="flex items-center gap-2">
          <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} /> {t.disciplina.nome}
        </span>
      }
      acao={risco ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-semibold text-destructive"><AlertTriangle size={11} /> Atenção</span> : undefined}
    >
      <div className="grid gap-4 px-4 pb-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1.5 font-medium">Avaliação</th>
                <th className="pb-1.5 font-medium">Peso</th>
                <th className="pb-1.5 font-medium">Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {comNota.map(({ a }) => (
                <tr key={a.id} className="group border-t border-muted">
                  <td className="py-1.5 font-medium">{a.nome}</td>
                  <td className="py-1.5 font-mono text-muted-foreground">{a.peso}</td>
                  <td className="py-1.5">
                    <CampoNota avaliacao={a} nota={notas.find((n) => n.avaliacao_id === a.id)} />
                  </td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => apagar.mutate(a.id)} className="hidden text-muted-foreground group-hover:inline hover:text-destructive" aria-label="Apagar avaliação">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (nome.trim()) criar.mutate()
            }}
            className="mt-2 flex gap-1.5"
          >
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova avaliação (ex.: P2)" className="h-8 min-w-0 flex-1 rounded-md border border-border px-2.5 text-[13px] outline-none focus:border-primary" />
            <input value={peso} onChange={(e) => setPeso(e.target.value)} className="h-8 w-14 rounded-md border border-border text-center font-mono text-[13px]" aria-label="Peso" />
            <button type="submit" className="grid size-8 place-items-center rounded-md border border-border hover:bg-muted" aria-label="Adicionar avaliação">
              <Plus size={14} />
            </button>
          </form>
          {avaliacoes.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Os pesos vêm do plano de ensino quando o professor publicar (Fase 6). Até lá, cadastre aqui.</p>}
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-background p-3">
          <div>
            <p className="text-xs text-muted-foreground">Média até agora</p>
            <p className={cn('font-mono text-2xl font-semibold', parcial !== null && parcial < MEDIA_MINIMA ? 'text-destructive' : 'text-foreground')}>{parcial === null ? '—' : parcial.toFixed(1).replace('.', ',')}</p>
            {precisa !== null && pesoFeito > 0 && (
              <p className="text-xs text-muted-foreground">
                Precisa de <b className="text-foreground">{Math.max(0, precisa).toFixed(1).replace('.', ',')}</b> no que falta para fechar 6,0
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frequência</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', freq < 0.8 ? 'bg-destructive' : 'bg-success')} style={{ width: `${Math.round(freq * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <b className="text-foreground">{plural(faltas, 'falta')}</b> de {plural(aulasPrevistas, 'aula')} · pode faltar mais <b className={cn(podeFaltar <= 2 ? 'text-destructive' : 'text-foreground')}>{podeFaltar}</b>
            </p>
          </div>
        </div>
      </div>
    </Cartao>
  )
}

export default function Notas() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual, staleTime: 30 * 60_000 })
  const de = useMemo(() => new Date(`${tenant.data?.inicio_periodo ?? `${new Date().getFullYear()}-01-01`}T00:00`), [tenant.data])
  const ate = useMemo(() => new Date(`${tenant.data?.fim_periodo ?? `${new Date().getFullYear()}-12-31`}T23:59`), [tenant.data])
  const { itens, turmas, carregando } = useDadosAgenda(de, ate)
  const ids = turmas.map((t) => t.id)
  const avaliacoes = useQuery({ queryKey: ['avaliacoes', ids], queryFn: () => avaliacoesDasTurmas(ids), enabled: ids.length > 0 })
  const notas = useQuery({ queryKey: ['notas'], queryFn: minhasNotas })
  const frequencia = useQuery({ queryKey: ['frequencia'], queryFn: minhaFrequencia })

  // Aulas previstas no semestre = blocos de 50 min da grade, sem feriados e cancelamentos.
  const previstas = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of itens) {
      if (i.tipo !== 'aula' || !i.turma) continue
      m.set(i.turma.id, (m.get(i.turma.id) ?? 0) + Math.max(1, Math.round((i.fim.getTime() - i.inicio.getTime()) / (BLOCO_MIN * 6e4))))
    }
    return m
  }, [itens])

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Notas e faltas" descricao="Seu controle pessoal com os pesos de cada avaliação. Notas e faltas oficiais continuam no SIGA." />
      <p className="text-[13px] text-muted-foreground">
        Na agenda, clique numa aula que já passou e marque <b className="text-foreground">Fui</b> ou <b className="text-foreground">Faltei</b>. Cada bloco de 50 min conta como uma aula.
      </p>
      {carregando ? (
        <Esqueleto linhas={4} />
      ) : (
        <div className="space-y-4">
          {turmas.map((t) => (
            <CartaoTurma
              key={t.id}
              t={t}
              avaliacoes={(avaliacoes.data ?? []).filter((a) => a.turma_id === t.id)}
              notas={notas.data ?? []}
              aulasPrevistas={previstas.get(t.id) ?? 0}
              faltas={(frequencia.data ?? []).filter((f) => f.turma_id === t.id && !f.presente).reduce((s, f) => s + f.aulas, 0)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
