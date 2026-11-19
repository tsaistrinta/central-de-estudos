// Acervo permanente da disciplina: materiais que ficam para os próximos semestres.
// Todo envio entra "em análise" e só aparece depois que o Archie verifica (ou o admin libera).

import type { ItemAcervo, ItemQuarentena, TipoAcervo } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

export type NovoItemAcervo = {
  disciplina_id: string
  tipo: TipoAcervo
  titulo: string
  descricao?: string | null
  periodo_origem?: string | null
  link_url?: string | null
  arquivo_chave?: string | null
  arquivo_nome?: string | null
  arquivo_tamanho?: number | null
  arquivo_mime?: string | null
}

/** Publicados da disciplina + os meus (em qualquer estado). */
export async function listarAcervo(disciplinaId: string): Promise<ItemAcervo[]> {
  if (modoDemo) {
    return espera(
      demo.acervo
        .filter((i) => i.disciplina_id === disciplinaId && (i.status === 'publicado' || i.autor_id === demo.perfil.id))
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    )
  }
  const eu = await meuId()
  return ok(
    await db()
      .from('acervo_itens')
      .select('*')
      .eq('disciplina_id', disciplinaId)
      .or(`status.eq.publicado,autor_id.eq.${eu}`)
      .neq('status', 'removido')
      .order('criado_em', { ascending: false }),
  )
}

export async function enviarAoAcervo(item: NovoItemAcervo): Promise<ItemAcervo> {
  if (modoDemo) {
    const novo: ItemAcervo = {
      descricao: null, periodo_origem: null, link_url: null, arquivo_chave: null, arquivo_nome: null, arquivo_tamanho: null, arquivo_mime: null,
      ...item, id: novoId('ac'), autor_id: demo.perfil.id, status: 'em_analise', moderacao: null, moderado_em: null, criado_em: new Date().toISOString(),
    }
    demo.acervo.unshift(novo)
    // Na demonstração o "Archie" aprova em alguns segundos.
    setTimeout(() => {
      const i = demo.acervo.find((x) => x.id === novo.id)
      if (i) Object.assign(i, { status: 'publicado', moderado_em: new Date().toISOString(), moderacao: { motivo: 'Conteúdo acadêmico da disciplina.', confianca: 0.9, origem: 'archie' } })
    }, 4000)
    return espera(novo)
  }
  return ok(await db().from('acervo_itens').insert(item).select().single())
}

export async function apagarDoAcervo(id: string) {
  if (modoDemo) {
    demo.acervo = demo.acervo.filter((i) => i.id !== id)
    return
  }
  ok(await db().from('acervo_itens').delete().eq('id', id))
}

export async function denunciar(id: string, motivo: string) {
  if (modoDemo) return espera(undefined)
  ok(await db().from('acervo_denuncias').insert({ item_id: id, motivo }))
}

// ---------- Admin ----------
export async function listarQuarentena(): Promise<ItemQuarentena[]> {
  if (modoDemo) {
    const nomes = new Map(demo.pessoas.map((p) => [p.id, p.nome]))
    return espera(
      demo.acervo
        .filter((i) => i.status === 'quarentena' || i.status === 'em_analise')
        .map(({ disciplina_id, ...item }) => {
          const { periodo_origem, ...i } = item
          void periodo_origem
          const nome = nomes.get(i.autor_id) ?? 'Aluno'
          return {
            ...i,
            disciplina: demo.disciplinas.find((d) => d.id === disciplina_id)?.nome ?? '',
            autor_nome: nome,
            autor_email: nome.toLowerCase().split(' ')[0] + '@aluno.cps.sp.gov.br',
            autor_curso: 'Análise e Desenvolvimento de Sistemas',
            autor_semestre: 3,
            autor_envios: 4,
            autor_retidos: 1,
            denuncias: 0,
          }
        }),
    )
  }
  return ok(await db().rpc('listar_quarentena'))
}

export async function decidirQuarentena(id: string, publicar: boolean, nota?: string) {
  if (modoDemo) {
    Object.assign(demo.acervo.find((i) => i.id === id) ?? {}, { status: publicar ? 'publicado' : 'removido' })
    return
  }
  ok(await db().rpc('decidir_quarentena', { p_item: id, p_publicar: publicar, p_nota: nota ?? null }))
}

export async function contarQuarentena(): Promise<number> {
  if (modoDemo) return demo.acervo.filter((i) => i.status === 'quarentena').length
  const { count } = await db().from('acervo_itens').select('id', { count: 'exact', head: true }).eq('status', 'quarentena')
  return count ?? 0
}
