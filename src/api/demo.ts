// Dados do modo demonstração (sem .env.local). Espelham o piloto da Fatec Indaiatuba
// e são montados em volta da semana atual, para a agenda nunca aparecer vazia.
// Tudo fica só na memória: recarregar a página volta ao estado inicial.

import { inicioDaSemana, somarDias } from '@/lib/datas'
import type {
  AgendaPreferencias,
  AulaHorario,
  Avaliacao,
  Curso,
  Disciplina,
  Duvida,
  Evento,
  Fonte,
  Frequencia,
  ItemAcervo,
  ItemCuradoria,
  PedidoTurma,
  ItemRevisao,
  Material,
  Mensagem,
  Nota,
  Perfil,
  Pessoa,
  Proposta,
  Reacao,
  Resposta,
  Tarefa,
  Tenant,
  Turma,
  Voto,
  UltimaCaptura,
  ArchieStatus,
} from '@/types'

export const DEMO_ID = 'demo-lucas'
const TENANT = 't-fatec'
const CURSO = 'c-ads'

function quando(diaDaSemana: number, hora: string, semanas = 0) {
  const d = somarDias(inicioDaSemana(new Date()), diaDaSemana + semanas * 7)
  const [h, m] = hora.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Há n minutos (para as visitas do Archie parecerem recentes). */
const haMin = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

let seq = 0
export function novoId(prefixo = 'demo') {
  seq += 1
  return `${prefixo}-${Date.now().toString(36)}-${seq}`
}

const agora = new Date().toISOString()

const tenant: Tenant = {
  id: TENANT,
  nome: 'Fatec Indaiatuba',
  slug: 'fatec-indaiatuba',
  dominios_permitidos: ['aluno.cps.sp.gov.br', 'fatec.sp.gov.br', 'cps.sp.gov.br'],
  site_url: 'https://www.fatecid.com.br/site/',
  periodo_atual: '2026/2',
  inicio_periodo: '2026-07-27',
  fim_periodo: '2026-12-14',
}

const perfil: Perfil = {
  id: DEMO_ID,
  tenant_id: TENANT,
  nome: 'Lucas Tsai',
  email: 'lucas.tsai@aluno.cps.sp.gov.br',
  papel: 'admin',
  quer_ser_professor: false,
  curso_id: CURSO,
  semestre: 3,
  turno: 'noite',
  onboarding_concluido: true,
  preferencias: {},
  criado_em: agora,
}

const disciplinas: Disciplina[] = [
  { id: 'd-poo', curso_id: CURSO, nome: 'Programação Orientada a Objetos', sigla: 'POO', semestre_matriz: 3, cor: 'laranja' },
  { id: 'd-est', curso_id: CURSO, nome: 'Estatística', sigla: 'EST', semestre_matriz: 3, cor: 'petroleo' },
  { id: 'd-es2', curso_id: CURSO, nome: 'Engenharia de Software II', sigla: 'ES II', semestre_matriz: 3, cor: 'roxo' },
  { id: 'd-ihc', curso_id: CURSO, nome: 'Interação Humano-Computador', sigla: 'IHC', semestre_matriz: 3, cor: 'framboesa' },
  { id: 'd-soc', curso_id: CURSO, nome: 'Sociedade e Tecnologia', sigla: 'SOC', semestre_matriz: 3, cor: 'mostarda' },
  { id: 'd-bd', curso_id: CURSO, nome: 'Banco de Dados', sigla: 'BD', semestre_matriz: 3, cor: 'azul' },
  // De outros semestres (para "Adicionar matéria": dependência ou aproveitamento).
  { id: 'd-ed', curso_id: CURSO, nome: 'Estrutura de Dados', sigla: 'ED', semestre_matriz: 4, cor: 'verde' },
  { id: 'd-gp', curso_id: CURSO, nome: 'Gestão de Projetos', sigla: 'GP', semestre_matriz: 4, cor: 'cobalto' },
  { id: 'd-pdm', curso_id: CURSO, nome: 'Programação para Dispositivos Móveis', sigla: 'PDM', semestre_matriz: 5, cor: 'laranja' },
  { id: 'd-les', curso_id: CURSO, nome: 'Laboratório de Engenharia de Software', sigla: 'LES', semestre_matriz: 6, cor: 'roxo' },
]

const professores: Record<string, string> = {
  'd-poo': 'Prof. Furgeri',
  'd-est': 'Prof. Carlos',
  'd-es2': 'Prof. Marlon',
  'd-ihc': 'Prof. Michel',
  'd-soc': 'Profa. Miriam',
  'd-bd': 'Prof. Renato',
  'd-ed': 'Prof. Rodrigo',
  'd-gp': 'Profa. Sandra',
  'd-pdm': 'Prof. Felipe',
  'd-les': 'Prof. Marlon',
}

const turmas: Turma[] = disciplinas.map((d) => ({
  id: 't' + d.id.slice(1),
  disciplina_id: d.id,
  periodo_letivo: '2026/2',
  turno: 'noite',
  professor_nome: professores[d.id],
  professor_id: d.id === 'd-est' ? 'p-carlos' : null,
  tamanho_real: 40,
}))

const aulas: AulaHorario[] = [
  { id: 'a1', turma_id: 't-poo', dia_semana: 1, inicio: '19:00', fim: '20:40', sala: 'Sala 7' },
  { id: 'a2', turma_id: 't-est', dia_semana: 1, inicio: '20:50', fim: '22:30', sala: 'Sala 12' },
  { id: 'a3', turma_id: 't-poo', dia_semana: 2, inicio: '19:00', fim: '20:40', sala: 'Sala 7' },
  { id: 'a4', turma_id: 't-es2', dia_semana: 2, inicio: '20:50', fim: '22:30', sala: 'Lab. 3' },
  { id: 'a5', turma_id: 't-bd', dia_semana: 3, inicio: '19:00', fim: '22:30', sala: 'Lab. 2' },
  { id: 'a6', turma_id: 't-ihc', dia_semana: 4, inicio: '19:00', fim: '20:40', sala: 'Sala 5' },
  { id: 'a7', turma_id: 't-soc', dia_semana: 4, inicio: '20:50', fim: '22:30', sala: 'Sala 9' },
  { id: 'a8', turma_id: 't-ihc', dia_semana: 5, inicio: '19:00', fim: '20:40', sala: 'Sala 5' },
  { id: 'a9', turma_id: 't-est', dia_semana: 5, inicio: '20:50', fim: '22:30', sala: 'Sala 12' },
]

const NOMES = ['Ana Paula Reis', 'Beatriz Lima', 'Rafael Mendes', 'Júlia Prado', 'Mateus Alves', 'Gabriel Costa', 'Thais Nunes', 'Vinícius Leite', 'Caio Rocha', 'Larissa Dias', 'Pedro Souza']
const pessoas: Pessoa[] = [
  { id: DEMO_ID, nome: 'Lucas Tsai', papel: 'admin' },
  { id: 'p-carlos', nome: 'Prof. Carlos', papel: 'professor' },
  ...NOMES.map((nome, i) => ({ id: `p${i + 1}`, nome, papel: (i === 0 ? 'representante' : i === 1 ? 'monitor' : 'aluno') as Pessoa['papel'] })),
]

function ev(e: Partial<Evento> & Pick<Evento, 'id' | 'titulo' | 'inicio'>): Evento {
  return { escopo: 'pessoal', escopo_id: DEMO_ID, tipo: 'outro', dia_todo: false, origem: 'manual', status: 'oficial', cancelado: false, ...e }
}

const eventos: Evento[] = [
  // Pessoais
  ev({ id: 'e-academia', titulo: 'Academia', inicio: quando(0, '10:00'), fim: quando(0, '11:00'), local: 'Centro' }),
  ev({ id: 'e-revisar', titulo: 'Revisar POO', tipo: 'leitura', disciplina_id: 'd-poo', inicio: quando(0, '14:00'), fim: quando(0, '16:00'), descricao: 'Plano até a P1 · 2 de 4' }),
  ev({ id: 'e-churras', titulo: 'Churrasco da turma', inicio: quando(6, '15:00'), fim: quando(6, '18:00'), local: 'Casa do Rafael' }),
  ev({ id: 'e-trabalho', titulo: 'Trabalho', origem: 'importado', inicio: quando(1, '08:00'), fim: quando(1, '17:00'), rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }),
  ev({ id: 'e-sug', titulo: 'Estudar Estatística', tipo: 'leitura', disciplina_id: 'd-est', origem: 'archie', status: 'provavel', inicio: quando(6, '10:00'), fim: quando(6, '12:00'), descricao: 'Sugestão do Archie · 2 h livres antes da P1' }),
  // Turma
  ev({ id: 'e-p1poo', escopo: 'turma', escopo_id: 't-poo', disciplina_id: 'd-poo', titulo: 'P1 · POO', tipo: 'prova', origem: 'professor', inicio: quando(2, '19:00', 1), fim: quando(2, '20:40', 1), local: 'Sala 7', descricao: 'Classes, herança e polimorfismo · vale 40% da média' }),
  ev({ id: 'e-lista3', escopo: 'turma', escopo_id: 't-est', disciplina_id: 'd-est', titulo: 'Lista 3 · Estatística', tipo: 'entrega', origem: 'turma', status: 'confirmado_turma', inicio: quando(5, '23:59'), dia_todo: true }),
  ev({ id: 'e-ihc-canc', escopo: 'turma', escopo_id: 't-ihc', disciplina_id: 'd-ihc', titulo: 'IHC · aula cancelada', tipo: 'aula', origem: 'archie', cancelado: true, inicio: quando(5, '19:00'), fim: quando(5, '20:40'), documento_url: 'https://www.fatecid.com.br/site/' }),
  ev({ id: 'e-sprint', escopo: 'turma', escopo_id: 't-es2', disciplina_id: 'd-es2', titulo: 'Entrega · Sprint 2', tipo: 'entrega', origem: 'professor', inicio: quando(2, '20:50', 2), fim: quando(2, '22:30', 2), descricao: 'Apresentação em grupo · 10 min' }),
  // Fatec
  ev({ id: 'e-monitoria', escopo: 'unidade', escopo_id: null, titulo: 'Inscrições Monitoria 2027/1', tipo: 'data_especial', origem: 'archie', dia_todo: true, inicio: quando(1, '00:00'), fim: quando(5, '23:59'), documento_url: 'https://www.fatecid.com.br/site/editais/' }),
  ev({ id: 'e-aacc', escopo: 'curso', escopo_id: CURSO, titulo: 'Prazo AACC', tipo: 'entrega', origem: 'archie', dia_todo: true, inicio: quando(4, '00:00') }),
  ev({ id: 'e-feriado', escopo: 'unidade', escopo_id: null, titulo: 'Feriado · Consciência Negra', tipo: 'data_especial', origem: 'importado', dia_todo: true, inicio: '2026-11-20T03:00:00.000Z', documento_url: 'https://www.fatecid.com.br/site/calendario-academico/' }),
]

const propostas: Proposta[] = [
  {
    id: 'pr-p1est',
    turma_id: 't-est',
    tipo: 'novo_evento',
    titulo: 'A P1 de Estatística vai ser na quinta, 19:00?',
    dados: { titulo: 'P1 · Estatística', tipo: 'prova', inicio: quando(4, '19:00', 1), fim: quando(4, '20:40', 1), local: 'Sala 12' },
    origem: 'archie',
    trecho_origem: '“o carlos falou na aula que a P1 vai pra quinta, mesmo horário”',
    status: 'nao_confirmado',
    criado_por: 'p3',
    criado_em: quando(1, '21:10'),
    expira_em: somarDias(new Date(), 2.5).toISOString(),
  },
  {
    id: 'pr-dupla',
    turma_id: 't-est',
    tipo: 'outro',
    titulo: 'O trabalho em dupla vale 3 pontos?',
    dados: {},
    origem: 'turma',
    status: 'descartado',
    criado_por: 'p5',
    criado_em: quando(0, '20:00', -1),
    expira_em: quando(3, '20:00', -1),
  },
]

const votos: Voto[] = [
  ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((u) => ({ proposta_id: 'pr-p1est', usuario_id: u, valor: 'sim' as const })),
  { proposta_id: 'pr-p1est', usuario_id: 'p9', valor: 'nao' },
  ...['p1', 'p2', 'p3'].map((u) => ({ proposta_id: 'pr-dupla', usuario_id: u, valor: 'sim' as const })),
  ...['p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'].map((u) => ({ proposta_id: 'pr-dupla', usuario_id: u, valor: 'nao' as const })),
]

const mensagens: Mensagem[] = [
  { id: 'm1', turma_id: 't-est', canal: 'avisos', autor_id: 'p-carlos', texto: 'Slides da aula 7 (distribuição normal) publicados em Materiais.', fixada: true, criado_em: quando(1, '18:10') },
  { id: 'm2', turma_id: 't-est', canal: 'geral', autor_id: 'p2', texto: 'Monitoria de hoje confirmada, sala 4 às 18h.', fixada: false, criado_em: quando(1, '18:42') },
  { id: 'm3', turma_id: 't-est', canal: 'geral', autor_id: 'p3', texto: 'Gente, o Carlos falou na aula que a P1 vai pra quinta, mesmo horário.', fixada: false, criado_em: quando(1, '21:05') },
  { id: 'm4', turma_id: 't-est', canal: 'geral', autor_id: 'p1', texto: 'Criei a confirmação na aba Confirmações, votem lá!', fixada: false, criado_em: quando(1, '21:12') },
]

const reacoes: Reacao[] = [
  ...['p1', 'p2', 'p4', 'p5', 'p6'].map((u) => ({ alvo_tipo: 'mensagem' as const, alvo_id: 'm1', usuario_id: u, emoji: '👍' })),
  ...['p7', 'p8'].map((u) => ({ alvo_tipo: 'mensagem' as const, alvo_id: 'm1', usuario_id: u, emoji: '🙏' })),
  ...['p4', 'p6'].map((u) => ({ alvo_tipo: 'mensagem' as const, alvo_id: 'm4', usuario_id: u, emoji: '✅' })),
]

const duvidas: Duvida[] = [
  { id: 'dv1', turma_id: 't-est', autor_id: 'p6', texto: 'Na distribuição normal, quando uso a tabela Z e quando uso a t de Student?', resolvida: true, criado_em: quando(1, '22:40') },
  { id: 'dv2', turma_id: 't-poo', autor_id: 'p4', texto: 'Classe abstrata pode ter construtor?', resolvida: false, criado_em: quando(2, '21:00') },
]
const respostas: Resposta[] = [
  { id: 'r1', duvida_id: 'dv1', autor_id: 'p2', texto: 'Use t quando a variância da população é desconhecida e a amostra é pequena (n < 30). Está no slide 14 da aula 7.', fontes: [{ titulo: 'Aula 7 · Distribuição normal (slides)' }], confirmada_por: 'p-carlos', criado_em: quando(1, '23:02') },
]

const materiais: Material[] = [
  { id: 'mt1', dono_id: 'p-carlos', turma_id: 't-est', disciplina_id: 'd-est', tipo: 'link', titulo: 'Aula 7 · Distribuição normal (slides)', url: 'https://www.fatecid.com.br/site/', semana: 7, na_entrada: false, status_revisao: 'estudar_depois', oficial: true, criado_em: quando(1, '18:00') },
  { id: 'mt2', dono_id: DEMO_ID, turma_id: null, disciplina_id: 'd-poo', tipo: 'anotacao', titulo: 'Resumo · polimorfismo', conteudo: 'Sobrecarga = mesmo nome, parâmetros diferentes (compilação). Sobrescrita = subclasse redefine (execução).', semana: 8, na_entrada: false, status_revisao: 'estudar_depois', oficial: false, criado_em: quando(0, '15:00') },
  { id: 'mt3', dono_id: DEMO_ID, turma_id: null, disciplina_id: 'd-poo', tipo: 'link', titulo: 'Repositório de exemplos da aula', url: 'https://github.com/', semana: 8, na_entrada: false, status_revisao: 'ja_revisei', oficial: false, criado_em: quando(0, '15:30') },
  { id: 'mt4', dono_id: DEMO_ID, turma_id: null, disciplina_id: null, tipo: 'anotacao', titulo: 'Foto do quadro · ES II', conteudo: 'Diagrama de sequência do caso de uso “Sacar”.', na_entrada: true, status_revisao: 'estudar_depois', oficial: false, criado_em: quando(2, '22:35') },
]

const tarefas: Tarefa[] = [
  { id: 'tk1', usuario_id: DEMO_ID, titulo: 'Lista 3 de Estatística', coluna: 'fazendo', ordem: 1, prazo: quando(5, '12:00').slice(0, 10), disciplina_id: 'd-est', subtarefas: [{ texto: 'Exercícios 1–5', feita: true }, { texto: 'Exercícios 6–10', feita: false }], criado_em: agora },
  { id: 'tk2', usuario_id: DEMO_ID, titulo: 'Sprint 2 · diagrama de classes', coluna: 'a_fazer', ordem: 1, prazo: quando(2, '12:00', 2).slice(0, 10), disciplina_id: 'd-es2', subtarefas: [], criado_em: agora },
  { id: 'tk3', usuario_id: DEMO_ID, titulo: 'Entregar horas de AACC', coluna: 'a_fazer', ordem: 2, prazo: quando(4, '12:00').slice(0, 10), disciplina_id: null, subtarefas: [], criado_em: agora },
  { id: 'tk4', usuario_id: DEMO_ID, titulo: 'Resumo de polimorfismo', coluna: 'feito', ordem: 1, prazo: null, disciplina_id: 'd-poo', subtarefas: [], criado_em: agora },
]

const hoje = new Date().toISOString().slice(0, 10)
const revisao: ItemRevisao[] = [
  { id: 'rv1', usuario_id: DEMO_ID, disciplina_id: 'd-poo', pergunta: 'Qual a diferença entre sobrecarga e sobrescrita?', resposta: 'Sobrecarga: mesmo nome, parâmetros diferentes (compilação). Sobrescrita: a subclasse redefine o método (execução).', proxima_em: hoje, intervalo_dias: 1, facilidade: 2.5, repeticoes: 1 },
  { id: 'rv2', usuario_id: DEMO_ID, disciplina_id: 'd-est', pergunta: 'Quando usar a distribuição t de Student?', resposta: 'Quando a variância da população é desconhecida e a amostra é pequena.', proxima_em: hoje, intervalo_dias: 3, facilidade: 2.4, repeticoes: 2 },
  { id: 'rv3', usuario_id: DEMO_ID, disciplina_id: 'd-ihc', pergunta: 'Cite 3 heurísticas de Nielsen.', resposta: 'Visibilidade do status, controle e liberdade do usuário, prevenção de erros.', proxima_em: somarDias(new Date(), 2).toISOString().slice(0, 10), intervalo_dias: 6, facilidade: 2.6, repeticoes: 3 },
]

const avaliacoes: Avaliacao[] = [
  { id: 'av1', turma_id: 't-poo', nome: 'P1', peso: 4 },
  { id: 'av2', turma_id: 't-poo', nome: 'P2', peso: 4 },
  { id: 'av3', turma_id: 't-poo', nome: 'Trabalho', peso: 2 },
  { id: 'av4', turma_id: 't-est', nome: 'P1', peso: 5 },
  { id: 'av5', turma_id: 't-est', nome: 'P2', peso: 5 },
]
const notas: Nota[] = [{ usuario_id: DEMO_ID, avaliacao_id: 'av3', valor: 8.5 }]
const frequencia: Frequencia[] = [
  { usuario_id: DEMO_ID, turma_id: 't-poo', data: quando(1, '19:00', -1).slice(0, 10), presente: true, aulas: 2 },
  { usuario_id: DEMO_ID, turma_id: 't-poo', data: quando(2, '19:00', -1).slice(0, 10), presente: false, aulas: 2 },
  { usuario_id: DEMO_ID, turma_id: 't-est', data: quando(1, '20:50', -1).slice(0, 10), presente: true, aulas: 2 },
]

const fontes: Fonte[] = [
  { id: 'f1', tenant_id: TENANT, nome: 'Home do site (avisos)', url: 'https://www.fatecid.com.br/site/', tipo: 'pagina', extrator: 'avisos', frequencia_min: 60, status: 'ativa', ultima_verificacao: haMin(25) },
  { id: 'f2', tenant_id: TENANT, nome: 'Calendário Acadêmico', url: 'https://www.fatecid.com.br/site/index.php/calendario-academico/', tipo: 'pagina', extrator: 'calendario', frequencia_min: 120, status: 'ativa', ultima_verificacao: haMin(55) },
  { id: 'f3', tenant_id: TENANT, nome: 'Grade de Horários e Salas', url: 'https://www.fatecid.com.br/site/index.php/grade-de-horarios-e-salas/', tipo: 'pagina', extrator: 'grade', frequencia_min: 120, status: 'ativa', ultima_verificacao: haMin(53) },
  { id: 'f4', tenant_id: TENANT, nome: 'Editais', url: 'https://www.fatecid.com.br/site/index.php/editais/', tipo: 'pagina', extrator: 'geral', frequencia_min: 360, status: 'erro', ultimo_erro: 'o site recusou o acesso (403). Peça à TI da unidade para liberar o coletor.', ultima_verificacao: haMin(140) },
]

const capturas: UltimaCaptura[] = [
  { fonte_id: 'f1', titulo: 'Comunicado importante', itens: 0, capturado_em: haMin(60 * 20) },
  { fonte_id: 'f2', titulo: 'UN-12_03_26_Calendario-Academico-2026_retificado-sem-logo-2.pdf', itens: 41, capturado_em: haMin(60 * 50) },
  { fonte_id: 'f3', titulo: 'ADS_NOT.pdf', itens: 34, capturado_em: haMin(60 * 50 - 2) },
]

const curadoria: ItemCuradoria[] = [
  { id: 'c1', item_tipo: 'evento_mudanca', item_id: 'e-cn', fonte_id: 'f2', confianca: 0.7, motivo: 'confiança abaixo do limite', resumo: 'Feriado · Consciência Negra: termina em 21/11', dados: { trecho: '20 e 21 Não haverá aula – feriado e emenda – Dia da Consciência Negra', documento_url: 'https://www.fatecid.com.br/site/wp-content/uploads/2026/08/UN-12_03_26_Calendario-Academico-2026_retificado-sem-logo-2.pdf' }, criado_em: haMin(60 * 50 - 1) },
  { id: 'c2', item_tipo: 'disciplina_nova', fonte_id: 'f3', confianca: 0.95, motivo: 'estrutura nova: confira o nome antes de aprovar', resumo: 'Disciplina nova: G.G.T.I. (3º sem.) · ter 19:00–20:40 (Lab. 13); qua 20:50–22:30 (Lab. 13)', dados: { nome_no_pdf: 'G.G.T.I.', professor_nome: 'Michel', documento_url: 'https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf' }, criado_em: haMin(60 * 50 - 2) },
  { id: 'c3', item_tipo: 'disciplina_nova', fonte_id: 'f3', confianca: 0.95, motivo: 'estrutura nova: confira o nome antes de aprovar', resumo: 'Disciplina nova: Economia e Finanças (3º sem.) · seg 20:50–22:30 (Sala 9)', dados: { nome_no_pdf: 'ECONOMIA E FINANÇAS', professor_nome: 'Reinaldo', documento_url: 'https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf' }, criado_em: haMin(60 * 50 - 2) },
  { id: 'c4', item_tipo: 'evento_sumiu', item_id: 'e-rev', fonte_id: 'f2', confianca: 0.5, motivo: 'não está na nova versão do documento', resumo: 'Não aparece mais: Revisão de médias · 15/12', dados: {}, criado_em: haMin(60 * 50 - 1) },
  { id: 'c5', item_tipo: 'grade_turma', item_id: 't-poo', fonte_id: 'f3', confianca: 0.95, resumo: 'Horário de Programação Orientada a Objetos: sex 19:00–22:30 (Lab. 1 / Lab. 3 / Lab. 4)', decisao: 'aprovado', decidido_em: haMin(60 * 50 - 2), dados: { professor_nome: 'Sérgio Furgeri', aulas: [{ dia_semana: 5, inicio: '19:00', fim: '22:30', sala: 'Lab. 1 / Lab. 3 / Lab. 4' }], antes: { aulas: [{ dia_semana: 1, inicio: '19:00', fim: '20:40', sala: 'Sala 7' }, { dia_semana: 2, inicio: '19:00', fim: '20:40', sala: 'Sala 7' }], professor_nome: 'Prof. Furgeri' }, documento_url: 'https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf' }, criado_em: haMin(60 * 50 - 2) },
  { id: 'c6', item_tipo: 'evento_novo', fonte_id: 'f2', confianca: 0.95, resumo: 'Sem aula · Dia do Professor · 15/10', decisao: 'aprovado', decidido_em: haMin(60 * 50 - 1), dados: { trecho: '15 Não haverá aula - Dia do Professor (Decreto Federal nº 52.682/1963)' }, criado_em: haMin(60 * 50 - 1) },
]

const archieStatus: ArchieStatus[] = [
  { worker: 'pc-do-lucas', versao: '0.1.0', modelos: { texto_imagem: 'qwen3.5:9b', embedding: 'qwen3-embedding:0.6b' }, iniciado_em: haMin(60 * 23), ultimo_sinal: new Date(Date.now() - 40_000).toISOString(), tarefa_atual: null, processadas: 37, erros: 2, ultimo_erro: 'Editais: o site recusou o acesso (403).' },
]

const preferencias: AgendaPreferencias = {
  usuario_id: DEMO_ID,
  camadas_ocultas: [],
  lembretes_padrao: { prova: [1440, 120], entrega: [2880, 180], aula: [15], outro: [30] },
  hora_inicio: 8,
  hora_fim: 23,
  mostrar_sugestoes: true,
  mostrar_propostas: true,
  ics_token: 'demonstracao',
}

// Pedidos para entrar em turmas: um seu (aguardando) e um de colega para você aprovar como admin.
const pedidos: PedidoTurma[] = [
  { id: 'pd-1', turma_id: 't-ed', usuario_id: DEMO_ID, mensagem: 'Faço por aproveitamento de estudos.', status: 'pendente', criado_em: haMin(90), decidido_em: null },
  { id: 'pd-2', turma_id: 't-est', usuario_id: 'p3', mensagem: null, status: 'pendente', criado_em: haMin(30), decidido_em: null },
]

const acervo: ItemAcervo[] = [
  {
    id: 'ac-1', disciplina_id: 'd-poo', autor_id: 'p2', tipo: 'prova_antiga', titulo: 'P1 de POO · 2025/2 (com resolução)',
    descricao: 'Prova de herança e polimorfismo, resolvida por mim depois da correção.', periodo_origem: '2025/2', link_url: null,
    arquivo_chave: 'demo/p1-poo.pdf', arquivo_nome: 'p1-poo-2025-2.pdf', arquivo_tamanho: 412_000, arquivo_mime: 'application/pdf',
    status: 'publicado', moderacao: { motivo: 'Conteúdo acadêmico da disciplina.', confianca: 0.93, origem: 'archie' }, moderado_em: haMin(4000), criado_em: haMin(4100),
  },
  {
    id: 'ac-2', disciplina_id: 'd-poo', autor_id: 'p4', tipo: 'resumo', titulo: 'Resumo de padrões de projeto (GoF)',
    descricao: null, periodo_origem: '2026/1', link_url: 'https://refactoring.guru/pt-br/design-patterns', arquivo_chave: null, arquivo_nome: null,
    arquivo_tamanho: null, arquivo_mime: null, status: 'publicado', moderacao: { motivo: 'Link acadêmico.', confianca: 0.9, origem: 'archie' },
    moderado_em: haMin(9000), criado_em: haMin(9100),
  },
  {
    id: 'ac-3', disciplina_id: 'd-est', autor_id: 'p5', tipo: 'lista', titulo: 'Lista de exercícios · distribuição normal',
    descricao: null, periodo_origem: '2026/1', link_url: null, arquivo_chave: 'demo/lista.pdf', arquivo_nome: 'lista-normal.pdf',
    arquivo_tamanho: 220_000, arquivo_mime: 'application/pdf', status: 'quarentena',
    moderacao: { motivo: 'O arquivo tem CPF e telefone de pessoas.', categorias: ['dados_pessoais'], confianca: 0.97, origem: 'verificacao',
      sha256: '9f2c…a71e', tipo_detectado: 'PDF', verificacoes: ['tipo do arquivo', 'código embutido', 'dados pessoais'], trecho: 'CPF ***.***.***-** · (19) 9****-****' },
    moderado_em: haMin(50), criado_em: haMin(55),
  },
]

const cursos: Curso[] = [{ id: CURSO, tenant_id: TENANT, nome: 'Análise e Desenvolvimento de Sistemas', sigla: 'ADS', semestres: 6 }]

export const demo = {
  tenant,
  perfil,
  cursos,
  disciplinas,
  turmas,
  matriculas: turmas.slice(0, 6).map((t) => ({ usuario_id: DEMO_ID, turma_id: t.id, papel_turma: 'aluno' as const })),
  pedidos,
  codigos: { 't-est': 'K7PX4M' } as Record<string, string>,
  acervo,
  aulas,
  pessoas,
  eventos,
  propostas,
  votos,
  mensagens,
  reacoes,
  duvidas,
  respostas,
  materiais,
  tarefas,
  revisao,
  avaliacoes,
  notas,
  frequencia,
  fontes,
  capturas,
  curadoria,
  archieStatus,
  preferencias,
}

/** Simula a latência da rede para os estados de carregamento aparecerem. */
export function espera<T>(valor: T, ms = 120): Promise<T> {
  return new Promise((r) => setTimeout(() => r(structuredClone(valor)), ms))
}
