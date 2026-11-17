import type { RefObject } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import ptBr from '@fullcalendar/core/locales/pt-br'
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { DateSelectArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { ShieldCheck, Sparkles, Users } from 'lucide-react'
import { EtiquetaEvento } from '@/components/foco/Selos'
import { DIAS_CURTOS } from '@/lib/datas'
import { VISAO_FC, type ItemAgenda } from '@/lib/agenda'
import { cn } from '@/lib/utils'

const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const hhmm = (d: Date) => d.toTimeString().slice(0, 5)

function Bloco({ item, compacto }: { item: ItemAgenda; compacto: boolean }) {
  const icone =
    item.estilo === 'sugestao' ? <Sparkles size={11} strokeWidth={2} className="shrink-0 text-primary" /> : item.estilo === 'proposta' ? <Users size={11} strokeWidth={2} className="shrink-0 text-warning" /> : null
  const oficial = item.evento?.status === 'oficial' && item.evento.origem !== 'manual' && item.evento.escopo !== 'pessoal'
  return (
    <div className={cn('ce-ev', `ce-${item.estilo}`)} style={{ '--c': item.cor } as React.CSSProperties}>
      <b>
        {item.estilo === 'prova' && <EtiquetaEvento tipo="prova" />}
        {item.estilo === 'entrega' && <EtiquetaEvento tipo="entrega" />}
        {icone}
        <span>{item.titulo}</span>
        {oficial && !compacto && <ShieldCheck size={11} strokeWidth={2.2} className="ml-auto shrink-0 text-primary" />}
      </b>
      {!item.diaTodo && <div className="ce-m font-mono text-[10.5px]">{`${hhmm(item.inicio)}–${hhmm(item.fim)}`}</div>}
      {item.subtitulo && <div className="ce-m">{item.subtitulo}</div>}
    </div>
  )
}

function conteudo(arg: EventContentArg) {
  const item = arg.event.extendedProps.item as ItemAgenda
  const v = arg.view.type
  if (v.startsWith('list')) {
    return (
      <span className="flex items-center gap-2">
        {item.estilo === 'prova' && <EtiquetaEvento tipo="prova" />}
        {item.estilo === 'entrega' && <EtiquetaEvento tipo="entrega" />}
        <span className={cn('font-medium', item.estilo === 'cancelado' && 'line-through opacity-60')}>{item.titulo}</span>
        {item.subtitulo && <span className="text-xs text-muted-foreground">{item.subtitulo}</span>}
      </span>
    )
  }
  if (v === 'dayGridMonth' && !item.diaTodo) {
    return (
      <span className={cn('ce-mi', `ce-${item.estilo}`)} style={{ '--c': item.cor } as React.CSSProperties}>
        <i />
        <span className="font-mono text-[10.5px] text-muted-foreground">{hhmm(item.inicio)}</span>
        <span className="truncate">{item.titulo}</span>
      </span>
    )
  }
  return <Bloco item={item} compacto={v === 'dayGridMonth' || item.diaTodo} />
}

type Props = {
  apiRef: RefObject<FullCalendar | null>
  visao: keyof typeof VISAO_FC
  itens: ItemAgenda[]
  horaInicio: number
  horaFim: number
  onIntervalo: (arg: DatesSetArg) => void
  onClicar: (item: ItemAgenda, el: HTMLElement) => void
  onSelecionar: (inicio: Date, fim: Date, diaTodo: boolean) => void
  onMover: (item: ItemAgenda, inicio: Date, fim: Date | null, desfazer: () => void) => void
}

// FullCalendar com a cara da Central: a barra e o painel são nossos; os blocos usam os tokens Foco.
export default function Calendario({ apiRef, visao, itens, horaInicio, horaFim, onIntervalo, onClicar, onSelecionar, onMover }: Props) {
  const eventos: EventInput[] = itens.map((item) => ({
    id: item.id,
    title: item.titulo,
    start: item.inicio,
    end: item.fim,
    allDay: item.diaTodo,
    editable: item.editavel,
    backgroundColor: 'transparent',
    borderColor: item.cor,
    extendedProps: { item },
  }))

  return (
    <div className="ce-fc h-full min-h-0">
      <FullCalendar
        ref={apiRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={VISAO_FC[visao]}
        views={{
          semanaUtil: { type: 'timeGrid', duration: { weeks: 1 }, weekends: false },
          lista30: { type: 'list', duration: { days: 30 } },
        }}
        locale={ptBr}
        firstDay={0}
        headerToolbar={false}
        height="100%"
        events={eventos}
        eventContent={conteudo}
        allDayText="dia todo"
        slotMinTime={`${String(Math.max(0, horaInicio - 2)).padStart(2, '0')}:00:00`}
        slotMaxTime={`${String(Math.min(24, horaFim + 1)).padStart(2, '0')}:00:00`}
        scrollTime={`${String(horaInicio).padStart(2, '0')}:00:00`}
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        slotLabelInterval="01:00"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        nowIndicator
        listDayFormat={{ day: 'numeric', month: 'long' }}
        listDaySideFormat={{ weekday: 'long' }}
        selectable
        selectMirror
        unselectAuto
        navLinks
        dayMaxEvents={4}
        moreLinkContent={(a) => `+${a.num} mais`}
        noEventsContent="Nada nos próximos 30 dias."
        eventOrder="-allDay,start,-duration,title"
        dayHeaderContent={(a) => {
          if (a.view.type.startsWith('list')) return true
          if (a.view.type === 'dayGridMonth') return <span className="ce-dh-mes">{DIAS_LONGOS[a.dow]}</span>
          return (
            <span className="ce-dh">
              <span className="ce-dh-n">{a.date.getDate()}</span>
              <span className="ce-dh-w">{DIAS_CURTOS[a.date.getDay()]}</span>
            </span>
          )
        }}
        datesSet={onIntervalo}
        eventClick={(a: EventClickArg) => {
          a.jsEvent.preventDefault()
          onClicar(a.event.extendedProps.item as ItemAgenda, a.el)
        }}
        select={(a: DateSelectArg) => {
          onSelecionar(a.start, a.end, a.allDay)
          a.view.calendar.unselect()
        }}
        eventDrop={(a: EventDropArg) => onMover(a.event.extendedProps.item as ItemAgenda, a.event.start!, a.event.end, a.revert)}
        eventResize={(a: EventResizeDoneArg) => onMover(a.event.extendedProps.item as ItemAgenda, a.event.start!, a.event.end, a.revert)}
      />
    </div>
  )
}
