// Adaptador de entidades — isola o acesso a dados do Supabase do resto do app.
// Mesma ideia do SDK do Base44 (list/create/update/remove), mas apontando para
// o nosso Postgres. Enquanto o Supabase não estiver configurado, `list` devolve
// uma lista vazia para o app continuar funcionando.

import { supabase, supabaseConfigurado } from '../lib/supabase'
import type {
  Curso,
  Semestre,
  Materia,
  Material,
  Documento,
  GrupoDocumento,
  Evento,
  Etiqueta,
} from '../types'

type ComId = { id: string }

/** Ordenação padrão de `list()` para cada tabela. */
type Ordem<T> = { coluna: keyof T & string; crescente: boolean }

/** Campos preenchidos pelo banco: `usuario_id` vem do `default auth.uid()`. */
type NovosValores<T> = Partial<Omit<T, 'id' | 'usuario_id'>>

function entidade<T extends ComId>(tabela: string, ordem: Ordem<T>) {
  function cliente() {
    if (!supabase) throw new Error('Supabase não configurado.')
    return supabase
  }

  return {
    async list(opcoes: { limite?: number; pagina?: number } = {}): Promise<T[]> {
      if (!supabaseConfigurado || !supabase) return []
      const { limite = 100, pagina = 0 } = opcoes
      const inicio = pagina * limite
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .order(ordem.coluna, { ascending: ordem.crescente })
        .range(inicio, inicio + limite - 1)
      if (error) throw error
      return (data ?? []) as T[]
    },

    async create(valores: NovosValores<T>): Promise<T> {
      const db = cliente()
      const {
        data: { user },
      } = await db.auth.getUser()
      if (!user) throw new Error('Você precisa entrar para salvar.')
      const { data, error } = await db.from(tabela).insert(valores as Record<string, unknown>).select().single()
      if (error) throw error
      return data as T
    },

    async update(id: string, valores: NovosValores<T>): Promise<T> {
      const { data, error } = await cliente()
        .from(tabela)
        .update(valores as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as T
    },

    async remove(id: string): Promise<void> {
      const { error } = await cliente().from(tabela).delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const Cursos = entidade<Curso>('cursos', { coluna: 'ordem', crescente: true })
export const Semestres = entidade<Semestre>('semestres', { coluna: 'ordem', crescente: true })
export const Materias = entidade<Materia>('materias', { coluna: 'nome', crescente: true })
export const Materiais = entidade<Material>('materiais', { coluna: 'criado_em', crescente: false })
export const Documentos = entidade<Documento>('documentos', { coluna: 'editado_em', crescente: false })
export const GruposDocumento = entidade<GrupoDocumento>('grupos_documento', { coluna: 'nome', crescente: true })
export const Eventos = entidade<Evento>('eventos', { coluna: 'data', crescente: true })
export const Etiquetas = entidade<Etiqueta>('etiquetas', { coluna: 'nome', crescente: true })
