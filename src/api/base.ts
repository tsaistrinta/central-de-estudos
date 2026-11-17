// Base do adaptador de dados: as telas chamam src/api/*, nunca o Supabase direto.
// Sem .env.local (modo demonstração) tudo é atendido por ./demo.ts, na memória.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { DEMO_ID } from './demo'

export const modoDemo = !supabaseConfigurado

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

/** Lança o erro do Supabase ou devolve os dados. */
export function ok<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

let idCache: string | null = null
export async function meuId(): Promise<string> {
  if (modoDemo) return DEMO_ID
  if (idCache) return idCache
  const { data } = await db().auth.getUser()
  if (!data.user) throw new Error('Você precisa entrar.')
  idCache = data.user.id
  return idCache
}

export function esquecerUsuario() {
  idCache = null
}
