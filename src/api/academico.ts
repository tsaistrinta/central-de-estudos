// Estrutura acadêmica: tenant, cursos, disciplinas, turmas, matrículas, horários e pessoas.

import type { AulaHorario, Curso, Disciplina, MinhaTurma, PedidoPendente, PedidoTurma, Pessoa, Tenant, Turma, Turno } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

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

/** Turmas oferecidas no período atual, de todos os semestres (primeiro acesso e "Adicionar matéria"). */
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

// ---------- Entrada nas turmas ----------
// Ninguém se matricula sozinho: ou digita o código que o professor passou, ou pede e o professor (ou o admin) aprova.

const ERROS_ENTRADA: Record<string, string> = {
  codigo_invalido: 'Código não encontrado. Confira com o professor.',
  tentativas_demais: 'Muitas tentativas erradas. Espere uma hora e tente de novo.',
  pedidos_demais: 'Você já tem muitos pedidos esperando resposta.',
  turma_nao_encontrada: 'Turma não encontrada.',
  sem_permissao: 'Só o professor da turma ou o administrador pode fazer isso.',
  pedido_nao_encontrado: 'Esse pedido já foi respondido.',
}

/** Troca o código de erro do banco por uma frase para a tela. */
export function mensagemDeEntrada(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro)
  const chave = Object.keys(ERROS_ENTRADA).find((k) => texto.includes(k))
  return chave ? ERROS_ENTRADA[chave] : 'Não deu certo agora. Tente de novo.'
}

export async function pedirEntrada(turmaId: string, mensagem?: string): Promise<'pendente' | 'ja_na_turma'> {
  if (modoDemo) {
    if (demo.matriculas.some((m) => m.turma_id === turmaId)) return 'ja_na_turma'
    if (!demo.pedidos.some((p) => p.turma_id === turmaId && p.usuario_id === demo.perfil.id && p.status === 'pendente')) {
      demo.pedidos.push({ id: novoId('pd'), turma_id: turmaId, usuario_id: demo.perfil.id, mensagem: mensagem ?? null, status: 'pendente', criado_em: new Date().toISOString(), decidido_em: null })
    }
    return espera('pendente' as const)
  }
  return ok(await db().rpc('pedir_entrada', { p_turma: turmaId, p_mensagem: mensagem ?? null })) as 'pendente' | 'ja_na_turma'
}

export async function entrarComCodigo(codigo: string): Promise<string> {
  if (modoDemo) {
    const turma = Object.entries(demo.codigos).find(([, c]) => c === codigo.trim().toUpperCase())?.[0]
    if (!turma) throw new Error('codigo_invalido')
    if (!demo.matriculas.some((m) => m.turma_id === turma)) demo.matriculas.push({ usuario_id: demo.perfil.id, turma_id: turma, papel_turma: 'aluno' })
    demo.pedidos = demo.pedidos.map((p) => (p.turma_id === turma && p.usuario_id === demo.perfil.id && p.status === 'pendente' ? { ...p, status: 'aprovado' } : p))
    return espera(turma)
  }
  return ok(await db().rpc('entrar_com_codigo', { p_codigo: codigo }))
}

export async function meusPedidos(): Promise<PedidoTurma[]> {
  if (modoDemo) return espera(demo.pedidos.filter((p) => p.usuario_id === demo.perfil.id && p.status === 'pendente'))
  return ok(await db().from('pedidos_turma').select('*').eq('usuario_id', await meuId()).eq('status', 'pendente').order('criado_em'))
}

export async function cancelarPedido(id: string) {
  if (modoDemo) {
    demo.pedidos = demo.pedidos.map((p) => (p.id === id ? { ...p, status: 'cancelado' } : p))
    return
  }
  ok(await db().rpc('cancelar_pedido', { p_id: id }))
}

/** Pedidos que eu posso aprovar (professor da turma ou admin). Com turmaId, só os daquela turma. */
export async function pedidosParaAprovar(turmaId?: string): Promise<PedidoPendente[]> {
  if (modoDemo) {
    const nomes = new Map(demo.pessoas.map((p) => [p.id, p.nome]))
    return espera(
      demo.pedidos
        .filter((p) => p.status === 'pendente' && p.usuario_id !== demo.perfil.id && (!turmaId || p.turma_id === turmaId))
        .map((p) => {
          const t = demo.turmas.find((x) => x.id === p.turma_id)!
          const d = demo.disciplinas.find((x) => x.id === t.disciplina_id)!
          const nome = nomes.get(p.usuario_id) ?? 'Aluno'
          return { ...p, nome, email: nome.toLowerCase().split(' ')[0] + '@aluno.cps.sp.gov.br', disciplina: d.nome, semestre_matriz: d.semestre_matriz ?? null, turno: t.turno }
        }),
    )
  }
  const lista = ok(await db().rpc('pedidos_pendentes')) as PedidoPendente[]
  return turmaId ? lista.filter((p) => p.turma_id === turmaId) : lista
}

export async function decidirPedido(id: string, aprovar: boolean) {
  if (modoDemo) {
    const p = demo.pedidos.find((x) => x.id === id)
    if (p) {
      p.status = aprovar ? 'aprovado' : 'recusado'
      if (aprovar && p.usuario_id === demo.perfil.id) demo.matriculas.push({ usuario_id: p.usuario_id, turma_id: p.turma_id, papel_turma: 'aluno' })
    }
    return
  }
  ok(await db().rpc('decidir_pedido', { p_id: id, p_aprovar: aprovar }))
}

/** Código de entrada da turma (só professor da turma e admin enxergam). */
export async function codigoDaTurma(turmaId: string): Promise<string | null> {
  if (modoDemo) return espera(demo.codigos[turmaId] ?? null)
  const linha = ok(await db().from('turma_codigos').select('codigo').eq('turma_id', turmaId).maybeSingle()) as { codigo: string } | null
  return linha?.codigo ?? null
}

export async function gerarCodigo(turmaId: string): Promise<string> {
  if (modoDemo) {
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    demo.codigos[turmaId] = Array.from({ length: 6 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('')
    return espera(demo.codigos[turmaId])
  }
  return ok(await db().rpc('gerar_codigo_turma', { p_turma: turmaId }))
}

export async function apagarCodigo(turmaId: string) {
  if (modoDemo) {
    delete demo.codigos[turmaId]
    return
  }
  ok(await db().rpc('apagar_codigo_turma', { p_turma: turmaId }))
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
