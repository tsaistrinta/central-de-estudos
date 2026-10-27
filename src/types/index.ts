// Tipos do schema da Central de Estudos (espelham as tabelas do Supabase/Postgres).

export type TipoMaterial = 'arquivo' | 'link' | 'anotacao' | 'codigo'
export type StatusRevisao = 'estudar_depois' | 'ja_revisei'
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
export type CorMateria =
  | 'cobalto'
  | 'azul'
  | 'petroleo'
  | 'verde'
  | 'mostarda'
  | 'laranja'
  | 'framboesa'
  | 'roxo'
export type Tier = 'free' | 'plus' | 'pro'

export interface Perfil {
  id: string
  nome?: string
  avatar_url?: string
  preferencias: Record<string, unknown>
  onboarding_concluido: boolean
  criado_em: string
}

export interface PlanoUsuario {
  usuario_id: string
  tier: Tier
  cota_bytes: number
  limite_arquivo_bytes: number
  bytes_usados: number
  stripe_customer_id?: string
  atualizado_em: string
}

export interface Curso {
  id: string
  usuario_id: string
  nome: string
  instituicao?: string
  ordem: number
}

export interface Semestre {
  id: string
  usuario_id: string
  curso_id: string
  nome: string
  ordem: number
  atual: boolean
}

export interface Materia {
  id: string
  usuario_id: string
  semestre_id: string
  nome: string
  cor: CorMateria
  professor?: string
}

export interface Material {
  id: string
  usuario_id: string
  materia_id: string
  tipo: TipoMaterial
  titulo: string
  descricao?: string
  url?: string
  conteudo?: string
  linguagem?: string
  arquivo_chave_r2?: string
  arquivo_tamanho?: number
  arquivo_mime?: string
  favorito: boolean
  status_revisao: StatusRevisao
  ultimo_acesso?: string
  criado_em: string
  atualizado_em: string
}

export interface GrupoDocumento {
  id: string
  usuario_id: string
  nome: string
  cor: CorMateria
}

export interface Documento {
  id: string
  usuario_id: string
  materia_id?: string
  grupo_id?: string
  titulo: string
  conteudo_json?: unknown
  conteudo_texto?: string
  favorito: boolean
  anexo_chave_r2?: string
  criado_em: string
  editado_em: string
}

export interface Evento {
  id: string
  usuario_id: string
  materia_id?: string
  titulo: string
  descricao?: string
  data: string
  hora?: string
  tipo: TipoEvento
  concluido: boolean
  lembrete_minutos?: number
  lembrete_enviado_em?: string
}

export interface Etiqueta {
  id: string
  usuario_id: string
  nome: string
}
