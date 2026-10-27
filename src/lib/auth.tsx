import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from './supabase'
import { obterPerfil } from '../api/auth'
import type { Perfil } from '../types'

type EstadoAuth = {
  /** false = sem .env.local: o app roda em modo demonstração, sem login. */
  configurado: boolean
  carregando: boolean
  sessao: Session | null
  perfil: Perfil | null
  recarregarPerfil: () => Promise<void>
}

const AuthContext = createContext<EstadoAuth | null>(null)

async function buscarPerfil(id: string): Promise<Perfil | null> {
  try {
    return await obterPerfil(id)
  } catch (erro) {
    console.error('[Central de Estudos] Falha ao carregar o perfil.', erro)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessaoLida, setSessaoLida] = useState(!supabaseConfigurado)
  const [sessao, setSessao] = useState<Session | null>(null)
  // Guarda de qual usuário é o perfil carregado, para não mostrar dados de outra conta.
  const [perfil, setPerfil] = useState<{ de: string; dados: Perfil | null } | null>(null)

  const usuarioId = sessao?.user.id

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setSessaoLida(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao))
    return () => data.subscription.unsubscribe()
  }, [])

  const recarregarPerfil = useCallback(async () => {
    if (!usuarioId) return
    setPerfil({ de: usuarioId, dados: await buscarPerfil(usuarioId) })
  }, [usuarioId])

  // Busca o perfil sempre que o usuário logado muda (login, logout, troca de conta).
  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false
    buscarPerfil(usuarioId).then((dados) => {
      if (!cancelado) setPerfil({ de: usuarioId, dados })
    })
    return () => {
      cancelado = true
    }
  }, [usuarioId])

  const perfilAtual = usuarioId && perfil?.de === usuarioId ? perfil.dados : null
  const carregando = !sessaoLida || (!!usuarioId && perfil?.de !== usuarioId)

  const valor = useMemo(
    () => ({ configurado: supabaseConfigurado, carregando, sessao, perfil: perfilAtual, recarregarPerfil }),
    [carregando, sessao, perfilAtual, recarregarPerfil],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return ctx
}
