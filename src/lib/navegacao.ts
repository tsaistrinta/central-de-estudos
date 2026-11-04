import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleCheck,
  GraduationCap,
  Home,
  Inbox,
  KanbanSquare,
  MapPin,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type ItemNav = { to: string; label: string; icon: LucideIcon; end?: boolean; contador?: number }

// Tela 03 em diante: "Meu espaço" é privado; "Comunidade" é compartilhado com a turma.
// Os contadores vêm do banco a partir da Fase 3; até lá ficam zerados (e escondidos).
export const MEU_ESPACO: ItemNav[] = [
  { to: '/', label: 'Hoje', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/materias', label: 'Minhas matérias', icon: BookOpen },
  { to: '/entrada', label: 'Caixa de entrada', icon: Inbox, contador: 0 },
  { to: '/tarefas', label: 'Tarefas', icon: KanbanSquare },
  { to: '/revisao', label: 'Revisão', icon: CircleCheck, contador: 0 },
  { to: '/notas', label: 'Notas e faltas', icon: BarChart3 },
]

export const COMUNIDADE: ItemNav[] = [
  { to: '/turma', label: 'Minha turma', icon: Users },
  { to: '/curso', label: 'Meu curso', icon: GraduationCap },
  { to: '/unidade', label: 'Fatec · unidade', icon: MapPin },
]

