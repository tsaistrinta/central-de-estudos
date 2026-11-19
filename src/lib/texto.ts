// Textos certos em português: plural de verdade e prazos por extenso (nada de "aula(s)" nem "em 0 d").

/** plural(2, 'aula') → "2 aulas"; plural(1, 'confirmação', 'confirmações') → "1 confirmação". */
export function plural(n: number, singular: string, pluralForma?: string) {
  const forma = n === 1 ? singular : (pluralForma ?? `${singular}s`)
  return `${n} ${forma}`
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias": diferença em dias de calendário. */
export function prazoRelativo(data: Date, agora = new Date()) {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const n = Math.round((dia(data) - dia(agora)) / 864e5)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`
}

/** Saudação pela hora (madrugada conta como noite). */
export function saudacao(hora: number) {
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
