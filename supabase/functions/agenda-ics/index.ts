// GET ?token=… → calendário .ics pessoal (Outlook, Google, iPhone assinam este link).
// Publicar sem verificação de JWT: supabase functions deploy agenda-ics --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dia = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
// Horário de Brasília (sem horário de verão desde 2019): local = UTC-3.
const local = (data: string, hora: string) => new Date(`${data}T${hora.slice(0, 5)}:00-03:00`)

function linhas(campos: Record<string, string | undefined>) {
  return Object.entries(campos)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${v}`)
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return new Response('token ausente', { status: 400 })
  const { data: pref } = await db.from('agenda_preferencias').select('usuario_id').eq('ics_token', token).maybeSingle()
  if (!pref) return new Response('link inválido', { status: 404 })
  const uid = pref.usuario_id as string

  const { data: perfil } = await db.from('perfis').select('tenant_id, curso_id').eq('id', uid).single()
  const { data: tenant } = await db.from('tenants').select('*').eq('id', perfil!.tenant_id).single()
  const { data: mats } = await db.from('matriculas').select('turma_id, turma:turmas(professor_nome, disciplina:disciplinas(nome, sigla))').eq('usuario_id', uid)
  const turmaIds = (mats ?? []).map((m) => m.turma_id as string)

  const filtros = [`and(escopo.eq.pessoal,escopo_id.eq.${uid})`, 'escopo.eq.unidade', perfil!.curso_id ? `and(escopo.eq.curso,escopo_id.eq.${perfil!.curso_id})` : null, turmaIds.length ? `and(escopo.eq.turma,escopo_id.in.(${turmaIds.join(',')}))` : null].filter(Boolean)
  const { data: eventos } = await db.from('eventos').select('*').eq('tenant_id', perfil!.tenant_id).or(filtros.join(','))
  const { data: aulas } = turmaIds.length ? await db.from('aulas_horario').select('*').in('turma_id', turmaIds) : { data: [] }

  const feriados = (eventos ?? []).filter((e) => e.escopo === 'unidade' && e.dia_todo && /feriado|recesso/i.test(e.titulo)).map((e) => e.inicio.slice(0, 10))
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Central de Estudos//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Central de Estudos', 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT2H']

  for (const e of eventos ?? []) {
    const ini = new Date(e.inicio)
    const fim = e.fim ? new Date(e.fim) : new Date(ini.getTime() + (e.dia_todo ? 864e5 : 36e5))
    out.push('BEGIN:VEVENT', ...linhas({
      UID: `${e.id}@centraldeestudos`,
      DTSTAMP: utc(new Date()),
      ...(e.dia_todo ? { 'DTSTART;VALUE=DATE': dia(ini), 'DTEND;VALUE=DATE': dia(new Date(fim.getTime() + (e.fim ? 864e5 : 0))) } : { DTSTART: utc(ini), DTEND: utc(fim) }),
      SUMMARY: esc(`${e.cancelado ? '[Cancelado] ' : ''}${e.titulo}`),
      LOCATION: e.local ? esc(e.local) : undefined,
      DESCRIPTION: esc([e.descricao, e.status === 'confirmado_turma' ? 'Confirmado pela turma' : null, e.documento_url].filter(Boolean).join('\n')),
      RRULE: e.rrule ?? undefined,
      STATUS: e.cancelado ? 'CANCELLED' : 'CONFIRMED',
    }), 'END:VEVENT')
  }

  // Aulas da grade: uma série semanal por horário, pulando feriados.
  const inicio = tenant!.inicio_periodo as string
  const fimPeriodo = (tenant!.fim_periodo as string).replace(/-/g, '')
  for (const a of aulas ?? []) {
    const m = (mats ?? []).find((x) => x.turma_id === a.turma_id) as unknown as { turma: { professor_nome: string | null; disciplina: { nome: string; sigla: string | null } } }
    const primeiro = new Date(`${inicio}T12:00:00-03:00`)
    while (primeiro.getUTCDay() !== a.dia_semana) primeiro.setUTCDate(primeiro.getUTCDate() + 1)
    const data = primeiro.toISOString().slice(0, 10)
    const ex = feriados.filter((f) => new Date(`${f}T12:00:00-03:00`).getUTCDay() === a.dia_semana).map((f) => utc(local(f, a.inicio)))
    out.push('BEGIN:VEVENT', ...linhas({
      UID: `aula-${a.id}@centraldeestudos`,
      DTSTAMP: utc(new Date()),
      DTSTART: utc(local(data, a.inicio)),
      DTEND: utc(local(data, a.fim)),
      RRULE: `FREQ=WEEKLY;BYDAY=${DIAS[a.dia_semana]};UNTIL=${fimPeriodo}T235959Z`,
      EXDATE: ex.length ? ex.join(',') : undefined,
      SUMMARY: esc(`${m.turma.disciplina.sigla ?? m.turma.disciplina.nome} · Aula`),
      LOCATION: a.sala ? esc(a.sala) : undefined,
      DESCRIPTION: esc(m.turma.professor_nome ?? ''),
    }), 'END:VEVENT')
  }
  out.push('END:VCALENDAR')

  return new Response(out.join('\r\n'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="central-de-estudos.ics"', 'Cache-Control': 'max-age=900' },
  })
})
