// Utilitários de data da agenda. Semana começa no domingo (como o calendário da Fatec).

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function somarDias(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function inicioDaSemana(d: Date) {
  return somarDias(inicioDoDia(d), -d.getDay())
}

export function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** 42 dias (6 semanas) para a grade de um mês, começando no domingo. */
export function diasDaGradeDoMes(ano: number, mes: number) {
  const primeiro = new Date(ano, mes, 1)
  const inicio = inicioDaSemana(primeiro)
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i))
}

export function nomeDoMes(d: Date) {
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "18 – 24 de outubro de 2026" (ou com dois meses quando a semana cruza). */
export function tituloDaSemana(inicio: Date) {
  const fim = somarDias(inicio, 6)
  const mesFim = fim.toLocaleDateString('pt-BR', { month: 'long' })
  if (inicio.getMonth() === fim.getMonth()) return `${inicio.getDate()} – ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`
  const mesIni = inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${inicio.getDate()} de ${mesIni} – ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`
}
