import { Link, NavLink } from 'react-router-dom'
import {
  Home,
  GraduationCap,
  Layers,
  Folder,
  FileText,
  CalendarDays,
  Code2,
  CircleCheck,
  Search,
  Settings,
} from 'lucide-react'
import ChipLogo from './ChipLogo'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/cursos', label: 'Cursos', icon: GraduationCap },
  { to: '/semestres', label: 'Semestres', icon: Layers },
  { to: '/materiais', label: 'Materiais', icon: Folder },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/biblioteca', label: 'Biblioteca', icon: Code2 },
  { to: '/revisar', label: 'Revisar', icon: CircleCheck },
]

// Até o Marco 3 não há dados: contador de revisão e matérias do semestre atual ficam vazios.
const pendentesRevisao = 0

export default function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-border bg-card px-3.5 py-4">
      <Link to="/" className="flex items-center gap-2 px-1.5">
        <ChipLogo />
        <span className="text-[17px] font-semibold tracking-tight">Central de Estudos</span>
      </Link>

      <button
        className="mt-4 flex h-[34px] items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        title="Busca global (em breve)"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="rounded border border-border px-1.5 font-mono text-[11px]">Ctrl K</kbd>
      </button>

      <nav className="mt-3.5 flex flex-col gap-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-foreground/80 hover:bg-muted',
              )
            }
          >
            <Icon size={17} strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {to === '/revisar' && pendentesRevisao > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">
                {pendentesRevisao}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 px-2.5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Semestre atual</p>
        <p className="mt-2.5 text-[13px] leading-snug text-faint">
          Marque um semestre como “Atual” para ver as matérias aqui.
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-border px-1 pt-3.5">
        <span className="grid size-[30px] place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          V
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">Visitante</p>
          <p className="truncate text-xs text-muted-foreground">Sem login</p>
        </div>
        <Link
          to="/configuracoes/perfil"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          title="Configurações"
          aria-label="Configurações"
        >
          <Settings size={16} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  )
}
