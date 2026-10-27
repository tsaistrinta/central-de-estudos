import { Outlet } from 'react-router-dom'
import ChipLogo from './ChipLogo'

/** Layout das telas públicas (entrar, criar conta, recuperar senha, primeiro acesso): sem sidebar. */
export default function AuthLayout() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <ChipLogo className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Central de Estudos</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-7 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
