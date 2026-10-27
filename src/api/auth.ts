// Autenticação e perfil — mesma regra do adaptador de entidades:
// as telas chamam estas funções, nunca o Supabase direto.

import type { AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'

export type ProvedorSocial = 'google' | 'azure'

function cliente() {
  if (!supabase) throw new Error('Supabase não configurado. Preencha o .env.local.')
  return supabase
}

const mensagens: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Procure o link na caixa de entrada.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  validation_failed: 'Confira os dados informados.',
}

/** Traduz erros do Supabase Auth para mensagens em português. */
export function mensagemDeErro(erro: unknown): string {
  const e = erro as Partial<AuthError> | undefined
  if (e?.code && mensagens[e.code]) return mensagens[e.code]
  if (e?.message === 'Failed to fetch') return 'Sem conexão com o servidor. Tente de novo.'
  return e?.message ?? 'Algo deu errado. Tente de novo.'
}

async function falharSeErro<T extends { error: AuthError | null }>(promessa: Promise<T>): Promise<T> {
  const resultado = await promessa
  if (resultado.error) throw resultado.error
  return resultado
}

export async function entrarComEmail(email: string, senha: string) {
  await falharSeErro(cliente().auth.signInWithPassword({ email, password: senha }))
}

export async function entrarComProvedor(provedor: ProvedorSocial) {
  await falharSeErro(
    cliente().auth.signInWithOAuth({
      provider: provedor,
      options: {
        redirectTo: window.location.origin,
        // A Microsoft só devolve o e-mail se ele for pedido explicitamente.
        scopes: provedor === 'azure' ? 'email' : undefined,
      },
    }),
  )
}

/** Cria a conta. Devolve `true` quando o Supabase exige confirmação por e-mail. */
export async function criarConta(nome: string, email: string, senha: string): Promise<boolean> {
  const { data } = await falharSeErro(
    cliente().auth.signUp({
      email,
      password: senha,
      options: { data: { nome }, emailRedirectTo: window.location.origin },
    }),
  )
  return !data.session
}

export async function enviarLinkDeRecuperacao(email: string) {
  await falharSeErro(
    cliente().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    }),
  )
}

export async function redefinirSenha(novaSenha: string) {
  await falharSeErro(cliente().auth.updateUser({ password: novaSenha }))
}

export async function sair() {
  await falharSeErro(cliente().auth.signOut())
}

export async function obterPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await cliente().from('perfis').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Perfil | null
}

export async function atualizarPerfil(id: string, valores: Partial<Omit<Perfil, 'id' | 'criado_em'>>) {
  const { data, error } = await cliente().from('perfis').update(valores).eq('id', id).select().single()
  if (error) throw error
  return data as Perfil
}

export async function definirSemestreAtual(semestreId: string) {
  const { error } = await cliente().rpc('definir_semestre_atual', { semestre: semestreId })
  if (error) throw error
}
