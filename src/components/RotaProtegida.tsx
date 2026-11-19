import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { sair } from '@/api/auth'
import { Button } from '@/components/ui/button'

/** Logado, mas sem perfil na Central (conta antiga ou e-mail fora do domínio): não entra. */
function SemPerfil({ onTentar }: { onTentar: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Esta conta não tem acesso à Central</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com o seu e-mail institucional da Fatec (@aluno.cps.sp.gov.br). Se você já usa esse e-mail, tente de novo; pode ter sido a conexão.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={onTentar}>Tentar de novo</Button>
          <Button onClick={() => sair().finally(() => window.location.assign('/entrar'))}>Sair e entrar de novo</Button>
        </div>
      </div>
    </div>
  )
}

function Carregando() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground" role="status">
      Carregando…
    </div>
  )
}

/** Exige login. Quem ainda não passou pelo primeiro acesso vai para /boas-vindas. */
export function RotaProtegida() {
  const { configurado, carregando, sessao, perfil, recarregarPerfil } = useAuth()
  const local = useLocation()

  if (!configurado) return <Outlet />
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  if (!perfil) return <SemPerfil onTentar={recarregarPerfil} />

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
