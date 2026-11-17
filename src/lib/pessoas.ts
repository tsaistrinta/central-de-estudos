// Avatares: inicial + cor estável a partir do id (paleta de matérias).
const CORES = ['--subject-verde', '--subject-petroleo', '--subject-framboesa', '--subject-mostarda', '--subject-roxo', '--subject-laranja', '--subject-azul', '--subject-cobalto']

export function corDaPessoa(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `var(${CORES[h % CORES.length]})`
}

export function inicial(nome?: string) {
  return (nome?.trim()[0] ?? '?').toUpperCase()
}

export const ROTULO_PAPEL: Record<string, string> = {
  aluno: 'Aluno',
  monitor: 'Monitor',
  representante: 'Representante',
  professor: 'Professor',
  admin: 'Admin',
}

export function tempoRelativo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
