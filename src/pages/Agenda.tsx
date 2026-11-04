import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DIAS_CURTOS, inicioDaSemana, mesmoDia, nomeDoMes, somarDias, tituloDaSemana } from '@/lib/datas'
import PainelCalendarios from '@/components/agenda/PainelCalendarios'

// Telas 20–26 · Agenda no padrão Outlook. Fase 1: casca (painel, barra, grade vazia).
// Fase 3: FullCalendar (timeGrid/dayGrid/list + interaction) dentro desta mesma casca.

const VISOES = [
  { id: 'dia', nome: 'Dia', tecla: 'd' },
  { id: 'semana-util', nome: 'Semana útil', tecla: 'u' },
  { id: 'semana', nome: 'Semana', tecla: 'w' },
  { id: 'mes', nome: 'Mês', tecla: 'm' },
  { id: 'lista', nome: 'Lista', tecla: 'l' },
] as const
type Visao = (typeof VISOES)[number]['id']

const HORA_INICIO = 8
const HORA_FIM = 23
const ALTURA_HORA = 48

function passo(visao: Visao) {
  if (visao === 'dia') return 1
  if (visao === 'mes' || visao === 'lista') return 0
  return 7
}

export default function Agenda() {
  const [params, setParams] = useSearchParams()
  const visao = (VISOES.find((v) => v.id === params.get('visao'))?.id ?? 'semana') as Visao
  const [foco, setFoco] = useState(() => new Date())
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  function mudarVisao(v: Visao) {
    setParams((p) => {
      p.set('visao', v)
      return p
    })
  }

  function navegar(direcao: 1 | -1) {
    const n = passo(visao)
    if (n) setFoco((f) => somarDias(f, n * direcao))
    else setFoco((f) => new Date(f.getFullYear(), f.getMonth() + direcao, 1))
  }

  // Atalhos do Outlook: T hoje, D/U/W/M/L visões, ← → navegar.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || alvo.closest('input, textarea, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 't') setFoco(new Date())
      else if (k === 'arrowleft') navegar(-1)
      else if (k === 'arrowright') navegar(1)
      else {
        const v = VISOES.find((x) => x.tecla === k)
        if (v) mudarVisao(v.id)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const semana = inicioDaSemana(foco)
  const dias =
    visao === 'dia' ? [foco] : visao === 'semana-util' ? [1, 2, 3, 4, 5].map((i) => somarDias(semana, i)) : Array.from({ length: 7 }, (_, i) => somarDias(semana, i))
  const titulo =
    visao === 'dia'
      ? foco.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
      : visao === 'mes' || visao === 'lista'
        ? nomeDoMes(foco).replace(/ (\d{4})$/, ' de $1')
        : tituloDaSemana(semana)

  const minutosAgora = (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes()
  const mostraAgora = minutosAgora >= 0 && agora.getHours() < HORA_FIM

  return (
    <div className="flex h-full">
      <PainelCalendarios foco={foco} onEscolherDia={setFoco} onNovoEvento={() => {}} />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-border pr-4 pl-[18px]">
          <button onClick={() => setFoco(new Date())} className="h-8 rounded-md border border-border px-3.5 text-[13px] font-semibold hover:bg-muted">
            Hoje
          </button>
          <button onClick={() => navegar(-1)} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Anterior">
            <ChevronLeft size={17} strokeWidth={2} />
          </button>
          <button onClick={() => navegar(1)} className="-ml-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Próximo">
            <ChevronRight size={17} strokeWidth={2} />
          </button>
          <h1 className="ml-1.5 flex items-center gap-1.5 truncate text-[17px] font-semibold tracking-tight first-letter:uppercase">
            {titulo}
            <ChevronDown size={15} strokeWidth={2} className="text-muted-foreground" />
          </h1>
          <span className="flex-1" />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-[12.5px] font-medium">
            {VISOES.map((v) => (
              <button
                key={v.id}
                onClick={() => mudarVisao(v.id)}
                className={cn(
                  'h-[30px] border-r border-border px-[11px] last:border-r-0',
                  v.id === visao ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {v.nome}
              </button>
            ))}
          </div>
          <button className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted" aria-label="Filtrar">
            <Filter size={16} strokeWidth={1.75} />
          </button>
          <label className="flex h-8 w-[196px] shrink-0 items-center gap-2 rounded-md border border-border px-2.5 text-[12.5px] text-muted-foreground">
            <Search size={15} strokeWidth={1.75} />
            <input placeholder="Buscar na agenda" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
            <kbd className="rounded border border-border px-1.5 font-mono text-[10.5px]">/</kbd>
          </label>
        </header>

        {visao === 'mes' || visao === 'lista' ? (
          <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted-foreground">
            <p>
              Visão <b className="text-foreground">{VISOES.find((v) => v.id === visao)?.nome}</b> chega na Fase 3 — referência: tela{' '}
              <span className="font-mono">{visao === 'mes' ? '21' : '24'}</span>.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `58px repeat(${dias.length}, minmax(0,1fr))` }}>
              <div />
              {dias.map((d) => {
                const hoje = mesmoDia(d, agora)
                return (
                  <div key={d.toISOString()} className={cn('flex items-center gap-2 border-l border-muted px-2.5 pt-2 pb-[7px]', hoje && 'shadow-[inset_0_3px_0_var(--primary)]')}>
                    <span className={cn('grid h-8 min-w-8 place-items-center text-[21px] font-semibold tracking-tight tabular-nums', hoje && 'rounded-full bg-primary text-base text-primary-foreground')}>
                      {d.getDate()}
                    </span>
                    <span className={cn('text-xs font-medium', hoje ? 'text-primary' : 'text-muted-foreground')}>{DIAS_CURTOS[d.getDay()]}</span>
                  </div>
                )
              })}
            </div>
            <div className="grid min-h-0 flex-1 overflow-y-auto" style={{ gridTemplateColumns: `58px repeat(${dias.length}, minmax(0,1fr))` }}>
              <div className="relative" style={{ height: (HORA_FIM - HORA_INICIO) * ALTURA_HORA }}>
                {Array.from({ length: HORA_FIM - HORA_INICIO - 1 }, (_, i) => (
                  <span key={i} className="absolute right-2 -translate-y-1/2 bg-card px-0.5 font-mono text-[10.5px] text-muted-foreground" style={{ top: (i + 1) * ALTURA_HORA }}>
                    {String(HORA_INICIO + i + 1).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
              {dias.map((d) => {
                const hoje = mesmoDia(d, agora)
                const fimDeSemana = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div
                    key={d.toISOString()}
                    className={cn('relative border-l border-muted', fimDeSemana && 'bg-background/40', hoje && 'bg-accent/30')}
                    style={{
                      height: (HORA_FIM - HORA_INICIO) * ALTURA_HORA,
                      backgroundImage: 'linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
                      backgroundSize: `100% ${ALTURA_HORA}px`,
                    }}
                  >
                    {hoje && mostraAgora && (
                      <div className="absolute right-0 -left-px z-10 h-0.5 bg-destructive" style={{ top: (minutosAgora / 60) * ALTURA_HORA - 1 }}>
                        <span className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-destructive" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
