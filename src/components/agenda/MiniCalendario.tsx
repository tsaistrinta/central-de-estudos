import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DIAS_CURTOS, diasDaGradeDoMes, inicioDaSemana, mesmoDia, nomeDoMes, somarDias } from '@/lib/datas'

type Props = {
  /** Dia em foco na agenda; a semana dele fica destacada. */
  foco: Date
  onEscolher: (dia: Date) => void
  /** Dias com prova (bolinha vermelha). */
  diasComProva?: Date[]
}

export default function MiniCalendario({ foco, onEscolher, diasComProva = [] }: Props) {
  const [mes, setMes] = useState(() => new Date(foco.getFullYear(), foco.getMonth(), 1))
  const hoje = new Date()
  const semana = inicioDaSemana(foco)
  const fimSemana = somarDias(semana, 6)
  const dias = diasDaGradeDoMes(mes.getFullYear(), mes.getMonth())

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between pr-0.5 pl-1.5">
        <span className="text-[13px] font-semibold">{nomeDoMes(mes)}</span>
        <div className="flex text-muted-foreground">
          <button className="grid size-6 place-items-center rounded-md hover:bg-muted" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>
            <ChevronLeft size={15} strokeWidth={2} />
          </button>
          <button className="grid size-6 place-items-center rounded-md hover:bg-muted" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-px text-center text-[11.5px]">
        {DIAS_CURTOS.map((d) => (
          <span key={d} className="pt-0.5 pb-1 font-mono text-[10px] text-muted-foreground">
            {d[0]}
          </span>
        ))}
        {dias.map((d) => {
          const fora = d.getMonth() !== mes.getMonth()
          const naSemana = d >= semana && d <= fimSemana
          const ehHoje = mesmoDia(d, hoje)
          const prova = diasComProva.some((p) => mesmoDia(p, d))
          return (
            <button
              key={d.toISOString()}
              onClick={() => onEscolher(d)}
              className={cn(
                'relative flex h-[27px] items-center justify-center tabular-nums',
                fora && 'text-faint/70',
                naSemana && !fora && 'bg-accent font-medium text-accent-foreground',
                naSemana && d.getDay() === 0 && 'rounded-l-md',
                naSemana && d.getDay() === 6 && 'rounded-r-md',
                !naSemana && 'hover:bg-muted rounded-md',
              )}
            >
              <span className={cn(ehHoje && 'grid size-[23px] place-items-center rounded-full bg-primary font-semibold text-primary-foreground')}>
                {d.getDate()}
              </span>
              {prova && !ehHoje && <i className="absolute bottom-px size-1 rounded-full bg-destructive" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
