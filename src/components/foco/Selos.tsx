import type { ReactNode } from 'react'
import { Clock, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIPOS_EVENTO, type StatusInfo, type TipoEvento } from '@/lib/eventos'

/** Pílula base: 11 px, semibold, raio 999. */
export function Pilula({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] leading-none font-semibold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

const SELOS: Record<StatusInfo, { rotulo: string; classe: string; icone: ReactNode }> = {
  oficial: { rotulo: 'Oficial', classe: 'bg-accent text-accent-foreground', icone: <ShieldCheck size={11} strokeWidth={2.2} /> },
  provavel: { rotulo: 'Provável', classe: 'bg-warning-soft text-warning', icone: <Clock size={11} strokeWidth={2.2} /> },
  nao_confirmado: { rotulo: 'Esperando a turma', classe: 'bg-warning-soft text-warning', icone: <Users size={11} strokeWidth={2.2} /> },
  confirmado_turma: { rotulo: 'Confirmado pela turma', classe: 'bg-success-soft text-success', icone: <Users size={11} strokeWidth={2.2} /> },
  descartado: { rotulo: 'Descartado', classe: 'bg-muted text-muted-foreground', icone: <X size={11} strokeWidth={2.2} /> },
}

/** Selo de origem/confiança mostrado em toda informação captada (telas 03, 19, 20–24). */
export function SeloStatus({ status, rotulo }: { status: StatusInfo; rotulo?: string }) {
  const s = SELOS[status]
  return (
    <Pilula className={s.classe}>
      {s.icone}
      {rotulo ?? s.rotulo}
    </Pilula>
  )
}

/** Selo cinza "Yara": o que foi captado ou sugerido pela IA. */
export function SeloYara({ rotulo = 'Yara' }: { rotulo?: string }) {
  return (
    <Pilula className="bg-muted text-foreground/80">
      <Sparkles size={11} strokeWidth={2} />
      {rotulo}
    </Pilula>
  )
}

/** Pílula do tipo de evento: texto na cor do tipo, fundo a 13%. */
export function PilulaEvento({ tipo }: { tipo: TipoEvento }) {
  const t = TIPOS_EVENTO[tipo]
  return <Pilula className={cn(t.texto, t.fundo)}>{t.nome}</Pilula>
}

/** Etiqueta compacta usada dentro dos blocos da agenda (PROVA, ENTREGA). */
export function EtiquetaEvento({ tipo }: { tipo: 'prova' | 'entrega' }) {
  return (
    <span
      className={cn(
        'inline-flex h-[15px] items-center rounded-[3px] px-1 text-[9px] font-bold tracking-wider text-white',
        tipo === 'prova' ? 'bg-evento-prova' : 'bg-evento-entrega',
      )}
    >
      {tipo === 'prova' ? 'PROVA' : 'ENTREGA'}
    </span>
  )
}
