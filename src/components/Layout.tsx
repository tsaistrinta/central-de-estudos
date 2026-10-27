import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'

export default function Layout() {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <main className="ml-56 px-8 py-[22px]">
        <Outlet />
      </main>
    </div>
  )
}
