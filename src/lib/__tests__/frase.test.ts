// "Escreva do seu jeito": frases comuns de aluno viram o evento certo.
import { describe, expect, it } from 'vitest'
import { entenderFrase } from '@/lib/frase'

const agora = new Date('2026-11-18T14:00') // quarta-feira
const disciplinas = [
  { id: 'd-est', nome: 'Estatística', sigla: 'EST' },
  { id: 'd-poo', nome: 'Programação Orientada a Objetos', sigla: 'POO' },
]

describe('entenderFrase', () => {
  it('estudar estatística sábado 10h por 2h', () => {
    const f = entenderFrase('estudar estatística sábado 10h por 2h', disciplinas, agora)
    expect(f.tipo).toBe('leitura')
    expect(f.disciplinaId).toBe('d-est')
    expect(f.inicio?.toString()).toBe(new Date('2026-11-21T10:00').toString())
    expect(f.fim?.toString()).toBe(new Date('2026-11-21T12:00').toString())
    expect(f.diaTodo).toBe(false)
  })

  it('prova de POO dia 25/11 das 19h às 21h', () => {
    const f = entenderFrase('prova de POO dia 25/11 das 19h às 21h', disciplinas, agora)
    expect(f.tipo).toBe('prova')
    expect(f.disciplinaId).toBe('d-poo')
    expect(f.inicio?.toString()).toBe(new Date('2026-11-25T19:00').toString())
    expect(f.fim?.toString()).toBe(new Date('2026-11-25T21:00').toString())
  })

  it('data sem hora vira dia todo', () => {
    const f = entenderFrase('entrega do relatório amanhã', disciplinas, agora)
    expect(f.tipo).toBe('entrega')
    expect(f.diaTodo).toBe(true)
    expect(f.inicio?.getDate()).toBe(19)
  })

  it('data que já passou neste ano vai para o ano que vem', () => {
    expect(entenderFrase('reunião 10/02', [], agora).inicio?.getFullYear()).toBe(2027)
  })

  it('toda segunda vira semanal', () => {
    const f = entenderFrase('academia toda segunda 7h', [], agora)
    expect(f.semanal).toBe(true)
    expect(f.inicio?.getDay()).toBe(1)
  })

  it('título fica com o que sobra da frase', () => {
    expect(entenderFrase('estudar estatística sábado 10h por 2h', disciplinas, agora).titulo).toBe('Estudar estatística')
    expect(entenderFrase('', [], agora).titulo).toBe('Novo evento')
  })
})
