import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Clock, Plus, TrendingUp, Upload } from 'lucide-react'

// Tela 05 · Início. Até o Marco 6 os números vêm zerados; a estrutura já segue a identidade Foco.
const resumo = { pendentes: 0, revisados: 0, totalMateriais: 0 }

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
  return <p className="px-4 pt-2 pb-5 text-sm text-muted-foreground">{children}</p>
}

export default function Dashboard() {
  const agora = new Date()
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const pct = resumo.totalMateriais ? Math.round((resumo.revisados / resumo.totalMateriais) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{data}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{saudacao(agora.getHours())}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/documentos/importar"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted"
          >
            <Upload size={16} strokeWidth={1.75} /> Importar
          </Link>
          <Link
            to="/materiais"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus size={16} strokeWidth={1.75} /> Novo material
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
        {resumo.pendentes > 0 ? (
          <section className="rounded-lg bg-foreground p-5 text-card">
            <p className="text-4xl font-semibold">{resumo.pendentes}</p>
            <p className="mt-1 text-sm text-card/80">materiais esperando revisão</p>
            <Link to="/revisar" className="mt-4 inline-flex h-9 items-center rounded-md bg-card px-3.5 text-sm font-medium text-foreground">
              Revisar agora →
            </Link>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-5">
            <CircleCheck className="text-success" size={22} strokeWidth={1.75} />
            <p className="mt-3 text-xl font-semibold">Tudo revisado</p>
            <p className="mt-1 text-sm text-muted-foreground">Nenhum material esperando revisão.</p>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={15} strokeWidth={1.75} /> Próximo prazo
          </p>
          <p className="mt-3 text-xl font-semibold">Nenhum prazo</p>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre provas e entregas na Agenda.</p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp size={15} strokeWidth={1.75} /> Semestre
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {pct}% <span className="text-sm font-normal text-muted-foreground">revisado</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-[13px] text-muted-foreground">
            {resumo.revisados} de {resumo.totalMateriais} materiais
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Próximos prazos" link={{ to: '/agenda', label: 'Ver agenda' }}>
          <Vazio>Nenhum prazo cadastrado ainda.</Vazio>
        </Painel>
        <Painel titulo="Continuar estudando" link={{ to: '/materiais', label: 'Ver todos' }}>
          <Vazio>Os materiais que você abrir aparecem aqui.</Vazio>
        </Painel>
      </div>

      <Painel titulo="Progresso por matéria" link={{ to: '/semestres', label: 'Ver semestre' }}>
        <Vazio>Adicione matérias ao semestre atual para acompanhar o progresso.</Vazio>
      </Painel>
    </div>
  )
}
