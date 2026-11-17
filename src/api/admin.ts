// Painel admin: contas e papéis, fontes monitoradas e números gerais.

import type { Fonte, Papel, Perfil } from '@/types'
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

export async function salvarFonte(f: Partial<Fonte> & Pick<Fonte, 'nome' | 'url' | 'tipo' | 'frequencia_min'>) {
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
  if (modoDemo) return espera({ contas: demo.pessoas.length, turmas: demo.turmas.length, eventos: demo.eventos.length, propostasAbertas: demo.propostas.filter((p) => p.status === 'nao_confirmado').length, fontes: demo.fontes.length })
  const contar = async (t: string, filtro?: [string, string]) => {
    let q = db().from(t).select('*', { count: 'exact', head: true })
    if (filtro) q = q.eq(filtro[0], filtro[1])
    return (await q).count ?? 0
  }
  const [contas, turmas, eventos, propostasAbertas, fontes] = await Promise.all([
    contar('perfis'), contar('turmas'), contar('eventos'), contar('propostas', ['status', 'nao_confirmado']), contar('fontes'),
  ])
  return { contas, turmas, eventos, propostasAbertas, fontes }
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
