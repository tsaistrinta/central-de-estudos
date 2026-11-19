import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import AppRail from './AppRail'
import NavCelular from './NavCelular'
import BuscaGlobal from './BuscaGlobal'

// Desktop: sidebar de 224 px (na Agenda vira trilho de 68 px, padrão Outlook).
// Celular: sem sidebar, com barra inferior.
export default function Layout() {
  const { pathname } = useLocation()
  const telaCheia = pathname.startsWith('/agenda')

  if (telaCheia) {
    return (
      <div className="h-dvh">
        <div className="hidden md:block">
          <AppRail />
        </div>
        <main className="h-full bg-card pb-[62px] md:ml-[68px] md:pb-0">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
        <NavCelular />
        <BuscaGlobal />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <main className="px-4 pt-5 pb-24 md:ml-56 md:px-8 md:py-[22px]">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <NavCelular />
      <BuscaGlobal />
    </div>
  )
}
