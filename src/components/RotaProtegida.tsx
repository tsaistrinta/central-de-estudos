import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

function Carregando() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground" role="status">
      Carregando…
    </div>
  )
}

/** Exige login. Quem ainda não passou pelo primeiro acesso vai para /boas-vindas. */
export function RotaProtegida() {
  const { configurado, carregando, sessao, perfil } = useAuth()
  const local = useLocation()

  if (!configurado) return <Outlet />
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />

  const naBoasVindas = local.pathname === '/boas-vindas'
  if (perfil && !perfil.onboarding_concluido && !naBoasVindas) return <Navigate to="/boas-vindas" replace />
  if (perfil?.onboarding_concluido && naBoasVindas) return <Navigate to="/" replace />

  return <Outlet />
}

/** Telas de entrar/criar conta: quem já está logado vai direto para o app. */
export function RotaPublica() {
  const { configurado, carregando, sessao } = useAuth()
  const local = useLocation()
  const destino = (local.state as { de?: string } | null)?.de ?? '/'

  if (configurado && carregando) return <Carregando />
  if (sessao) return <Navigate to={destino} replace />
  return <Outlet />
}
