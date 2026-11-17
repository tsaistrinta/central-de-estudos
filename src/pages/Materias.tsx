import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Users } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { fundoDaCor } from '@/lib/cores'
import { cn } from '@/lib/utils'

// Minhas matérias: uma por turma em que você está, com o que já tem guardado.
export default function Materias() {
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const materiais = useQuery({ queryKey: ['materiais', 'todos'], queryFn: () => listarMateriais({ entrada: false }) })

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Minhas matérias" descricao="Disciplinas deste semestre, com os materiais oficiais e os seus." />
      {turmas.isLoading ? (
        <Cartao>
          <Esqueleto linhas={4} className="pt-4" />
        </Cartao>
      ) : !turmas.data?.length ? (
        <Cartao>
          <Vazio acao={<Link to="/turma" className="font-semibold text-primary hover:underline">Entrar numa turma</Link>}>Você ainda não está em nenhuma turma.</Vazio>
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
    </div>
  )
}
