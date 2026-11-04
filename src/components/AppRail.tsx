import { NavLink } from 'react-router-dom'
import ChipLogo from './ChipLogo'
import { MenuUsuario } from './AppSidebar'
import { COMUNIDADE, MEU_ESPACO } from '@/lib/navegacao'
import { cn } from '@/lib/utils'

// Trilho de ícones (68 px) que substitui a sidebar na Agenda, como no Outlook (telas 20–26).
const CURTO: Record<string, string> = {
  '/': 'Hoje',
  '/agenda': 'Agenda',
  '/materias': 'Matérias',
  '/entrada': 'Entrada',
  '/tarefas': 'Tarefas',
  '/revisao': 'Revisão',
  '/notas': 'Notas',
  '/turma': 'Turma',
  '/curso': 'Curso',
  '/unidade': 'Unidade',
}

export default function AppRail() {
  const item = ({ to, icon: Icon, end, contador }: (typeof MEU_ESPACO)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex w-14 flex-col items-center gap-[3px] rounded-lg pt-[7px] pb-1.5 text-[10px] font-medium tracking-tight transition-colors',
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon size={19} strokeWidth={1.75} />
      <span>{CURTO[to]}</span>
      {!!contador && (
        <span className="absolute top-[3px] right-2 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-primary px-1 text-[9.5px] font-semibold text-primary-foreground">
          {contador}
        </span>
      )}
    </NavLink>
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[68px] flex-col items-center gap-[3px] border-r border-border bg-card pt-3.5 pb-3">
      <NavLink to="/" className="mb-2.5" title="Central de Estudos">
        <ChipLogo />
      </NavLink>
      {MEU_ESPACO.map(item)}
      <span className="my-1.5 h-px w-8 bg-border" />
      {COMUNIDADE.map(item)}
      <MenuUsuario compacto />
    </aside>
  )
}
