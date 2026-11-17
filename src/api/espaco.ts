// Espaço pessoal: materiais (e caixa de entrada), tarefas, revisão, avaliações, notas e frequência.

import type { Avaliacao, ColunaTarefa, Frequencia, ItemRevisao, Material, Nota, Tarefa } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

// ---------- Materiais ----------
export async function listarMateriais(filtro: { disciplinaId?: string; turmaId?: string; entrada?: boolean }): Promise<Material[]> {
  if (modoDemo) {
    return espera(
      demo.materiais
        .filter((m) => (filtro.entrada === undefined ? true : m.na_entrada === filtro.entrada))
        .filter((m) => !filtro.disciplinaId || m.disciplina_id === filtro.disciplinaId)
        .filter((m) => !filtro.turmaId || m.turma_id === filtro.turmaId)
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    )
  }
  let q = db().from('materiais').select('*').order('criado_em', { ascending: false })
  if (filtro.entrada !== undefined) q = q.eq('na_entrada', filtro.entrada)
  if (filtro.disciplinaId) q = q.eq('disciplina_id', filtro.disciplinaId)
  if (filtro.turmaId) q = q.eq('turma_id', filtro.turmaId)
  return ok(await q)
}

export type NovoMaterial = Pick<Material, 'tipo' | 'titulo'> & Partial<Omit<Material, 'id' | 'dono_id' | 'criado_em'>>

export async function criarMaterial(valores: NovoMaterial): Promise<Material> {
  if (modoDemo) {
    const m: Material = { na_entrada: false, status_revisao: 'estudar_depois', oficial: false, ...valores, id: novoId('mt'), dono_id: demo.perfil.id, criado_em: new Date().toISOString() }
    demo.materiais.unshift(m)
    return espera(m, 60)
  }
  return ok(await db().from('materiais').insert(valores).select().single())
}

export async function atualizarMaterial(id: string, valores: Partial<Material>) {
  if (modoDemo) {
    Object.assign(demo.materiais.find((m) => m.id === id) ?? {}, valores)
    return
  }
  ok(await db().from('materiais').update(valores).eq('id', id))
}

export async function apagarMaterial(id: string) {
  if (modoDemo) {
    demo.materiais = demo.materiais.filter((m) => m.id !== id)
    return
  }
  ok(await db().from('materiais').delete().eq('id', id))
}

/** Pede à Edge Function uma URL pré-assinada do R2 e envia o arquivo direto para lá. */
export async function enviarArquivo(arquivo: File, aoProgredir?: (pct: number) => void): Promise<{ chave: string }> {
  if (modoDemo) {
    for (const p of [25, 60, 100]) {
      await new Promise((r) => setTimeout(r, 150))
      aoProgredir?.(p)
    }
    return { chave: `demo/${arquivo.name}` }
  }
  const { data, error } = await db().functions.invoke('r2-upload-url', {
    body: { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size },
  })
  if (error) throw error
  const { url, chave } = data as { url: string; chave: string }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Falha no envio do arquivo.')))
    xhr.onerror = () => reject(new Error('Sem conexão para enviar o arquivo.'))
    xhr.send(arquivo)
  })
  return { chave }
}

export async function linkDoArquivo(chave: string): Promise<string> {
  if (modoDemo) return '#'
  const { data, error } = await db().functions.invoke('r2-download-url', { body: { chave } })
  if (error) throw error
  return (data as { url: string }).url
}

// ---------- Tarefas ----------
export async function listarTarefas(): Promise<Tarefa[]> {
  if (modoDemo) return espera([...demo.tarefas].sort((a, b) => a.ordem - b.ordem))
  return ok(await db().from('tarefas').select('*').order('ordem'))
}

export async function criarTarefa(valores: Pick<Tarefa, 'titulo'> & Partial<Tarefa>): Promise<Tarefa> {
  if (modoDemo) {
    const t: Tarefa = { coluna: 'a_fazer', ordem: Date.now(), subtarefas: [], ...valores, id: novoId('tk'), usuario_id: demo.perfil.id, criado_em: new Date().toISOString() }
    demo.tarefas.push(t)
    return espera(t, 60)
  }
  return ok(await db().from('tarefas').insert({ ordem: Date.now(), ...valores }).select().single())
}

export async function atualizarTarefa(id: string, valores: Partial<Tarefa>) {
  if (modoDemo) {
    Object.assign(demo.tarefas.find((t) => t.id === id) ?? {}, valores)
    return
  }
  ok(await db().from('tarefas').update(valores).eq('id', id))
}

export async function moverTarefa(id: string, coluna: ColunaTarefa) {
  return atualizarTarefa(id, { coluna, ordem: Date.now() })
}

export async function apagarTarefa(id: string) {
  if (modoDemo) {
    demo.tarefas = demo.tarefas.filter((t) => t.id !== id)
    return
  }
  ok(await db().from('tarefas').delete().eq('id', id))
}

// ---------- Revisão espaçada (SM-2 simplificado) ----------
export async function listarRevisao(): Promise<ItemRevisao[]> {
  if (modoDemo) return espera([...demo.revisao].sort((a, b) => a.proxima_em.localeCompare(b.proxima_em)))
  return ok(await db().from('revisao_itens').select('*').order('proxima_em'))
}

export async function criarItemRevisao(valores: Pick<ItemRevisao, 'pergunta'> & Partial<ItemRevisao>) {
  if (modoDemo) {
    demo.revisao.push({ intervalo_dias: 1, facilidade: 2.5, repeticoes: 0, proxima_em: new Date().toISOString().slice(0, 10), ...valores, id: novoId('rv'), usuario_id: demo.perfil.id })
    return
  }
  ok(await db().from('revisao_itens').insert(valores))
}

/** qualidade: 0 = esqueci, 1 = difícil, 2 = lembrei, 3 = fácil */
export function proximaRevisao(item: ItemRevisao, qualidade: 0 | 1 | 2 | 3) {
  const q = [1, 3, 4, 5][qualidade]
  const facilidade = Math.max(1.3, item.facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  const repeticoes = qualidade === 0 ? 0 : item.repeticoes + 1
  const intervalo = qualidade === 0 ? 1 : repeticoes === 1 ? 1 : repeticoes === 2 ? 3 : Math.round(item.intervalo_dias * facilidade)
  const d = new Date()
  d.setDate(d.getDate() + intervalo)
  return { facilidade: Number(facilidade.toFixed(2)), repeticoes, intervalo_dias: intervalo, proxima_em: d.toISOString().slice(0, 10) }
}

export async function responderRevisao(item: ItemRevisao, qualidade: 0 | 1 | 2 | 3) {
  const novo = proximaRevisao(item, qualidade)
  if (modoDemo) {
    Object.assign(demo.revisao.find((r) => r.id === item.id) ?? {}, novo)
    return
  }
  ok(await db().from('revisao_itens').update(novo).eq('id', item.id))
}

export async function apagarItemRevisao(id: string) {
  if (modoDemo) {
    demo.revisao = demo.revisao.filter((r) => r.id !== id)
    return
  }
  ok(await db().from('revisao_itens').delete().eq('id', id))
}

// ---------- Notas e faltas ----------
export async function avaliacoesDasTurmas(turmaIds: string[]): Promise<Avaliacao[]> {
  if (!turmaIds.length) return []
  if (modoDemo) return espera(demo.avaliacoes.filter((a) => turmaIds.includes(a.turma_id)))
  return ok(await db().from('avaliacoes').select('*').in('turma_id', turmaIds).order('data', { nullsFirst: false }))
}

export async function criarAvaliacao(valores: Pick<Avaliacao, 'turma_id' | 'nome' | 'peso'>) {
  if (modoDemo) {
    demo.avaliacoes.push({ ...valores, id: novoId('av') })
    return
  }
  ok(await db().from('avaliacoes').insert(valores))
}

export async function apagarAvaliacao(id: string) {
  if (modoDemo) {
    demo.avaliacoes = demo.avaliacoes.filter((a) => a.id !== id)
    return
  }
  ok(await db().from('avaliacoes').delete().eq('id', id))
}

export async function minhasNotas(): Promise<Nota[]> {
  if (modoDemo) return espera(demo.notas)
  return ok(await db().from('notas').select('*').eq('usuario_id', await meuId()))
}

export async function salvarNota(avaliacaoId: string, valor: number | null) {
  if (modoDemo) {
    demo.notas = demo.notas.filter((n) => n.avaliacao_id !== avaliacaoId)
    demo.notas.push({ usuario_id: demo.perfil.id, avaliacao_id: avaliacaoId, valor })
    return
  }
  ok(await db().from('notas').upsert({ usuario_id: await meuId(), avaliacao_id: avaliacaoId, valor }))
}

export async function minhaFrequencia(): Promise<Frequencia[]> {
  if (modoDemo) return espera(demo.frequencia)
  return ok(await db().from('frequencia').select('*').eq('usuario_id', await meuId()))
}

export async function marcarPresenca(turmaId: string, data: string, presente: boolean, aulas: number) {
  if (modoDemo) {
    demo.frequencia = demo.frequencia.filter((f) => !(f.turma_id === turmaId && f.data === data))
    demo.frequencia.push({ usuario_id: demo.perfil.id, turma_id: turmaId, data, presente, aulas })
    return
  }
  ok(await db().from('frequencia').upsert({ usuario_id: await meuId(), turma_id: turmaId, data, presente, aulas }))
}
