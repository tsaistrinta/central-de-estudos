import type { CorMateria } from '../types'

/** Paleta fixa de matérias e grupos (identidade Foco). Classes escritas por extenso para o Tailwind encontrá-las. */
export const CORES_MATERIA: { cor: CorMateria; nome: string; fundo: string }[] = [
  { cor: 'cobalto', nome: 'Cobalto', fundo: 'bg-materia-cobalto' },
  { cor: 'azul', nome: 'Azul', fundo: 'bg-materia-azul' },
  { cor: 'petroleo', nome: 'Petróleo', fundo: 'bg-materia-petroleo' },
  { cor: 'verde', nome: 'Verde', fundo: 'bg-materia-verde' },
  { cor: 'mostarda', nome: 'Mostarda', fundo: 'bg-materia-mostarda' },
  { cor: 'laranja', nome: 'Laranja', fundo: 'bg-materia-laranja' },
  { cor: 'framboesa', nome: 'Framboesa', fundo: 'bg-materia-framboesa' },
  { cor: 'roxo', nome: 'Roxo', fundo: 'bg-materia-roxo' },
]

export function fundoDaCor(cor: CorMateria) {
  return CORES_MATERIA.find((c) => c.cor === cor)?.fundo ?? 'bg-materia-cobalto'
}
