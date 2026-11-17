// Painel admin: contas e papéis, fontes monitoradas, curadoria do Archie e números gerais.

import type { Fonte, ItemCuradoria, Papel, Perfil, UltimaCaptura, ArchieStatus } from '@/types'
import { db, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

export async function listarContas(): Promise<Perfil[]> {
  if (modoDemo) {
    return espera([
      demo.perfil,
      ...demo.pessoas
        .filter((p) => p.id !== demo.perfil.id)
        .map((p, i) => ({ ...demo.perfil, id: p.id, nome: p.nome, papel: p.papel, quer_ser_professor: i === 0, email: p.nome.toLowerCase().split(' ').join('.').normalize('NFD').replace(/[̀-ͯ]/g, '') + (p.papel === 'professor' ? '@fatec.sp.gov.br' : '@aluno.cps.sp.gov.br') })),
    ])
  }
  return ok(await db().from('perfis').select('*').order('criado_em', { ascending: false }))
}

export async function mudarPapel(id: string, papel: Papel) {
  if (modoDemo) {
    Object.assign(demo.pessoas.find((p) => p.id === id) ?? {}, { papel })
    return
  }
  ok(await db().from('perfis').update({ papel, quer_ser_professor: false }).eq('id', id))
}

export async function listarFontes(): Promise<Fonte[]> {
  if (modoDemo) return espera(demo.fontes)
  return ok(await db().from('fontes').select('*').order('nome'))
}

export async function salvarFonte(f: Partial<Fonte> & Pick<Fonte, 'nome' | 'url' | 'tipo' | 'frequencia_min' | 'extrator'>) {
  if (modoDemo) {
    if (f.id) Object.assign(demo.fontes.find((x) => x.id === f.id) ?? {}, f)
    else demo.fontes.push({ status: 'ativa', tenant_id: demo.tenant.id, ...f, id: novoId('f') })
    return
  }
  if (f.id) ok(await db().from('fontes').update(f).eq('id', f.id))
  else ok(await db().from('fontes').insert({ ...f, tenant_id: (await db().from('tenants').select('id').single()).data?.id }))
}

export async function apagarFonte(id: string) {
  if (modoDemo) {
    demo.fontes = demo.fontes.filter((f) => f.id !== id)
    return
  }
  ok(await db().from('fontes').delete().eq('id', id))
}

export async function numerosGerais() {
  if (modoDemo) return espera({ contas: demo.pessoas.length, turmas: demo.turmas.length, eventos: demo.eventos.length, propostasAbertas: demo.propostas.filter((p) => p.status === 'nao_confirmado').length, fontes: demo.fontes.length, paraRevisar: demo.curadoria.filter((c) => !c.decisao).length })
  const contar = async (t: string, filtro?: [string, string]) => {
    let q = db().from(t).select('*', { count: 'exact', head: true })
    if (filtro) q = q.eq(filtro[0], filtro[1])
    return (await q).count ?? 0
  }
  const [contas, turmas, eventos, propostasAbertas, fontes, paraRevisar] = await Promise.all([
    contar('perfis'), contar('turmas'), contar('eventos'), contar('propostas', ['status', 'nao_confirmado']), contar('fontes'),
    db().from('curadoria').select('*', { count: 'exact', head: true }).is('decisao', null).then((r) => r.count ?? 0),
  ])
  return { contas, turmas, eventos, propostasAbertas, fontes, paraRevisar }
}

export async function todasAsTurmas() {
  if (modoDemo) return espera(demo.turmas.map((t) => ({ ...t, disciplina: demo.disciplinas.find((d) => d.id === t.disciplina_id)! })))
  return ok(await db().from('turmas').select('*, disciplina:disciplinas(*)').order('periodo_letivo', { ascending: false })) as (import('@/types').Turma & { disciplina: import('@/types').Disciplina })[]
}

export async function definirProfessor(turmaId: string, perfilId: string | null, nome?: string) {
  if (modoDemo) {
    Object.assign(demo.turmas.find((t) => t.id === turmaId) ?? {}, { professor_id: perfilId, ...(nome ? { professor_nome: nome } : {}) })
    return
  }
  ok(await db().from('turmas').update({ professor_id: perfilId, ...(nome ? { professor_nome: nome } : {}) }).eq('id', turmaId))
}

export async function atualizarTurma(turmaId: string, valores: { tamanho_real?: number | null }) {
  if (modoDemo) {
    Object.assign(demo.turmas.find((t) => t.id === turmaId) ?? {}, valores)
    return
  }
  ok(await db().from('turmas').update(valores).eq('id', turmaId))
}

// ---------------- Archie (Fase 5) ----------------

/** Pede ao worker para visitar a fonte agora (entra na fila; roda quando o worker estiver no ar). */
export async function pedirColeta(fonteId: string) {
  if (modoDemo) {
    Object.assign(demo.fontes.find((f) => f.id === fonteId) ?? {}, { ultima_verificacao: new Date().toISOString(), status: 'ativa', ultimo_erro: null })
    return espera(null, 600)
  }
  ok(await db().rpc('archie_pedir_coleta', { p_fonte: fonteId }))
}

export async function ultimasCapturas(): Promise<UltimaCaptura[]> {
  if (modoDemo) return espera(demo.capturas)
  return ok(await db().from('ultimas_capturas').select('*'))
}

/** pendentes = esperando o admin; historico = o que já foi decidido (inclui o que o Archie aplicou sozinho). */
export async function listarCuradoria(qual: 'pendentes' | 'historico'): Promise<ItemCuradoria[]> {
  if (modoDemo) return espera(demo.curadoria.filter((c) => (qual === 'pendentes' ? !c.decisao : !!c.decisao)))
  let q = db().from('curadoria').select('*')
  q = qual === 'pendentes' ? q.is('decisao', null).order('criado_em', { ascending: true }) : q.not('decisao', 'is', null).order('decidido_em', { ascending: false }).limit(40)
  return ok(await q)
}

export async function decidirCuradoria(ids: string[], aprovar: boolean) {
  if (modoDemo) {
    for (const id of ids) Object.assign(demo.curadoria.find((c) => c.id === id) ?? {}, { decisao: aprovar ? 'aprovado' : 'rejeitado', decidido_por: demo.perfil.id, decidido_em: new Date().toISOString() })
    return espera(null)
  }
  // Um por vez: cada aprovação aplica a mudança no banco e fica na auditoria.
  for (const id of ids) ok(await db().rpc('decidir_curadoria', { p_id: id, p_aprovar: aprovar }))
}

export async function statusArchie(): Promise<ArchieStatus[]> {
  if (modoDemo) return espera(demo.archieStatus)
  return ok(await db().from('archie_status').select('*').order('ultimo_sinal', { ascending: false }))
}
