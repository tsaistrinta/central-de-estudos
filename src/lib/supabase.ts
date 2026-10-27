import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando as variáveis VITE_SUPABASE_* estão preenchidas no .env.local */
export const supabaseConfigurado = Boolean(url && anonKey)

/**
 * Cliente do Supabase. É `null` enquanto o projeto não estiver configurado,
 * para o app rodar (telas e navegação) mesmo antes de conectarmos o backend.
 */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url as string, anonKey as string)
  : null

if (!supabaseConfigurado && import.meta.env.DEV) {
  console.warn(
    '[Central de Estudos] Supabase ainda não configurado. ' +
      'Crie um .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  )
}
