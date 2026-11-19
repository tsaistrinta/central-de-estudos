import { describe, expect, it } from 'vitest'
import { linkDaFonte, nomeDaFonte } from '@/lib/fonte'
import { forcaDaSenha, SENHA_MINIMA } from '@/lib/senha'

describe('fonte', () => {
  it('abre PDF da Fatec por https e na página certa', () => {
    expect(linkDaFonte('http://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf', 2))
      .toBe('https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf#page=2')
    expect(linkDaFonte('https://exemplo.com/pagina', 3)).toBe('https://exemplo.com/pagina')
  })
  it('mostra um nome curto', () => {
    expect(nomeDaFonte('https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf')).toBe('ADS_NOT.pdf')
    expect(nomeDaFonte('https://www.fatecid.com.br/site/index.php/calendario-academico/')).toBe('site da Fatec')
    expect(nomeDaFonte('não é url')).toBe('fonte')
  })
})

describe('senha', () => {
  it('senha curta é fraca', () => {
    expect(SENHA_MINIMA).toBeGreaterThanOrEqual(8)
    expect(forcaDaSenha('abc')).toBe(1)
    expect(forcaDaSenha('Fatec-Indaiatuba-2026!')).toBe(4)
  })
})

import { plural, prazoRelativo, saudacao } from '@/lib/texto'

describe('texto', () => {
  it('plural de verdade', () => {
    expect(plural(1, 'aula')).toBe('1 aula')
    expect(plural(2, 'aula')).toBe('2 aulas')
    expect(plural(0, 'confirmação', 'confirmações')).toBe('0 confirmações')
    expect(plural(1, 'item', 'itens')).toBe('1 item')
  })
  it('prazo por extenso', () => {
    const agora = new Date('2026-11-19T23:30')
    expect(prazoRelativo(new Date('2026-11-19T08:00'), agora)).toBe('hoje')
    expect(prazoRelativo(new Date('2026-11-20T01:00'), agora)).toBe('amanhã')
    expect(prazoRelativo(new Date('2026-11-24T19:00'), agora)).toBe('em 5 dias')
  })
  it('madrugada é boa noite', () => {
    expect(saudacao(2)).toBe('Boa noite')
    expect(saudacao(9)).toBe('Bom dia')
    expect(saudacao(14)).toBe('Boa tarde')
  })
})
