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
