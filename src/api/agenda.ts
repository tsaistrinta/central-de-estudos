// Agenda: eventos visíveis (pessoais, da turma, do curso e da unidade) e preferências.

import type { AgendaPreferencias, Evento } from '@/types'
import { db, meuId, modoDemo, ok } from './base'
import { demo, espera, novoId } from './demo'

export type NovoEvento = Omit<Evento, 'id' | 'status' | 'cancelado' | 'origem' | 'escopo' | 'escopo_id'> &
  Partial<Pick<Evento, 'escopo' | 'escopo_id' | 'origem' | 'status'>>

/** Eventos que começam até `fim` e terminam depois de `inicio` (os recorrentes vêm sempre). */
export async function eventosNoIntervalo(inicio: Date, fim: Date): Promise<Evento[]> {
  if (modoDemo) {
    return espera(
      demo.eventos.filter((e) => e.rrule || (new Date(e.inicio) <= fim && new Date(e.fim ?? e.inicio) >= inicio)),
    )
  }
  const [normais, recorrentes] = await Promise.all([
    db().from('eventos').select('*').lte('inicio', fim.toISOString()).or(`fim.gte.${inicio.toISOString()},and(fim.is.null,inicio.gte.${inicio.toISOString()})`).is('rrule', null),
    db().from('eventos').select('*').not('rrule', 'is', null),
  ])
  return [...ok(normais), ...ok(recorrentes)] as Evento[]
}

export async function proximosEventos(dias = 30): Promise<Evento[]> {
  const inicio = new Date()
  const fim = new Date(Date.now() + dias * 864e5)
  const lista = await eventosNoIntervalo(inicio, fim)
  return lista.filter((e) => !e.rrule).sort((a, b) => a.inicio.localeCompare(b.inicio))
}

export async function criarEvento(valores: NovoEvento): Promise<Evento> {
  if (modoDemo) {
    const e: Evento = { escopo: 'pessoal', escopo_id: demo.perfil.id, origem: 'manual', status: 'oficial', cancelado: false, ...valores, id: novoId('e') }
    demo.eventos.push(e)
    return espera(e, 60)
  }
  return ok(await db().from('eventos').insert({ escopo: 'pessoal', ...valores }).select().single())
}

export async function atualizarEvento(id: string, valores: Partial<Evento>): Promise<Evento> {
  if (modoDemo) {
    const e = demo.eventos.find((x) => x.id === id)
    if (!e) throw new Error('Evento não encontrado.')
    Object.assign(e, valores)
    return espera(e, 60)
  }
  return ok(await db().from('eventos').update(valores).eq('id', id).select().single())
}

export async function apagarEvento(id: string) {
  if (modoDemo) {
    demo.eventos = demo.eventos.filter((e) => e.id !== id)
    return
  }
  ok(await db().from('eventos').delete().eq('id', id))
}

export async function minhasPreferencias(): Promise<AgendaPreferencias | null> {
  if (modoDemo) return espera(demo.preferencias)
  return ok(await db().from('agenda_preferencias').select('*').eq('usuario_id', await meuId()).maybeSingle())
}

export async function salvarPreferencias(valores: Partial<AgendaPreferencias>) {
  if (modoDemo) {
    Object.assign(demo.preferencias, valores)
    return
  }
  ok(await db().from('agenda_preferencias').upsert({ usuario_id: await meuId(), ...valores }))
}

/** Avisa quando algum evento visível muda (outra pessoa, professor ou Archie). */
export function ouvirEventos(aoMudar: () => void): () => void {
  if (modoDemo) return () => {}
  const canal = db()
    .channel('agenda-eventos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos' }, aoMudar)
    .subscribe()
  return () => {
    db().removeChannel(canal)
  }
}

/** Link .ics pessoal (Edge Function agenda-ics). */
export function linkIcs(token: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base) return `https://SEU-PROJETO.supabase.co/functions/v1/agenda-ics?token=${token}`
  return `${base}/functions/v1/agenda-ics?token=${token}`
}
