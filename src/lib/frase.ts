// "Escreva do seu jeito": entende frases como "estudar estatística sábado 10h por 2h"
// e devolve os campos do evento. Roda no navegador, sem IA; a Yara melhora isso na Fase 6.

import type { TipoEvento } from './eventos'

export interface Disciplinavel {
  id: string
  nome: string
  sigla?: string | null
}

export interface FraseEntendida {
  titulo: string
  tipo: TipoEvento
  inicio: Date | null
  fim: Date | null
  diaTodo: boolean
  semanal: boolean
  disciplinaId: string | null
  /** Pedaços reconhecidos, para mostrar como pílulas. */
  pedacos: string[]
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const TIPOS: [RegExp, TipoEvento][] = [
  [/\b(prova|p1|p2|p3|avaliacao|exame)\b/, 'prova'],
  [/\b(entrega|entregar|prazo)\b/, 'entrega'],
  [/\b(apresentacao|apresentar|seminario)\b/, 'apresentacao'],
  [/\b(reuniao|orientacao)\b/, 'reuniao'],
  [/\b(trabalho)\b/, 'trabalho'],
  [/\b(projeto)\b/, 'projeto'],
  [/\b(estudar|revisar|ler|leitura|resumo)\b/, 'leitura'],
  [/\b(lembrete|lembrar)\b/, 'lembrete'],
]

function proximoDia(diaSemana: number, base: Date) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const diff = (diaSemana - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

export function entenderFrase(texto: string, disciplinas: Disciplinavel[] = [], agora = new Date()): FraseEntendida {
  let resto = ` ${sem(texto)} `
  const pedacos: string[] = []
  const tirar = (re: RegExp) => {
    resto = resto.replace(re, ' ')
  }

  // Tipo
  let tipo: TipoEvento = 'outro'
  for (const [re, t] of TIPOS) {
    if (re.test(resto)) {
      tipo = t
      break
    }
  }

  // Repetição
  let semanal = false
  const reSemanal = /\b(toda semana|todas as semanas|semanalmente|toda (segunda|terca|quarta|quinta|sexta|sabado|domingo)( ?-?feira)?)\b/
  if (reSemanal.test(resto)) {
    semanal = true
    pedacos.push('Toda semana')
    resto = resto.replace(/\b(toda semana|todas as semanas|semanalmente)\b/, ' ').replace(/\btoda (?=(segunda|terca|quarta|quinta|sexta|sabado|domingo))/, ' ')
  }

  // Data
  let dia: Date | null = null
  const mData = resto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (mData) {
    const ano = mData[3] ? Number(mData[3].length === 2 ? `20${mData[3]}` : mData[3]) : agora.getFullYear()
    dia = new Date(ano, Number(mData[2]) - 1, Number(mData[1]))
    if (!mData[3] && dia < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())) dia.setFullYear(ano + 1)
    tirar(new RegExp(`\\b(dia )?${mData[0].replace(/\//g, '\\/')}\\b`))
  } else if (/\bdepois de amanha\b/.test(resto)) {
    dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 2)
    tirar(/\bdepois de amanha\b/)
  } else if (/\bamanha\b/.test(resto)) {
    dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)
    tirar(/\bamanha\b/)
  } else if (/\bhoje\b/.test(resto)) {
    dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
    tirar(/\bhoje\b/)
  } else {
    const m = resto.match(/\b(?:na |no |nesta |neste |proxima |proximo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?: ?-?feira)?\b/)
    if (m) {
      dia = proximoDia(DIAS.indexOf(m[1]), agora)
      tirar(new RegExp(m[0].trim().replace(/[-]/g, '\\-')))
    }
  }

  // Horário: "das 10 às 12", "10h-12h", "19h30", "19:30", "às 19"
  let hIni: [number, number] | null = null
  let hFim: [number, number] | null = null
  const hora = String.raw`(\d{1,2})(?:(?:h|:)(\d{2})?)?`
  const mFaixa = resto.match(new RegExp(String.raw`\b(?:das |de )?${hora}\s*(?:as|a|ate|-)\s*${hora}(?=\s)`))
  if (mFaixa && (resto.includes('h') || resto.includes(':') || /das /.test(resto))) {
    hIni = [Number(mFaixa[1]), Number(mFaixa[2] ?? 0)]
    hFim = [Number(mFaixa[3]), Number(mFaixa[4] ?? 0)]
    tirar(new RegExp(mFaixa[0].replace(/[-:]/g, (c) => `\\${c}`)))
  } else {
    const m = resto.match(/\b(?:as |a partir das |ao )?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=\s)/) ?? resto.match(/\bas (\d{1,2})\b/)
    if (m) {
      hIni = [Number(m[1]), Number(m[2] ?? m[3] ?? 0)]
      tirar(new RegExp(m[0].replace(/:/g, '\\:')))
    }
  }

  // Duração: "por 2h", "por 1h30", "por 45 min"
  let duracaoMin: number | null = null
  const mDur = resto.match(/\bpor (\d{1,2})\s*h(?:oras?)?\s*(\d{1,2})?(?:\s*min)?\b|\bpor (\d{1,3})\s*min(?:utos)?\b/)
  if (mDur) {
    duracaoMin = mDur[3] ? Number(mDur[3]) : Number(mDur[1]) * 60 + Number(mDur[2] ?? 0)
    tirar(new RegExp(mDur[0]))
  }

  // Disciplina pela sigla ou pelo nome
  let disciplinaId: string | null = null
  for (const d of disciplinas) {
    const sigla = d.sigla ? sem(d.sigla) : ''
    const nome = sem(d.nome)
    const palavraNome = nome.split(' ').find((p) => p.length > 5)
    if ((sigla && new RegExp(`\\b${sigla.replace(/\s+/g, '\\s*')}\\b`).test(resto)) || resto.includes(nome) || (palavraNome && resto.includes(palavraNome))) {
      disciplinaId = d.id
      pedacos.push(d.sigla ?? d.nome)
      break
    }
  }

  let inicio: Date | null = null
  let fim: Date | null = null
  const diaTodo = !!dia && !hIni
  if (dia) {
    inicio = new Date(dia)
    if (hIni) inicio.setHours(hIni[0], hIni[1], 0, 0)
    if (hFim) {
      fim = new Date(dia)
      fim.setHours(hFim[0], hFim[1], 0, 0)
    } else if (hIni) {
      fim = new Date(inicio.getTime() + (duracaoMin ?? 60) * 6e4)
    }
  } else if (hIni) {
    inicio = new Date(agora)
    inicio.setHours(hIni[0], hIni[1], 0, 0)
    if (inicio < agora) inicio.setDate(inicio.getDate() + 1)
    fim = new Date(inicio.getTime() + (duracaoMin ?? 60) * 6e4)
  }
  if (inicio) {
    const data = inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    const horas = !diaTodo && fim ? ` · ${inicio.toTimeString().slice(0, 5)}–${fim.toTimeString().slice(0, 5)}` : ' · dia todo'
    pedacos.unshift(data + horas)
  }

  // Título = o que sobrou da frase original, sem as partes de data/hora reconhecidas.
  const palavrasOriginais = texto.trim().split(/\s+/)
  const sobras = new Set(resto.split(/\s+/).filter(Boolean))
  const titulo = palavrasOriginais
    .filter((p) => sobras.has(sem(p).replace(/[,.;]$/, '')) && !/^(na|no|as|às|a)$/i.test(p))
    .join(' ')
    .replace(/[,;]\s*$/, '')
  return {
    titulo: titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : 'Novo evento',
    tipo,
    inicio,
    fim,
    diaTodo,
    semanal,
    disciplinaId,
    pedacos,
  }
}
