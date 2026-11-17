// Id do usuário logado disponível sem await (para comparar votos e autoria na tela).
import { supabase, supabaseConfigurado } from './supabase'
import { DEMO_ID } from '@/api/demo'

let atual: string | null = supabaseConfigurado ? null : DEMO_ID

if (supabase) {
  supabase.auth.getSession().then(({ data }) => (atual = data.session?.user.id ?? null))
  supabase.auth.onAuthStateChange((_e, s) => (atual = s?.user.id ?? null))
}

export function meuIdSincrono() {
  return atual
}
