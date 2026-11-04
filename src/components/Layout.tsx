import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import AppRail from './AppRail'

// Na Agenda a sidebar vira trilho de ícones e o conteúdo ocupa a tela toda (padrão Outlook).
export default function Layout() {
  const { pathname } = useLocation()
  const telaCheia = pathname.startsWith('/agenda')

  if (telaCheia) {
    return (
      <div className="h-screen">
        <AppRail />
        <main className="ml-[68px] h-full bg-card">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <main className="ml-56 px-8 py-[22px]">
        <Outlet />
      </main>
    </div>
  )
}
