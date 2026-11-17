import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus, Users } from 'lucide-react'
import { aulasDasTurmas, minhasTurmas } from '@/api/academico'
import { listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import ItemMaterial from '@/components/espaco/ItemMaterial'
import NovoMaterial from '@/components/espaco/NovoMaterial'
import { DIAS_CURTOS } from '@/lib/datas'
import { cn } from '@/lib/utils'

// Matéria: meus materiais + os da turma, horários e atalho para a turma.
export default function Materia() {
  const { id } = useParams()
  const [filtro, setFiltro] = useState<'todos' | 'meus' | 'turma' | 'revisar'>('todos')
  const [novo, setNovo] = useState(false)
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const turma = turmas.data?.find((t) => t.disciplina_id === id)
  const materiais = useQuery({ queryKey: ['materiais', 'disciplina', id], queryFn: () => listarMateriais({ disciplinaId: id }), enabled: !!id })
  const aulas = useQuery({ queryKey: ['aulas', [turma?.id]], queryFn: () => aulasDasTurmas([turma!.id]), enabled: !!turma })

  if (turmas.isLoading) return <Esqueleto linhas={5} />
  if (!turma) return <Vazio>Matéria não encontrada nas suas turmas.</Vazio>

  const lista = (materiais.data ?? []).filter((m) =>
    filtro === 'meus' ? !m.turma_id : filtro === 'turma' ? !!m.turma_id : filtro === 'revisar' ? m.status_revisao === 'estudar_depois' : true,
  )

  return (
    <div className="space-y-4">
      <Cabecalho
        migalha={
          <>
            <Link to="/materias" className="hover:text-foreground">Minhas matérias</Link> <ChevronRight size={13} /> <b className="font-medium text-foreground">{turma.disciplina.sigla}</b>
          </>
        }
        titulo={turma.disciplina.nome}
        descricao={`${turma.professor_nome ?? 'Professor a confirmar'} · ${turma.periodo_letivo} · ${turma.turno === 'noite' ? 'Noite' : turma.turno === 'manha' ? 'Manhã' : 'Tarde'}`}
        acoes={
          <>
            <Link to={`/turmas/${turma.id}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted">
              <Users size={16} strokeWidth={1.75} /> Abrir a turma
            </Link>
            <Button onClick={() => setNovo(true)}>
              <Plus /> Novo material
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Cartao>
          <div className="flex gap-1.5 border-b border-border px-4 py-3">
            {(
              [
                ['todos', 'Todos'],
                ['meus', 'Meus'],
                ['turma', 'Da turma'],
                ['revisar', 'Para revisar'],
              ] as const
            ).map(([k, n]) => (
              <button key={k} onClick={() => setFiltro(k)} className={cn('h-7 rounded-full border px-3 text-[12.5px] font-medium', filtro === k ? 'border-foreground bg-foreground text-card' : 'border-border text-muted-foreground hover:bg-muted')}>
                {n}
              </button>
            ))}
          </div>
          {materiais.isLoading ? <Esqueleto className="pt-3" /> : lista.length === 0 ? <Vazio>Nada aqui ainda.</Vazio> : <ul>{lista.map((m) => <ItemMaterial key={m.id} m={m} />)}</ul>}
        </Cartao>
        <Cartao titulo="Aulas">
          {(aulas.data ?? []).length === 0 ? (
            <Vazio>Horário ainda não captado da grade.</Vazio>
          ) : (
            <ul className="px-4 pb-3">
              {aulas.data!.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-muted py-2 text-[13px] last:border-0">
                  <span className="font-medium">{DIAS_CURTOS[a.dia_semana]}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.inicio.slice(0, 5)}–{a.fim.slice(0, 5)}
                  </span>
                  <span className="text-muted-foreground">{a.sala}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
      {novo && <NovoMaterial turmas={turmas.data ?? []} disciplinaId={turma.disciplina_id} onFechar={() => setNovo(false)} />}
    </div>
  )
}
