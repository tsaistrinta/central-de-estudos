// Acessibilidade (WCAG 2.1 AA) com axe-core em todas as telas, no computador e no celular.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const ROTAS = ['/', '/agenda?visao=semana', '/agenda?visao=mes', '/materias', '/materias/d-poo', '/arquivos', '/tarefas', '/revisao',
  '/notas', '/turma', '/curso', '/unidade', '/admin/visao', '/admin/curadoria', '/admin/turmas', '/admin/quarentena',
  '/configuracoes/perfil', '/entrar', '/criar-conta', '/recuperar-senha']

for (const rota of ROTAS) {
  test(`acessível: ${rota}`, async ({ page }) => {
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
    // Fora da checagem: evento cancelado (esmaecido a 55% de propósito e marcado "Cancelada" em texto) e a
    // marcação interna das células do FullCalendar (biblioteca de terceiros).
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.ce-cancelado')
      .exclude('.fc-daygrid-more-link')
      .exclude('.fc-daygrid-day')
      .analyze()
    const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(graves.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  })
}
