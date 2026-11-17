import { useQuery } from '@tanstack/react-query'
import { listarCursos, tenantAtual } from '@/api/academico'
import { Cabecalho, Cartao } from '@/components/foco/Base'
import EventosOficiais from '@/components/foco/EventosOficiais'
import { useAuth } from '@/lib/auth'

// Tela 11 · Espaço do curso: prazos e comunicados da coordenação, captados do site.
export default function Curso() {
  const { perfil } = useAuth()
  const cursos = useQuery({ queryKey: ['cursos'], queryFn: listarCursos })
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual })
  const curso = cursos.data?.find((c) => c.id === perfil?.curso_id) ?? cursos.data?.[0]
  return (
    <div className="space-y-4">
      <Cabecalho titulo={curso ? `${curso.sigla} · ${curso.nome}` : 'Meu curso'} descricao={`${tenant.data?.nome ?? 'Fatec'} · semestre ${tenant.data?.periodo_atual ?? ''}`} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EventosOficiais escopo="curso" titulo="Datas do curso" />
        <Cartao titulo="De onde vem">
          <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">
            Horários, PTG, estágio, AACC e comunicados vêm das páginas que a coordenação já publica no site. Ninguém precisa digitar nada: a Yara confere de hora em hora e avisa só quem foi afetado.
          </p>
        </Cartao>
      </div>
    </div>
  )
}
