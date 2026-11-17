import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck } from 'lucide-react'
import { pessoas as buscarPessoas, membrosDaTurma } from '@/api/academico'
import { fecharProposta, quorum, votar, votosDe } from '@/api/comunidade'
import { meuIdSincrono } from '@/lib/identidade'
import { cn } from '@/lib/utils'
import { useAgora } from '@/lib/useAgora'
import type { Proposta, Turma } from '@/types'
import { ListaDePessoas, Pilha } from './Avatares'

// Validação coletiva (tela 19): barra de quórum, votos visíveis como curtidas e botões de voto.
// A regra que vale é a do banco (avaliar_proposta); a tela só mostra.
export default function Votacao({ proposta, turma, compacto = false, souProfessor = false }: { proposta: Proposta; turma: Turma; compacto?: boolean; souProfessor?: boolean }) {
  const qc = useQueryClient()
  const votos = useQuery({ queryKey: ['votos', proposta.id], queryFn: () => votosDe([proposta.id]) })
  const membros = useQuery({ queryKey: ['membros', turma.id], queryFn: () => membrosDaTurma(turma.id) })
  const pessoas = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas, staleTime: 5 * 60_000 })
  const alunos = (membros.data ?? []).filter((m) => m.papel_turma !== 'professor').length
  const q = quorum(turma.tamanho_real, alunos)
  const lista = votos.data ?? []
  const sim = lista.filter((v) => v.valor === 'sim').map((v) => v.usuario_id)
  const nao = lista.filter((v) => v.valor === 'nao').map((v) => v.usuario_id)
  const eu = meuIdSincrono()
  const meuVoto = lista.find((v) => v.usuario_id === eu)?.valor ?? null
  const aberta = proposta.status === 'nao_confirmado'
  const faltam = Math.max(0, q - sim.length)
  const pctSim = lista.length ? Math.round((sim.length / lista.length) * 100) : 0
  const agora = useAgora()
  const horas = Math.max(0, Math.round((new Date(proposta.expira_em).getTime() - agora.getTime()) / 36e5))

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['votos', proposta.id] })
    qc.invalidateQueries({ queryKey: ['propostas'] })
    qc.invalidateQueries({ queryKey: ['agenda'] })
  }
  const mVoto = useMutation({ mutationFn: (v: 'sim' | 'nao' | null) => votar(proposta, v, q), onSettled: invalidar })
  const mFechar = useMutation({ mutationFn: (aceitar: boolean) => fecharProposta(proposta.id, aceitar), onSettled: invalidar })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span>
          <b>
            {sim.length} de {q}
          </b>{' '}
          confirmações
        </span>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          turma: {turma.tamanho_real ?? alunos} alunos{compacto ? '' : ' · 25%'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, (sim.length / q) * 100)}%` }} />
      </div>
      {!compacto && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-[3px] bg-success" />
            Sim {sim.length} · {pctSim}%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-[3px] bg-destructive" />
            Não {nao.length} · {lista.length ? 100 - pctSim : 0}%
          </span>
          {aberta && (
            <span className="text-muted-foreground">
              {faltam === 1 ? 'Falta 1 confirmação' : faltam ? `Faltam ${faltam} confirmações` : 'Quórum atingido'} · fecha em {horas} h
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {aberta && !souProfessor && (
          <>
            <button
              onClick={() => mVoto.mutate(meuVoto === 'sim' ? null : 'sim')}
              disabled={mVoto.isPending}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold',
                meuVoto === 'sim' ? 'bg-success text-white' : 'border border-success/40 text-success hover:bg-success-soft',
              )}
            >
              <Check size={15} strokeWidth={2.2} /> {meuVoto === 'sim' ? 'Você confirmou' : 'Sim, confirmo'}
            </button>
            <button
              onClick={() => mVoto.mutate(meuVoto === 'nao' ? null : 'nao')}
              disabled={mVoto.isPending}
              className={cn(
                'inline-flex h-9 items-center rounded-md px-3.5 text-[13px] font-semibold',
                meuVoto === 'nao' ? 'bg-destructive text-white' : 'border border-border hover:bg-muted',
              )}
            >
              {meuVoto === 'nao' ? 'Você disse não' : 'Não é isso'}
            </button>
          </>
        )}
        {aberta && souProfessor && (
          <>
            <button onClick={() => mFechar.mutate(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover">
              <ShieldCheck size={15} /> Confirmar como oficial
            </button>
            <button onClick={() => mFechar.mutate(false)} className="inline-flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] font-semibold hover:bg-muted">
              Não procede
            </button>
          </>
        )}
        <span className="flex-1" />
        <ListaDePessoas
          titulo="Quem votou"
          pessoas={pessoas.data ?? new Map()}
          grupos={[
            { rotulo: 'Sim', ids: sim, classe: 'bg-success-soft text-success' },
            { rotulo: 'Não', ids: nao, classe: 'bg-destructive-soft text-destructive' },
          ]}
          legenda="Só alunos matriculados nesta turma votam."
          gatilho={
            <>
              <Pilha ids={[...sim, ...nao]} pessoas={pessoas.data ?? new Map()} />
              <span className="text-[12.5px] font-medium text-primary">Ver quem votou</span>
            </>
          }
        />
      </div>
    </div>
  )
}
