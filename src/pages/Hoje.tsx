import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Inbox, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { SeloYara } from '@/components/foco/Selos'

// Tela 03 · Hoje. A partir da Fase 5 o resumo vem da Yara; até lá, estados vazios.

function saudacao(hora: number) {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function Painel({ titulo, link, children }: { titulo: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {link && (
          <Link to={link.to} className="text-[13px] text-primary hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-1 pb-5 text-sm text-muted-foreground">{children}</p>
}

export default function Hoje() {
  const { perfil } = useAuth()
  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0]
  const agora = new Date()
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{data}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">
            {saudacao(agora.getHours())}
            {primeiroNome && `, ${primeiroNome}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/entrada"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted"
          >
            <Inbox size={16} strokeWidth={1.75} /> Caixa de entrada
          </Link>
          <Link
            to="/agenda"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <CalendarDays size={16} strokeWidth={1.75} /> Abrir agenda
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={1.9} className="text-primary" />
          <h2 className="text-[15px] font-semibold">Resumo do dia</h2>
          <SeloYara />
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Quando a Yara estiver ligada, aqui aparece o que mudou no site da Fatec, nos planos de ensino e nas
          conversas da turma, com a fonte de cada informação.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Painel titulo="Aulas de hoje" link={{ to: '/agenda', label: 'Ver semana' }}>
          <Vazio>Seus horários entram sozinhos quando você entrar na sua turma.</Vazio>
        </Painel>
        <Painel titulo="Próximas provas e entregas" link={{ to: '/agenda', label: 'Ver lista' }}>
          <Vazio>Nenhuma prova ou entrega nos próximos 30 dias.</Vazio>
        </Painel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Esperando a turma" link={{ to: '/turma', label: 'Ver turma' }}>
          <Vazio>Propostas de mudança que precisam do seu voto aparecem aqui.</Vazio>
        </Painel>
        <Painel titulo="Tarefas da semana" link={{ to: '/tarefas', label: 'Ver tarefas' }}>
          <Vazio>Nada para esta semana.</Vazio>
        </Painel>
      </div>
    </div>
  )
}
