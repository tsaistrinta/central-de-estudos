import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarDays, Grid2x2, Home, KanbanSquare, Users, X } from 'lucide-react'
import { COMUNIDADE, MEU_ESPACO } from '@/lib/navegacao'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

// Celular (PWA, tela 25): barra inferior com 4 atalhos + "Mais".
const PRINCIPAIS = [
  { to: '/', label: 'Hoje', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/tarefas', label: 'Tarefas', icon: KanbanSquare },
  { to: '/turma', label: 'Turma', icon: Users },
]

export default function NavCelular() {
  const [mais, setMais] = useState(false)
  const { perfil } = useAuth()
  const resto = [...MEU_ESPACO, ...COMUNIDADE].filter((i) => !PRINCIPAIS.some((p) => p.to === i.to))
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[62px] grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {PRINCIPAIS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-[3px] text-[10px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
            <Icon size={20} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
        <button onClick={() => setMais(true)} className="flex flex-col items-center justify-center gap-[3px] text-[10px] font-medium text-muted-foreground">
          <Grid2x2 size={20} strokeWidth={1.75} />
          Mais
        </button>
      </nav>
      {mais && (
        <>
          <div className="fixed inset-0 z-50 bg-foreground/40 md:hidden" onClick={() => setMais(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-card px-4 pt-3 pb-8 shadow-[var(--sombra-pop)] md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <b>Mais</b>
              <button onClick={() => setMais(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...resto, ...(perfil?.papel === 'admin' ? [{ to: '/admin', label: 'Admin', icon: Grid2x2 }] : []), { to: '/configuracoes/perfil', label: 'Configurações', icon: Grid2x2 }].map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMais(false)} className="flex flex-col items-center gap-1.5 rounded-lg border border-border px-2 py-3 text-center text-[12px] font-medium">
                  <Icon size={19} strokeWidth={1.75} className="text-primary" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
