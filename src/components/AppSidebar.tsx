import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LogOut,
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
import { useAuth } from '@/lib/auth'
import { sair } from '@/api/auth'

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

      <MenuUsuario />
    </aside>
  )
}

function MenuUsuario() {
  const { configurado, sessao, perfil } = useAuth()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fechar(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', fechar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', fechar)
    }
  }, [aberto])

  const nome = perfil?.nome || sessao?.user.email?.split('@')[0] || 'Visitante'
  const subtitulo = configurado ? (sessao?.user.email ?? '') : 'Modo demonstração'

  async function aoSair() {
    setSaindo(true)
    try {
      await sair()
      navegar('/entrar', { replace: true })
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div ref={menuRef} className="relative mt-auto border-t border-border pt-3.5">
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 bottom-full left-0 mb-2 rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            to="/configuracoes/perfil"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
          >
            <Settings size={15} strokeWidth={1.75} /> Configurações
          </Link>
          {configurado && sessao && (
            <button
              role="menuitem"
              onClick={aoSair}
              disabled={saindo}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-destructive-soft"
            >
              <LogOut size={15} strokeWidth={1.75} /> {saindo ? 'Saindo…' : 'Sair'}
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {nome.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>
        </span>
        <Settings size={16} strokeWidth={1.75} className="text-muted-foreground" />
      </button>
    </div>
  )
}
