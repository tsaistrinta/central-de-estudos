// Rótulos do acervo permanente e da quarentena.
import type { StatusAcervo, TipoAcervo } from '@/types'

export const ROTULO_TIPO_ACERVO: Record<TipoAcervo, string> = {
  prova_antiga: 'Prova antiga',
  resumo: 'Resumo',
  lista: 'Lista de exercícios',
  trabalho: 'Trabalho de referência',
  slides: 'Slides',
  livro_apostila: 'Apostila',
  outro: 'Outro',
}

export const ROTULO_STATUS_ACERVO: Record<StatusAcervo, string> = {
  em_analise: 'Em análise pelo Archie',
  publicado: 'Publicado',
  quarentena: 'Retido para revisão',
  removido: 'Removido',
}

export const ROTULO_CATEGORIA: Record<string, string> = {
  sexual: 'Conteúdo sexual',
  violencia: 'Violência',
  odio: 'Ódio ou assédio',
  ilicito: 'Atividade ilícita',
  malicioso: 'Arquivo ou link malicioso',
  dados_pessoais: 'Dados pessoais de terceiros',
  fora_do_ambito: 'Fora do âmbito acadêmico',
  tipo_proibido: 'Tipo de arquivo não permitido',
  codigo_embutido: 'Código embutido (macro/JavaScript)',
  virus: 'Vírus detectado',
  ilegivel: 'Não foi possível ler',
}

/** Período letivo atual em texto (ex.: 2026/2), para sugerir no envio. */
export function periodoAtual(d = new Date()) {
  return `${d.getFullYear()}/${d.getMonth() < 6 ? 1 : 2}`
}

export function tamanhoLegivel(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
