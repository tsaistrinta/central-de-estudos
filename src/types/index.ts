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
  origem: 'manual' | 'archie' | 'professor' | 'turma' | 'importado'
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
  origem: 'turma' | 'archie'
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
  /** Como o Archie lê a fonte (Fase 5). */
  extrator: ExtratorFonte
  ultimo_erro?: string | null
}

export type ExtratorFonte = 'calendario' | 'grade' | 'avisos' | 'geral'

/** Última visita do Archie a cada fonte (view ultimas_capturas). */
export interface UltimaCaptura {
  fonte_id: string
  conteudo_url?: string | null
  titulo?: string | null
  itens: number
  erro?: string | null
  capturado_em: string
}

export type TipoCuradoria = 'evento_novo' | 'evento_provavel' | 'evento_mudanca' | 'evento_sumiu' | 'grade_turma' | 'disciplina_nova'

/** O que o Archie quis mudar. Pendente = decisao nula; aplicado sozinho = aprovado sem decidido_por. */
export interface ItemCuradoria {
  id: string
  item_tipo: TipoCuradoria
  item_id?: string | null
  dados: {
    trecho?: string | null
    documento_url?: string | null
    evento?: { titulo: string; inicio: string; fim?: string | null; documento_url?: string | null }
    aulas?: { dia_semana: number; inicio: string; fim: string; sala?: string | null }[]
    antes?: { aulas: { dia_semana: number; inicio: string; fim: string; sala?: string | null }[]; professor_nome?: string | null }
    professor_nome?: string | null
    nome_no_pdf?: string
    [chave: string]: unknown
  }
  resumo?: string | null
  motivo?: string | null
  confianca?: number | null
  fonte_id?: string | null
  decisao?: 'aprovado' | 'rejeitado' | null
  decidido_por?: string | null
  decidido_em?: string | null
  criado_em: string
}

/** Sinal de vida do worker do Archie. */
export interface ArchieStatus {
  worker: string
  versao?: string | null
  modelos: Record<string, string>
  iniciado_em?: string | null
  ultimo_sinal: string
  tarefa_atual?: string | null
  processadas: number
  erros: number
  ultimo_erro?: string | null
}

// ---------- Entrada nas turmas (pedido ou código) ----------
export type StatusPedido = 'pendente' | 'aprovado' | 'recusado' | 'cancelado'

export interface PedidoTurma {
  id: string
  turma_id: string
  usuario_id: string
  mensagem: string | null
  status: StatusPedido
  criado_em: string
  decidido_em: string | null
}

/** Pedido pendente visto por quem aprova (professor da turma ou admin). */
export interface PedidoPendente {
  id: string
  turma_id: string
  usuario_id: string
  nome: string
  email: string
  mensagem: string | null
  criado_em: string
  disciplina: string
  semestre_matriz: number | null
  turno: Turno
}

// ---------- Acervo permanente da disciplina ----------
export type TipoAcervo = 'prova_antiga' | 'resumo' | 'lista' | 'trabalho' | 'slides' | 'livro_apostila' | 'outro'
export type StatusAcervo = 'em_analise' | 'publicado' | 'quarentena' | 'removido'

export interface ModeracaoAcervo {
  motivo?: string
  categorias?: string[]
  confianca?: number
  origem?: 'archie' | 'denuncias' | 'verificacao'
  modelo?: string
  sha256?: string
  tipo_detectado?: string
  verificacoes?: string[]
  trecho?: string
  nota_admin?: string | null
}

export interface ItemAcervo {
  id: string
  disciplina_id: string
  autor_id: string
  tipo: TipoAcervo
  titulo: string
  descricao: string | null
  periodo_origem: string | null
  link_url: string | null
  arquivo_chave: string | null
  arquivo_nome: string | null
  arquivo_tamanho: number | null
  arquivo_mime: string | null
  status: StatusAcervo
  moderacao: ModeracaoAcervo | null
  moderado_em: string | null
  criado_em: string
}

/** Item na quarentena, com os dados de quem enviou (só o admin vê). */
export interface ItemQuarentena extends Omit<ItemAcervo, 'disciplina_id' | 'periodo_origem'> {
  disciplina: string
  autor_nome: string
  autor_email: string
  autor_curso: string | null
  autor_semestre: number | null
  autor_envios: number
  autor_retidos: number
  denuncias: number
}
