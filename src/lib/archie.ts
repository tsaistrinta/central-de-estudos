// Rótulos e regras das telas do Archie no painel admin (Fase 5).

import type { ExtratorFonte, TipoCuradoria, ArchieStatus } from '@/types'

export const ROTULO_EXTRATOR: Record<ExtratorFonte, { nome: string; ajuda: string }> = {
  calendario: { nome: 'Calendário', ajuda: 'Lê o PDF do calendário acadêmico e põe as datas na agenda.' },
  grade: { nome: 'Grade de horários', ajuda: 'Lê os PDFs de horário dos cursos e atualiza aulas, salas e professores.' },
  avisos: { nome: 'Avisos em imagem', ajuda: 'Olha os banners e comunicados da página e tira as datas.' },
  geral: { nome: 'Só guardar o texto', ajuda: 'Guarda o texto para o Archie consultar depois (busca).' },
}

export const ROTULO_CURADORIA: Record<TipoCuradoria, string> = {
  evento_novo: 'Data nova',
  evento_provavel: 'Publicado como provável',
  evento_mudanca: 'Data mudou',
  evento_sumiu: 'Sumiu do documento',
  grade_turma: 'Horário da turma',
  disciplina_nova: 'Disciplina ou turma nova',
}

/** O que acontece ao aprovar, para o admin saber antes de clicar. */
export const EFEITO_APROVAR: Record<TipoCuradoria, string> = {
  evento_novo: 'cria o evento como Oficial',
  evento_provavel: 'troca o selo para Oficial',
  evento_mudanca: 'atualiza a data (quem editou a própria versão é avisado)',
  evento_sumiu: 'marca o evento como cancelado',
  grade_turma: 'troca as aulas da turma e avisa os alunos matriculados',
  disciplina_nova: 'cria a disciplina, a turma e as aulas',
}

export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Worker que mandou sinal nos últimos 3 minutos está no ar. */
export function workerNoAr(s: ArchieStatus, agora = Date.now()) {
  return agora - new Date(s.ultimo_sinal).getTime() < 3 * 60_000
}
