import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Search, Settings } from 'lucide-react'
import { COMUNIDADE, MEU_ESPACO, type ItemNav } from '@/lib/navegacao'
import ChipLogo from './ChipLogo'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { sair } from '@/api/auth'

function Contador({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">
      {n}
    </span>
  )
}

function Rotulo({ children }: { children: string }) {
  return <p className="px-2.5 pt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{children}</p>
}

export default function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-56 flex-col gap-3 border-r border-border bg-card px-3.5 py-4">
      <Link to="/" className="flex items-center gap-2 px-1.5">
        <ChipLogo />
        <span className="text-[17px] font-semibold tracking-tight">Central de Estudos</span>
      </Link>

      <button
        className="mt-1 flex h-[34px] items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        title="Busca global (em breve)"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="rounded border border-border px-1.5 font-mono text-[11px]">Ctrl K</kbd>
      </button>

      <Rotulo>Meu espaço · privado</Rotulo>
      <nav className="flex flex-col gap-0.5">
        {MEU_ESPACO.map((item) => (
          <ItemSidebar key={item.to} {...item} />
        ))}
      </nav>

      <Rotulo>Comunidade</Rotulo>
      <nav className="flex flex-col gap-0.5">
        {COMUNIDADE.map((item) => (
          <ItemSidebar key={item.to} {...item} />
        ))}
      </nav>
      <p className="px-2.5 text-[13px] leading-snug text-faint">
        Suas disciplinas aparecem aqui quando você entrar numa turma.
      </p>

      <MenuUsuario />
    </aside>
  )
}

function ItemSidebar({ to, label, icon: Icon, end, contador }: ItemNav) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon size={17} strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      <Contador n={contador} />
    </NavLink>
  )
}

export function MenuUsuario({ compacto = false }: { compacto?: boolean }) {
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
    <div ref={menuRef} className={cn('relative mt-auto', !compacto && 'border-t border-border pt-3.5')}>
      {aberto && (
        <div
          role="menu"
          className={cn(
            'absolute z-30 rounded-lg border border-border bg-popover p-1 shadow-lg',
            compacto ? 'bottom-0 left-full ml-2 w-48' : 'right-0 bottom-full left-0 mb-2',
          )}
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
        title={compacto ? nome : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md text-left transition-colors hover:bg-muted',
          compacto ? 'p-1' : 'w-full px-1 py-1',
        )}
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {nome.charAt(0).toUpperCase()}
        </span>
        {!compacto && (<>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>
        </span>
        <Settings size={16} strokeWidth={1.75} className="text-muted-foreground" />
        </>)}
      </button>
    </div>
  )
}
