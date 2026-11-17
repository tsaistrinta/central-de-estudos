import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { apagarItemRevisao, criarItemRevisao, listarRevisao, proximaRevisao, responderRevisao } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, PontoMateria, Vazio } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ItemRevisao } from '@/types'

// Tela 05 · Revisão espaçada: cartões de pergunta e resposta que voltam no dia certo.
const BOTOES: { q: 0 | 1 | 2 | 3; nome: string; classe: string }[] = [
  { q: 0, nome: 'Esqueci', classe: 'border-destructive/40 text-destructive hover:bg-destructive-soft' },
  { q: 1, nome: 'Difícil', classe: 'border-warning/40 text-warning hover:bg-warning-soft' },
  { q: 2, nome: 'Lembrei', classe: 'border-success/40 text-success hover:bg-success-soft' },
  { q: 3, nome: 'Fácil', classe: 'border-primary/40 text-primary hover:bg-accent' },
]

function quando(dias: number) {
  return dias <= 1 ? 'amanhã' : `em ${dias} dias`
}

export default function Revisar() {
  const qc = useQueryClient()
  const itens = useQuery({ queryKey: ['revisao'], queryFn: listarRevisao })
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const [mostrar, setMostrar] = useState(false)
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  const [disc, setDisc] = useState('')
  const hoje = new Date().toISOString().slice(0, 10)
  const fila = (itens.data ?? []).filter((i) => i.proxima_em <= hoje)
  const futuros = (itens.data ?? []).filter((i) => i.proxima_em > hoje)
  const atual = fila[0]
  const disciplina = (i: ItemRevisao) => turmas.data?.find((t) => t.disciplina_id === i.disciplina_id)?.disciplina

  const responder = useMutation({
    mutationFn: (q: 0 | 1 | 2 | 3) => responderRevisao(atual, q),
    onSuccess: () => {
      setMostrar(false)
      qc.invalidateQueries({ queryKey: ['revisao'] })
    },
  })
  const criar = useMutation({
    mutationFn: () => criarItemRevisao({ pergunta: pergunta.trim(), resposta: resposta.trim() || null, disciplina_id: disc || null }),
    onSuccess: () => {
      setPergunta('')
      setResposta('')
      qc.invalidateQueries({ queryKey: ['revisao'] })
    },
  })
  const apagar = useMutation({ mutationFn: (id: string) => apagarItemRevisao(id), onSettled: () => qc.invalidateQueries({ queryKey: ['revisao'] }) })

  function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (pergunta.trim()) criar.mutate()
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Revisão" descricao={`${fila.length} cartão(ões) para hoje · ${futuros.length} agendados`} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Cartao>
          {itens.isLoading ? (
            <Esqueleto className="pt-4" />
          ) : !atual ? (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-semibold">Tudo revisado por hoje</p>
              <p className="mt-1 text-sm text-muted-foreground">O próximo cartão volta {futuros[0] ? `em ${futuros[0].proxima_em.slice(8, 10)}/${futuros[0].proxima_em.slice(5, 7)}` : 'quando você criar um'}.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {disciplina(atual) && <PontoMateria cor={`var(--subject-${disciplina(atual)!.cor})`} />}
                {disciplina(atual)?.nome ?? 'Geral'} · {fila.length} na fila
              </div>
              <p className="text-xl leading-snug font-semibold">{atual.pergunta}</p>
              {mostrar ? (
                <>
                  <p className="rounded-lg bg-background px-4 py-3 text-[15px] leading-relaxed">{atual.resposta ?? 'Sem resposta cadastrada.'}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {BOTOES.map((b) => (
                      <button key={b.q} onClick={() => responder.mutate(b.q)} disabled={responder.isPending} className={cn('flex flex-col items-center rounded-md border py-2 text-sm font-semibold', b.classe)}>
                        {b.nome}
                        <span className="text-[11px] font-normal opacity-80">{quando(proximaRevisao(atual, b.q).intervalo_dias)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <Button className="h-10 self-start" onClick={() => setMostrar(true)}>
                  <Eye /> Mostrar resposta
                </Button>
              )}
            </div>
          )}
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo="Novo cartão">
            <form onSubmit={aoCriar} className="space-y-2 px-4 pb-4">
              <textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} rows={2} placeholder="Pergunta" className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={2} placeholder="Resposta" className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="flex gap-2">
                <select value={disc} onChange={(e) => setDisc(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm">
                  <option value="">Sem matéria</option>
                  {(turmas.data ?? []).map((t) => (
                    <option key={t.id} value={t.disciplina_id}>
                      {t.disciplina.sigla ?? t.disciplina.nome}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={!pergunta.trim()}>
                  <Plus /> Criar
                </Button>
              </div>
            </form>
          </Cartao>
          <Cartao titulo="Próximos">
            {futuros.length === 0 ? (
              <Vazio>Nenhum agendado.</Vazio>
            ) : (
              <ul className="px-4 pb-3">
                {futuros.slice(0, 8).map((i) => (
                  <li key={i.id} className="group flex items-center gap-2 border-b border-muted py-2 text-[13px] last:border-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {i.proxima_em.slice(8, 10)}/{i.proxima_em.slice(5, 7)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{i.pergunta}</span>
                    <button onClick={() => apagar.mutate(i.id)} className="hidden text-muted-foreground group-hover:block hover:text-destructive" aria-label="Apagar">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </div>
  )
}
