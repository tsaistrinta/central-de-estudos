import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Clock, Plus, Users, X } from 'lucide-react'
import { cancelarPedido, meusPedidos, minhasTurmas, turmasOferecidas } from '@/api/academico'
import AdicionarMateria from '@/components/espaco/AdicionarMateria'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { tempoRelativo } from '@/lib/pessoas'
import { listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { fundoDaCor } from '@/lib/cores'
import { cn } from '@/lib/utils'

// Minhas matérias: uma por turma em que você está, com o que já tem guardado.
// "Adicionar matéria" serve para matérias de outros semestres (dependência, adiantamento, aproveitamento).
export default function Materias() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [adicionar, setAdicionar] = useState(false)
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const pedidos = useQuery({ queryKey: ['meus-pedidos'], queryFn: meusPedidos })
  const oferecidas = useQuery({ queryKey: ['turmas-oferecidas', perfil?.curso_id], queryFn: () => turmasOferecidas(perfil!.curso_id!), enabled: !!perfil?.curso_id && !!pedidos.data?.length })
  const cancelar = useMutation({ mutationFn: cancelarPedido, onSuccess: () => qc.invalidateQueries({ queryKey: ['meus-pedidos'] }) })
  const materiais = useQuery({ queryKey: ['materiais', 'todos'], queryFn: () => listarMateriais({ entrada: false }) })

  return (
    <div className="space-y-4">
      <Cabecalho
        titulo="Minhas matérias"
        descricao="Disciplinas que você cursa, com os materiais oficiais, os seus e o acervo de cada uma."
        acoes={
          <Button onClick={() => setAdicionar(true)}>
            <Plus /> Adicionar matéria
          </Button>
        }
      />
      {!!pedidos.data?.length && (
        <Cartao titulo="Aguardando aprovação">
          <ul className="px-4 pb-2">
            {pedidos.data.map((p) => {
              const t = oferecidas.data?.find((x) => x.id === p.turma_id)
              return (
                <li key={p.id} className="flex items-center gap-2.5 border-b border-muted py-2 text-[13px] last:border-0">
                  <Clock size={15} strokeWidth={1.75} className="text-[var(--warning)]" />
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-medium">{t?.disciplina.nome ?? 'Turma'}</b>
                    <span className="text-muted-foreground"> · pedido {tempoRelativo(p.criado_em)} · o professor ou o administrador vai responder</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => cancelar.mutate(p.id)} aria-label="Cancelar pedido">
                    <X /> Cancelar
                  </Button>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}
      {turmas.isLoading ? (
        <Cartao>
          <Esqueleto linhas={4} className="pt-4" />
        </Cartao>
      ) : !turmas.data?.length ? (
        <Cartao>
          <Vazio acao={<button onClick={() => setAdicionar(true)} className="font-semibold text-primary hover:underline">Adicionar matéria</button>}>Você ainda não está em nenhuma turma.</Vazio>
        </Cartao>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {turmas.data.map((t) => {
            const dela = (materiais.data ?? []).filter((m) => m.disciplina_id === t.disciplina_id)
            const pendentes = dela.filter((m) => m.status_revisao === 'estudar_depois').length
            return (
              <Link key={t.id} to={`/materias/${t.disciplina_id}`} className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-md text-white', fundoDaCor(t.disciplina.cor))}>
                    <BookOpen size={17} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold group-hover:text-primary">{t.disciplina.nome}</p>
                    <p className="text-xs text-muted-foreground">{t.professor_nome ?? 'Professor a confirmar'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-[12.5px] text-muted-foreground">
                  <span>
                    <b className="font-mono text-foreground">{dela.length}</b> materiais
                  </span>
                  <span>
                    <b className="font-mono text-foreground">{pendentes}</b> para revisar
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Users size={12} /> {t.disciplina.sigla}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {adicionar && <AdicionarMateria onFechar={() => setAdicionar(false)} />}
    </div>
  )
}
