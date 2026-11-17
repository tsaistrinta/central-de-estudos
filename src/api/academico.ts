// Estrutura acadêmica: tenant, cursos, disciplinas, turmas, matrículas, horários e pessoas.

import type { AulaHorario, Curso, Disciplina, MinhaTurma, Pessoa, Tenant, Turma, Turno } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera } from './demo'

export async function tenantAtual(): Promise<Tenant | null> {
  if (modoDemo) return espera(demo.tenant)
  return ok(await db().from('tenants').select('*').maybeSingle())
}

export async function dominioPermitido(email: string): Promise<boolean> {
  if (modoDemo) return demo.tenant.dominios_permitidos.includes(email.split('@')[1]?.toLowerCase() ?? '')
  return ok(await db().rpc('dominio_permitido', { email }))
}

export async function listarCursos(): Promise<Curso[]> {
  if (modoDemo) return espera(demo.cursos)
  return ok(await db().from('cursos').select('*').order('nome'))
}

export type TurmaComDisciplina = Turma & { disciplina: Disciplina }

/** Turmas oferecidas no período atual (para o primeiro acesso e para entrar em outras). */
export async function turmasOferecidas(cursoId: string, turno?: Turno): Promise<TurmaComDisciplina[]> {
  if (modoDemo) {
    return espera(
      demo.turmas
        .filter((t) => !turno || t.turno === turno)
        .map((t) => ({ ...t, disciplina: demo.disciplinas.find((d) => d.id === t.disciplina_id)! }))
        .filter((t) => t.disciplina.curso_id === cursoId),
    )
  }
  const tenant = await tenantAtual()
  let q = db()
    .from('turmas')
    .select('*, disciplina:disciplinas!inner(*)')
    .eq('disciplina.curso_id', cursoId)
    .eq('periodo_letivo', tenant?.periodo_atual ?? '')
  if (turno) q = q.eq('turno', turno)
  return ok(await q) as TurmaComDisciplina[]
}

export async function minhasTurmas(): Promise<MinhaTurma[]> {
  if (modoDemo) {
    return espera(
      demo.matriculas.map((m) => {
        const t = demo.turmas.find((x) => x.id === m.turma_id)!
        return { ...t, papel_turma: m.papel_turma, disciplina: demo.disciplinas.find((d) => d.id === t.disciplina_id)! }
      }),
    )
  }
  const id = await meuId()
  const linhas = ok(
    await db().from('matriculas').select('papel_turma, turma:turmas(*, disciplina:disciplinas(*))').eq('usuario_id', id),
  ) as unknown as { papel_turma: MinhaTurma['papel_turma']; turma: TurmaComDisciplina }[]
  return linhas
    .map((l) => ({ ...l.turma, papel_turma: l.papel_turma }))
    .sort((a, b) => a.disciplina.nome.localeCompare(b.disciplina.nome))
}

export async function aulasDasTurmas(turmaIds: string[]): Promise<AulaHorario[]> {
  if (!turmaIds.length) return []
  if (modoDemo) return espera(demo.aulas.filter((a) => turmaIds.includes(a.turma_id)))
  return ok(await db().from('aulas_horario').select('*').in('turma_id', turmaIds))
}

export async function concluirOnboarding(cursoId: string, semestre: number, turno: Turno, turmaIds: string[]) {
  if (modoDemo) {
    demo.perfil.onboarding_concluido = true
    return
  }
  ok(await db().rpc('concluir_onboarding', { p_curso: cursoId, p_semestre: semestre, p_turno: turno, p_turmas: turmaIds }))
}

export async function entrarNaTurma(turmaId: string) {
  if (modoDemo) {
    if (!demo.matriculas.some((m) => m.turma_id === turmaId)) demo.matriculas.push({ usuario_id: demo.perfil.id, turma_id: turmaId, papel_turma: 'aluno' })
    return
  }
  ok(await db().from('matriculas').insert({ turma_id: turmaId }))
}

export async function sairDaTurma(turmaId: string) {
  if (modoDemo) {
    demo.matriculas = demo.matriculas.filter((m) => m.turma_id !== turmaId)
    return
  }
  ok(await db().from('matriculas').delete().eq('turma_id', turmaId).eq('usuario_id', await meuId()))
}

/** Nomes e papéis do tenant, para mostrar autores, votos e membros. */
export async function pessoas(): Promise<Map<string, Pessoa>> {
  const lista: Pessoa[] = modoDemo ? await espera(demo.pessoas) : ok(await db().from('pessoas').select('*'))
  return new Map(lista.map((p) => [p.id, p]))
}

export async function membrosDaTurma(turmaId: string): Promise<{ usuario_id: string; papel_turma: string }[]> {
  if (modoDemo) {
    const base = demo.pessoas.filter((p) => p.papel !== 'professor').map((p) => ({ usuario_id: p.id, papel_turma: p.papel === 'admin' ? 'aluno' : p.papel }))
    return espera(turmaId === 't-est' ? [...base, { usuario_id: 'p-carlos', papel_turma: 'professor' }] : base)
  }
  return ok(await db().from('matriculas').select('usuario_id, papel_turma').eq('turma_id', turmaId))
}
