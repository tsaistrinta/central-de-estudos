// Comunidade: conversa, dúvidas, reações e validação coletiva (propostas e votos).

import type { Duvida, Mensagem, Proposta, Reacao, Resposta, StatusInfo, Voto } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

// ---------- Conversa ----------
export async function listarMensagens(turmaId: string, canal: string): Promise<Mensagem[]> {
  if (modoDemo) return espera(demo.mensagens.filter((m) => m.turma_id === turmaId && m.canal === canal))
  return ok(await db().from('mensagens').select('*').eq('turma_id', turmaId).eq('canal', canal).order('criado_em').limit(200))
}

export async function enviarMensagem(turmaId: string, canal: string, texto: string) {
  if (modoDemo) {
    demo.mensagens.push({ id: novoId('m'), turma_id: turmaId, canal, autor_id: demo.perfil.id, texto, fixada: false, criado_em: new Date().toISOString() })
    return
  }
  ok(await db().from('mensagens').insert({ turma_id: turmaId, canal, texto }))
}

/** Tempo real: mensagens, votos, propostas e reações da turma. */
export function ouvirTurma(turmaId: string, aoMudar: (tabela: string) => void): () => void {
  if (modoDemo) return () => {}
  const canal = db().channel(`turma-${turmaId}`)
  for (const tabela of ['mensagens', 'propostas', 'reacoes', 'respostas']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: tabela === 'respostas' ? undefined : `turma_id=eq.${turmaId}` }, () => aoMudar(tabela))
  }
  canal.on('postgres_changes', { event: '*', schema: 'public', table: 'votos' }, () => aoMudar('votos'))
  canal.subscribe()
  return () => {
    db().removeChannel(canal)
  }
}

// ---------- Reações (um só componente em todo lugar) ----------
export async function reacoesDe(alvoIds: string[]): Promise<Reacao[]> {
  if (!alvoIds.length) return []
  if (modoDemo) return espera(demo.reacoes.filter((r) => alvoIds.includes(r.alvo_id)))
  return ok(await db().from('reacoes').select('alvo_tipo, alvo_id, usuario_id, emoji').in('alvo_id', alvoIds))
}

export async function alternarReacao(alvo: Pick<Reacao, 'alvo_tipo' | 'alvo_id'>, emoji: string, turmaId?: string) {
  const eu = await meuId()
  if (modoDemo) {
    const i = demo.reacoes.findIndex((r) => r.alvo_id === alvo.alvo_id && r.emoji === emoji && r.usuario_id === eu)
    if (i >= 0) demo.reacoes.splice(i, 1)
    else demo.reacoes.push({ ...alvo, emoji, usuario_id: eu })
    return
  }
  const existe = ok(await db().from('reacoes').select('emoji').match({ ...alvo, emoji, usuario_id: eu }).maybeSingle())
  if (existe) ok(await db().from('reacoes').delete().match({ ...alvo, emoji, usuario_id: eu }))
  else ok(await db().from('reacoes').insert({ ...alvo, emoji, turma_id: turmaId ?? null }))
}

// ---------- Dúvidas ----------
export async function listarDuvidas(turmaId: string): Promise<(Duvida & { respostas: Resposta[] })[]> {
  if (modoDemo) {
    return espera(
      demo.duvidas
        .filter((d) => d.turma_id === turmaId)
        .map((d) => ({ ...d, respostas: demo.respostas.filter((r) => r.duvida_id === d.id) }))
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    )
  }
  return ok(await db().from('duvidas').select('*, respostas(*)').eq('turma_id', turmaId).order('criado_em', { ascending: false }))
}

export async function perguntar(turmaId: string, texto: string) {
  if (modoDemo) {
    demo.duvidas.push({ id: novoId('dv'), turma_id: turmaId, autor_id: demo.perfil.id, texto, resolvida: false, criado_em: new Date().toISOString() })
    return
  }
  ok(await db().from('duvidas').insert({ turma_id: turmaId, texto }))
}

export async function responder(duvidaId: string, texto: string) {
  if (modoDemo) {
    demo.respostas.push({ id: novoId('r'), duvida_id: duvidaId, autor_id: demo.perfil.id, texto, fontes: [], confirmada_por: null, criado_em: new Date().toISOString() })
    return
  }
  ok(await db().from('respostas').insert({ duvida_id: duvidaId, texto }))
}

export async function marcarResolvida(duvidaId: string, resolvida: boolean) {
  if (modoDemo) {
    Object.assign(demo.duvidas.find((d) => d.id === duvidaId) ?? {}, { resolvida })
    return
  }
  ok(await db().from('duvidas').update({ resolvida }).eq('id', duvidaId))
}

// ---------- Validação coletiva ----------
export async function listarPropostas(turmaIds: string[], somenteAbertas = false): Promise<Proposta[]> {
  if (!turmaIds.length) return []
  if (modoDemo) {
    return espera(
      demo.propostas
        .filter((p) => turmaIds.includes(p.turma_id) && (!somenteAbertas || p.status === 'nao_confirmado'))
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    )
  }
  let q = db().from('propostas').select('*').in('turma_id', turmaIds).order('criado_em', { ascending: false })
  if (somenteAbertas) q = q.eq('status', 'nao_confirmado')
  return ok(await q)
}

export async function criarProposta(valores: Pick<Proposta, 'turma_id' | 'tipo' | 'titulo' | 'dados'> & Partial<Proposta>) {
  if (modoDemo) {
    demo.propostas.unshift({
      origem: 'turma',
      status: 'nao_confirmado',
      ...valores,
      id: novoId('pr'),
      criado_por: demo.perfil.id,
      criado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 72 * 36e5).toISOString(),
    })
    return
  }
  ok(await db().from('propostas').insert({ ...valores, criado_por: await meuId() }))
}

export async function votosDe(propostaIds: string[]): Promise<Voto[]> {
  if (!propostaIds.length) return []
  if (modoDemo) return espera(demo.votos.filter((v) => propostaIds.includes(v.proposta_id)))
  return ok(await db().from('votos').select('proposta_id, usuario_id, valor').in('proposta_id', propostaIds))
}

/** Base = vagas da turma ou, sem esse número, quem entrou. Igual a quorum_da_turma() no banco. */
export function quorum(tamanhoReal: number | null | undefined, membros: number) {
  return Math.max(5, Math.ceil((tamanhoReal ?? membros) * 0.25))
}

/** Mesma regra do banco, para a tela reagir na hora (o banco continua sendo quem decide). */
export function resultado(votos: Voto[], q: number): StatusInfo {
  const sim = votos.filter((v) => v.valor === 'sim').length
  const nao = votos.length - sim
  if (sim >= q && sim >= 0.8 * votos.length) return 'confirmado_turma'
  if (votos.length >= q && nao > 0.5 * votos.length) return 'descartado'
  return 'nao_confirmado'
}

export async function votar(proposta: Proposta, valor: 'sim' | 'nao' | null, q: number) {
  const eu = await meuId()
  if (modoDemo) {
    demo.votos = demo.votos.filter((v) => !(v.proposta_id === proposta.id && v.usuario_id === eu))
    if (valor) demo.votos.push({ proposta_id: proposta.id, usuario_id: eu, valor })
    const p = demo.propostas.find((x) => x.id === proposta.id)!
    const novo = resultado(demo.votos.filter((v) => v.proposta_id === proposta.id), q)
    if (novo !== 'nao_confirmado') {
      p.status = novo
      const alvo = demo.eventos.find((e) => e.id === p.alvo_evento_id)
      if (novo === 'confirmado_turma' && alvo && p.tipo === 'mudar_data') Object.assign(alvo, { inicio: p.dados.inicio ?? alvo.inicio, fim: p.dados.fim ?? alvo.fim, status: 'confirmado_turma' })
      if (novo === 'confirmado_turma' && alvo && p.tipo === 'cancelar') Object.assign(alvo, { cancelado: true, status: 'confirmado_turma' })
      if (novo === 'confirmado_turma' && p.tipo === 'novo_evento' && p.dados.inicio) {
        const t = demo.turmas.find((x) => x.id === p.turma_id)!
        demo.eventos.push({ id: novoId('e'), escopo: 'turma', escopo_id: p.turma_id, disciplina_id: t.disciplina_id, titulo: p.dados.titulo ?? p.titulo, tipo: p.dados.tipo ?? 'outro', inicio: p.dados.inicio, fim: p.dados.fim, local: p.dados.local, dia_todo: false, origem: 'turma', status: 'confirmado_turma', cancelado: !!p.dados.cancelado })
      }
    }
    return
  }
  if (valor === null) ok(await db().from('votos').delete().match({ proposta_id: proposta.id, usuario_id: eu }))
  else ok(await db().from('votos').upsert({ proposta_id: proposta.id, usuario_id: eu, valor }))
}

export async function fecharProposta(propostaId: string, aceitar: boolean) {
  if (modoDemo) {
    Object.assign(demo.propostas.find((p) => p.id === propostaId) ?? {}, { status: aceitar ? 'oficial' : 'descartado' })
    return
  }
  ok(await db().rpc('fechar_proposta', { p: propostaId, aceitar }))
}
