// Monta os itens da agenda a partir do banco: eventos, aulas da grade (expandidas por dia),
// recorrências simples (RRULE semanal/diária) e propostas abertas da turma.
// Regras: feriado da unidade e aula cancelada tiram a aula da grade daquele dia.

import type { AulaHorario, CorMateria, Evento, MinhaTurma, Proposta, Tenant } from '@/types'
import { inicioDoDia, somarDias } from './datas'

export type TipoItem = 'evento' | 'aula' | 'proposta'

export interface ItemAgenda {
  id: string
  tipo: TipoItem
  titulo: string
  inicio: Date
  fim: Date
  diaTodo: boolean
  camada: string
  cor: string
  /** Visual do bloco: prova, entrega, proposta (tracejado âmbar), sugestao (listras), cancelado, ocupado. */
  estilo: 'normal' | 'prova' | 'entrega' | 'proposta' | 'sugestao' | 'cancelado' | 'ocupado'
  subtitulo?: string
  editavel: boolean
  evento?: Evento
  aula?: AulaHorario & { data: string }
  proposta?: Proposta
  turma?: MinhaTurma
}

export const corDaMateria = (cor: CorMateria) => `var(--subject-${cor})`

export const CAMADAS_FIXAS = {
  pessoal: { nome: 'Pessoal', cor: 'var(--subject-verde)' },
  trabalho: { nome: 'Trabalho', cor: 'var(--faint)' },
  archie: { nome: 'Sugestões do Archie', cor: 'var(--primary)' },
  academico: { nome: 'Calendário acadêmico', cor: 'var(--subject-azul)' },
  curso: { nome: 'Meu curso', cor: 'var(--muted-foreground)' },
} as const

export function camadaDoEvento(e: Evento): string {
  if (e.escopo === 'pessoal') {
    if (e.origem === 'importado') return 'trabalho'
    if (e.origem === 'archie' && e.status === 'provavel') return 'archie'
    return 'pessoal'
  }
  if (e.escopo === 'turma') return `turma:${e.escopo_id}`
  if (e.escopo === 'curso') return 'curso'
  return 'academico'
}

/** Títulos que o Archie usa para dia sem aula (feriado, emenda, recesso, "Sem aula · …", dia não letivo). */
export const DIA_SEM_AULA = /feriado|recesso|sem aula|n[ãa]o letivo|emenda/i

const DIAS_RRULE: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** Datas de início de cada ocorrência dentro de [de, ate] para FREQ=WEEKLY|DAILY. */
export function ocorrencias(e: Evento, de: Date, ate: Date): Date[] {
  const inicio = new Date(e.inicio)
  if (!e.rrule) return [inicio]
  const partes = Object.fromEntries(e.rrule.split(';').map((p) => p.split('=')))
  const ateRegra = partes.UNTIL ? new Date(`${partes.UNTIL.slice(0, 4)}-${partes.UNTIL.slice(4, 6)}-${partes.UNTIL.slice(6, 8)}T23:59:59`) : null
  const limite = ateRegra && ateRegra < ate ? ateRegra : ate
  const dias = partes.FREQ === 'DAILY' ? [0, 1, 2, 3, 4, 5, 6] : (partes.BYDAY ?? '').split(',').filter(Boolean).map((d: string) => DIAS_RRULE[d])
  if (!dias.length) dias.push(inicio.getDay())
  const lista: Date[] = []
  for (let d = inicioDoDia(de < inicio ? inicio : de); d <= limite; d = somarDias(d, 1)) {
    if (!dias.includes(d.getDay())) continue
    const o = new Date(d)
    o.setHours(inicio.getHours(), inicio.getMinutes(), 0, 0)
    if (o >= inicio || inicioDoDia(o).getTime() === inicioDoDia(inicio).getTime()) lista.push(o)
  }
  return lista
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emHorario(data: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(data)
  d.setHours(h, m, 0, 0)
  return d
}

type Entrada = {
  de: Date
  ate: Date
  eventos: Evento[]
  aulas: AulaHorario[]
  turmas: MinhaTurma[]
  propostas: Proposta[]
  tenant?: Tenant | null
  meuId?: string
}

export function montarItens({ de, ate, eventos, aulas, turmas, propostas, tenant, meuId }: Entrada): ItemAgenda[] {
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]))
  const itens: ItemAgenda[] = []

  // Dias sem aula: feriados/dias não letivos da unidade e aulas canceladas de cada turma.
  const feriados = new Set<string>()
  const canceladas = new Set<string>()
  const ocupaAula = new Map<string, [number, number][]>()
  for (const e of eventos) {
    const dia = chaveDia(new Date(e.inicio))
    if (e.escopo === 'unidade' && e.dia_todo && !e.cancelado && e.status !== 'descartado' && DIA_SEM_AULA.test(e.titulo)) {
      const fim = new Date(e.fim ?? e.inicio)
      for (let d = inicioDoDia(new Date(e.inicio)); d <= fim; d = somarDias(d, 1)) feriados.add(chaveDia(d))
    }
    if (e.escopo === 'turma' && e.tipo === 'aula' && e.cancelado) canceladas.add(`${e.escopo_id}|${dia}`)
    // Prova ou entrega da turma no horário da aula ocupa o lugar dela.
    if (e.escopo === 'turma' && !e.cancelado && !e.dia_todo && e.fim) {
      const lista = ocupaAula.get(`${e.escopo_id}|${dia}`) ?? []
      lista.push([new Date(e.inicio).getTime(), new Date(e.fim).getTime()])
      ocupaAula.set(`${e.escopo_id}|${dia}`, lista)
    }
  }

  // Eventos (com recorrência)
  for (const e of eventos) {
    const turma = e.escopo === 'turma' && e.escopo_id ? turmaPorId.get(e.escopo_id) : undefined
    if (e.escopo === 'turma' && !turma) continue
    const camada = camadaDoEvento(e)
    const corFixa = CAMADAS_FIXAS[camada as keyof typeof CAMADAS_FIXAS]?.cor
    const disc = turma?.disciplina ?? turmas.find((t) => t.disciplina_id === e.disciplina_id)?.disciplina
    const cor = camada === 'pessoal' && disc ? corDaMateria(disc.cor) : (corFixa ?? (disc ? corDaMateria(disc.cor) : 'var(--primary)'))
    const duracao = e.fim ? new Date(e.fim).getTime() - new Date(e.inicio).getTime() : e.dia_todo ? 0 : 60 * 6e4
    for (const ini of ocorrencias(e, de, ate)) {
      const fim = new Date(ini.getTime() + Math.max(duracao, 0))
      if (fim < de || ini > ate) continue
      const estilo: ItemAgenda['estilo'] = e.cancelado
        ? 'cancelado'
        : camada === 'trabalho'
          ? 'ocupado'
          : camada === 'archie'
            ? 'sugestao'
            : e.tipo === 'prova'
              ? 'prova'
              : e.tipo === 'entrega'
                ? 'entrega'
                : 'normal'
      itens.push({
        id: e.rrule ? `${e.id}@${ini.toISOString()}` : e.id,
        tipo: 'evento',
        titulo: e.titulo,
        inicio: ini,
        fim: e.dia_todo && fim.getTime() === ini.getTime() ? somarDias(ini, 1) : fim,
        diaTodo: e.dia_todo,
        camada,
        cor,
        estilo,
        subtitulo: e.cancelado ? 'Cancelada · aviso oficial' : (e.local ?? turma?.professor_nome ?? undefined),
        editavel: e.escopo === 'pessoal' && !e.rrule && e.escopo_id === (meuId ?? e.escopo_id),
        evento: e,
        turma,
      })
    }
  }

  // Aulas da grade, expandidas por dia dentro do período letivo.
  const iniPeriodo = tenant?.inicio_periodo ? new Date(`${tenant.inicio_periodo}T00:00`) : null
  const fimPeriodo = tenant?.fim_periodo ? new Date(`${tenant.fim_periodo}T23:59`) : null
  for (let d = inicioDoDia(de); d <= ate; d = somarDias(d, 1)) {
    if ((iniPeriodo && d < iniPeriodo) || (fimPeriodo && d > fimPeriodo)) continue
    const dia = chaveDia(d)
    if (feriados.has(dia)) continue
    for (const a of aulas) {
      if (a.dia_semana !== d.getDay() || canceladas.has(`${a.turma_id}|${dia}`)) continue
      const t = turmaPorId.get(a.turma_id)
      if (!t) continue
      const ini = emHorario(d, a.inicio).getTime()
      const fimAula = emHorario(d, a.fim).getTime()
      if ((ocupaAula.get(`${a.turma_id}|${dia}`) ?? []).some(([i, f]) => i < fimAula && f > ini)) continue
      itens.push({
        id: `aula-${a.id}-${dia}`,
        tipo: 'aula',
        titulo: `${t.disciplina.sigla ?? t.disciplina.nome} · Aula`,
        inicio: emHorario(d, a.inicio),
        fim: emHorario(d, a.fim),
        diaTodo: false,
        camada: `turma:${t.id}`,
        cor: corDaMateria(t.disciplina.cor),
        estilo: 'normal',
        subtitulo: [a.sala, t.professor_nome].filter(Boolean).join(' · '),
        editavel: false,
        aula: { ...a, data: dia },
        turma: t,
      })
    }
  }

  // Propostas abertas com data: aparecem tracejadas até a turma confirmar.
  for (const p of propostas) {
    if (p.status !== 'nao_confirmado' || !p.dados.inicio) continue
    const t = turmaPorId.get(p.turma_id)
    if (!t) continue
    const ini = new Date(p.dados.inicio)
    const fim = p.dados.fim ? new Date(p.dados.fim) : new Date(ini.getTime() + 60 * 6e4)
    if (fim < de || ini > ate) continue
    itens.push({
      id: `prop-${p.id}`,
      tipo: 'proposta',
      titulo: `${p.dados.titulo ?? p.titulo}?`,
      inicio: ini,
      fim,
      diaTodo: false,
      camada: `turma:${t.id}`,
      cor: corDaMateria(t.disciplina.cor),
      estilo: 'proposta',
      subtitulo: 'Esperando a turma',
      editavel: false,
      proposta: p,
      turma: t,
    })
  }

  return itens
}

export const MINUTOS_LEMBRETE: Record<number, string> = {
  0: 'Na hora',
  15: '15 min antes',
  30: '30 min antes',
  60: '1 h antes',
  120: '2 h antes',
  180: '3 h antes',
  1440: '1 dia antes',
  2880: '2 dias antes',
}

/** Visões da barra → nomes de visão do FullCalendar. */
export const VISAO_FC = {
  dia: 'timeGridDay',
  'semana-util': 'semanaUtil',
  semana: 'timeGridWeek',
  mes: 'dayGridMonth',
  lista: 'lista30',
} as const

