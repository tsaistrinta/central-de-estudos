// Tipos do schema da Central de Estudos (espelham supabase/migrations/20261027000000_schema_inicial.sql).

import type { StatusInfo, TipoEvento } from '@/lib/eventos'

export type { StatusInfo, TipoEvento }

export type CorMateria = 'cobalto' | 'azul' | 'petroleo' | 'verde' | 'mostarda' | 'laranja' | 'framboesa' | 'roxo'
export type Papel = 'aluno' | 'monitor' | 'representante' | 'professor' | 'admin'
export type Turno = 'manha' | 'tarde' | 'noite'
export type EscopoEvento = 'unidade' | 'curso' | 'turma' | 'pessoal'

export interface Tenant {
  id: string
  nome: string
  slug: string
  dominios_permitidos: string[]
  site_url?: string | null
  periodo_atual: string
  inicio_periodo?: string | null
  fim_periodo?: string | null
}

export interface Perfil {
  id: string
  tenant_id: string
  nome: string
  email: string
  papel: Papel
  quer_ser_professor: boolean
  curso_id?: string | null
  semestre?: number | null
  turno?: Turno | null
  onboarding_concluido: boolean
  preferencias: Record<string, unknown>
  criado_em: string
}

/** Nome e papel de outra pessoa do tenant (sem e-mail). */
export interface Pessoa {
  id: string
  nome: string
  papel: Papel
}

export interface Curso {
  id: string
  tenant_id: string
  nome: string
  sigla: string
  semestres: number
}

export interface Disciplina {
  id: string
  curso_id: string
  nome: string
  sigla?: string | null
  semestre_matriz?: number | null
  cor: CorMateria
}

export interface Turma {
  id: string
  disciplina_id: string
  periodo_letivo: string
  turno: Turno
  professor_nome?: string | null
  professor_id?: string | null
  tamanho_real?: number | null
}

/** Turma com a disciplina embutida — o formato que as telas usam. */
export interface MinhaTurma extends Turma {
  disciplina: Disciplina
  papel_turma: Papel
}

export interface AulaHorario {
  id: string
  turma_id: string
  dia_semana: number
  inicio: string
  fim: string
  sala?: string | null
}

export interface Evento {
  id: string
  tenant_id?: string
  escopo: EscopoEvento
  escopo_id?: string | null
  disciplina_id?: string | null
  titulo: string
  tipo: TipoEvento
  inicio: string
  fim?: string | null
  dia_todo: boolean
  local?: string | null
  descricao?: string | null
  rrule?: string | null
  lembretes?: number[] | null
  origem: 'manual' | 'yara' | 'professor' | 'turma' | 'importado'
  documento_url?: string | null
  status: StatusInfo
  cancelado: boolean
  criado_por?: string | null
}

export interface AgendaPreferencias {
  usuario_id: string
  camadas_ocultas: string[]
  lembretes_padrao: Record<string, number[]>
  hora_inicio: number
  hora_fim: number
  mostrar_sugestoes: boolean
  mostrar_propostas: boolean
  ics_token: string
}

export interface Material {
  id: string
  dono_id: string
  turma_id?: string | null
  disciplina_id?: string | null
  tipo: 'arquivo' | 'link' | 'anotacao'
  titulo: string
  url?: string | null
  conteudo?: string | null
  arquivo_chave_r2?: string | null
  arquivo_tamanho?: number | null
  arquivo_mime?: string | null
  semana?: number | null
  na_entrada: boolean
  status_revisao: 'estudar_depois' | 'ja_revisei'
  oficial: boolean
  criado_em: string
}

export type ColunaTarefa = 'a_fazer' | 'fazendo' | 'feito'

export interface Tarefa {
  id: string
  usuario_id: string
  titulo: string
  descricao?: string | null
  coluna: ColunaTarefa
  ordem: number
  prazo?: string | null
  disciplina_id?: string | null
  subtarefas: { texto: string; feita: boolean }[]
  criado_em: string
}

export interface ItemRevisao {
  id: string
  usuario_id: string
  material_id?: string | null
  disciplina_id?: string | null
  pergunta: string
  resposta?: string | null
  proxima_em: string
  intervalo_dias: number
  facilidade: number
  repeticoes: number
}

export interface Avaliacao {
  id: string
  turma_id: string
  nome: string
  peso: number
  data?: string | null
}

export interface Nota {
  usuario_id: string
  avaliacao_id: string
  valor: number | null
}

export interface Frequencia {
  usuario_id: string
  turma_id: string
  data: string
  presente: boolean
  aulas: number
}

export interface Mensagem {
  id: string
  turma_id: string
  canal: string
  autor_id: string
  texto: string
  fixada: boolean
  criado_em: string
}

export interface Duvida {
  id: string
  turma_id: string
  autor_id: string
  texto: string
  resolvida: boolean
  criado_em: string
}

export interface Resposta {
  id: string
  duvida_id: string
  autor_id?: string | null
  texto: string
  fontes: { titulo: string; url?: string }[]
  confirmada_por?: string | null
  criado_em: string
}

export type TipoProposta = 'novo_evento' | 'mudar_data' | 'cancelar' | 'outro'

export interface Proposta {
  id: string
  turma_id: string
  tipo: TipoProposta
  alvo_evento_id?: string | null
  titulo: string
  dados: { titulo?: string; tipo?: TipoEvento; inicio?: string; fim?: string; local?: string; cancelado?: boolean }
  origem: 'turma' | 'yara'
  trecho_origem?: string | null
  status: StatusInfo
  criado_por?: string | null
  criado_em: string
  expira_em: string
}

export interface Voto {
  proposta_id: string
  usuario_id: string
  valor: 'sim' | 'nao'
}

export interface Reacao {
  alvo_tipo: 'mensagem' | 'material' | 'resposta' | 'duvida'
  alvo_id: string
  usuario_id: string
  emoji: string
}

export interface Fonte {
  id: string
  tenant_id: string
  nome: string
  url: string
  tipo: 'pagina' | 'pdf' | 'imagem' | 'rss'
  frequencia_min: number
  ultima_verificacao?: string | null
  status: 'ativa' | 'pausada' | 'erro'
}
