// Regras da agenda (caixa-branca): grade expandida, feriado, aula cancelada, prova no lugar da aula,
// recorrência, propostas tracejadas e camadas.
import { describe, expect, it } from 'vitest'
import { camadaDoEvento, montarItens, ocorrencias } from '@/lib/agenda'
import type { AulaHorario, Evento, MinhaTurma, Proposta } from '@/types'

const turma: MinhaTurma = {
  id: 't1', disciplina_id: 'd1', periodo_letivo: '2026/2', turno: 'noite', professor_nome: 'Sérgio Furgeri',
  papel_turma: 'aluno',
  disciplina: { id: 'd1', curso_id: 'c1', nome: 'Programação Orientada a Objetos', sigla: 'POO', semestre_matriz: 3, cor: 'cobalto' },
} as MinhaTurma
const aula: AulaHorario = { id: 'a1', turma_id: 't1', dia_semana: 5, inicio: '19:00', fim: '22:30', sala: 'Lab. 1' }
// Semana de 16/11/2026 (segunda) a 22/11/2026 (domingo); sexta = 20/11.
const de = new Date('2026-11-16T00:00')
const ate = new Date('2026-11-22T23:59')
const ev = (e: Partial<Evento>): Evento => ({ id: 'e', escopo: 'pessoal', titulo: 'x', tipo: 'outro', inicio: '2026-11-18T10:00',
  dia_todo: false, origem: 'manual', status: 'oficial', cancelado: false, ...e })
const base = { de, ate, eventos: [] as Evento[], aulas: [aula], turmas: [turma], propostas: [] as Proposta[] }

describe('montarItens', () => {
  it('expande a aula da grade no dia da semana certo', () => {
    const aulas = montarItens(base).filter((i) => i.tipo === 'aula')
    expect(aulas).toHaveLength(1)
    expect(aulas[0].inicio.toString()).toBe(new Date('2026-11-20T19:00').toString())
    expect(aulas[0].subtitulo).toBe('Lab. 1 · Sérgio Furgeri')
    expect(aulas[0].editavel).toBe(false)
  })

  it('feriado da unidade tira a aula do dia', () => {
    const feriado = ev({ id: 'f', escopo: 'unidade', titulo: 'Feriado · Consciência Negra', inicio: '2026-11-20T00:00', dia_todo: true })
    expect(montarItens({ ...base, eventos: [feriado] }).filter((i) => i.tipo === 'aula')).toHaveLength(0)
  })

  it('feriado descartado ou cancelado não tira a aula', () => {
    const descartado = ev({ escopo: 'unidade', titulo: 'Feriado?', inicio: '2026-11-20T00:00', dia_todo: true, status: 'descartado' })
    const cancelado = ev({ escopo: 'unidade', titulo: 'Feriado', inicio: '2026-11-20T00:00', dia_todo: true, cancelado: true })
    expect(montarItens({ ...base, eventos: [descartado, cancelado] }).filter((i) => i.tipo === 'aula')).toHaveLength(1)
  })

  it('aula cancelada da turma some só naquele dia', () => {
    const cancelada = ev({ escopo: 'turma', escopo_id: 't1', tipo: 'aula', titulo: 'Aula cancelada', inicio: '2026-11-20T19:00', cancelado: true })
    const itens = montarItens({ ...base, eventos: [cancelada], ate: new Date('2026-11-29T23:59') })
    expect(itens.filter((i) => i.tipo === 'aula').map((i) => i.inicio.getDate())).toEqual([27])
    expect(itens.find((i) => i.tipo === 'evento')?.estilo).toBe('cancelado')
  })

  it('prova no horário da aula ocupa o lugar dela', () => {
    const prova = ev({ escopo: 'turma', escopo_id: 't1', tipo: 'prova', titulo: 'P1', inicio: '2026-11-20T19:00', fim: '2026-11-20T21:00' })
    const itens = montarItens({ ...base, eventos: [prova] })
    expect(itens.filter((i) => i.tipo === 'aula')).toHaveLength(0)
    expect(itens[0].estilo).toBe('prova')
  })

  it('não mostra aula fora do período letivo', () => {
    const tenant = { id: 'x', nome: 'F', slug: 'f', dominios_permitidos: [], periodo_atual: '2026/2', inicio_periodo: '2026-08-01', fim_periodo: '2026-11-19' }
    expect(montarItens({ ...base, tenant }).filter((i) => i.tipo === 'aula')).toHaveLength(0)
  })

  it('evento de turma em que não estou não aparece', () => {
    const outro = ev({ escopo: 'turma', escopo_id: 'outra', titulo: 'Prova de outra turma' })
    expect(montarItens({ ...base, eventos: [outro] }).filter((i) => i.tipo === 'evento')).toHaveLength(0)
  })

  it('proposta aberta aparece tracejada com ?; confirmada não', () => {
    const p = (status: Proposta['status']) => ({ id: 'p' + status, turma_id: 't1', tipo: 'novo_evento', titulo: 'Prova de POO',
      dados: { titulo: 'Prova de POO', inicio: '2026-11-19T19:00' }, origem: 'turma', status }) as unknown as Proposta
    const itens = montarItens({ ...base, propostas: [p('nao_confirmado'), p('confirmado_turma')] }).filter((i) => i.tipo === 'proposta')
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({ titulo: 'Prova de POO?', estilo: 'proposta', subtitulo: 'Esperando a turma' })
  })

  it('só o dono edita o evento pessoal', () => {
    const meu = ev({ escopo: 'pessoal', escopo_id: 'eu' })
    expect(montarItens({ ...base, eventos: [meu], meuId: 'eu' })[0].editavel).toBe(true)
    expect(montarItens({ ...base, eventos: [meu], meuId: 'outro' })[0].editavel).toBe(false)
  })
})

describe('ocorrencias', () => {
  it('repete toda segunda e quarta até o UNTIL', () => {
    const e = ev({ inicio: '2026-11-02T08:00', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261118' })
    expect(ocorrencias(e, de, ate).map((d) => d.getDate())).toEqual([16, 18])
  })
  it('evento sem recorrência devolve a data dele', () => {
    expect(ocorrencias(ev({ inicio: '2026-11-18T10:00' }), de, ate)).toHaveLength(1)
  })
})

describe('camadaDoEvento', () => {
  it('separa pessoal, trabalho, sugestão do Archie, turma, curso e unidade', () => {
    expect(camadaDoEvento(ev({}))).toBe('pessoal')
    expect(camadaDoEvento(ev({ origem: 'importado' }))).toBe('trabalho')
    expect(camadaDoEvento(ev({ origem: 'archie', status: 'provavel' }))).toBe('archie')
    expect(camadaDoEvento(ev({ escopo: 'turma', escopo_id: 't1' }))).toBe('turma:t1')
    expect(camadaDoEvento(ev({ escopo: 'curso' }))).toBe('curso')
    expect(camadaDoEvento(ev({ escopo: 'unidade' }))).toBe('academico')
  })
})
