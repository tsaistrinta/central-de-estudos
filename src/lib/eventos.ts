// Tipos de evento e estados de origem da informação (identidade Foco).
// Classes escritas por extenso para o Tailwind encontrá-las.

export type TipoEvento =
  | 'prova'
  | 'entrega'
  | 'trabalho'
  | 'apresentacao'
  | 'aula'
  | 'reuniao'
  | 'leitura'
  | 'projeto'
  | 'lembrete'
  | 'data_especial'
  | 'outro'

export const TIPOS_EVENTO: Record<TipoEvento, { nome: string; texto: string; fundo: string }> = {
  prova: { nome: 'Prova', texto: 'text-evento-prova', fundo: 'bg-evento-prova/13' },
  entrega: { nome: 'Entrega', texto: 'text-evento-entrega', fundo: 'bg-evento-entrega/13' },
  trabalho: { nome: 'Trabalho', texto: 'text-evento-trabalho', fundo: 'bg-evento-trabalho/13' },
  apresentacao: { nome: 'Apresentação', texto: 'text-evento-apresentacao', fundo: 'bg-evento-apresentacao/13' },
  aula: { nome: 'Aula', texto: 'text-evento-aula', fundo: 'bg-evento-aula/13' },
  reuniao: { nome: 'Reunião', texto: 'text-evento-reuniao', fundo: 'bg-evento-reuniao/13' },
  leitura: { nome: 'Leitura', texto: 'text-evento-leitura', fundo: 'bg-evento-leitura/13' },
  projeto: { nome: 'Projeto', texto: 'text-evento-projeto', fundo: 'bg-evento-projeto/13' },
  lembrete: { nome: 'Lembrete', texto: 'text-evento-lembrete', fundo: 'bg-evento-lembrete/13' },
  data_especial: { nome: 'Data especial', texto: 'text-evento-data-especial', fundo: 'bg-evento-data-especial/13' },
  outro: { nome: 'Outro', texto: 'text-evento-outro', fundo: 'bg-evento-outro/13' },
}

/** De onde veio a informação e quanto dá para confiar nela (seção 5 e 6 da documentação). */
export type StatusInfo = 'oficial' | 'provavel' | 'nao_confirmado' | 'confirmado_turma' | 'descartado'
