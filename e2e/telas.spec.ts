// Todas as telas abrem sem erro no console, sem rolagem lateral e com conteúdo.
import { expect, test } from '@playwright/test'

const ROTAS = ['/', '/agenda?visao=dia', '/agenda?visao=semana-util', '/agenda?visao=semana', '/agenda?visao=mes', '/agenda?visao=lista',
  '/materias', '/materias/d-poo', '/arquivos', '/tarefas', '/revisao', '/notas', '/turma', '/curso', '/unidade',
  '/admin/visao', '/admin/fontes', '/admin/curadoria', '/admin/contas', '/admin/entradas', '/admin/quarentena', '/admin/turmas',
  '/admin/servidor', '/configuracoes/perfil', '/configuracoes/notificacoes', '/configuracoes/agenda', '/configuracoes/privacidade',
  '/entrar', '/criar-conta', '/recuperar-senha']

for (const rota of ROTAS) {
  test(`abre ${rota}`, async ({ page }) => {
    const erros: string[] = []
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    page.on('pageerror', (e) => erros.push(String(e)))
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
    expect(erros, erros.join('\n')).toEqual([])
    expect((await page.innerText('body')).trim().length).toBeGreaterThan(40)
    const largura = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(largura[0], 'rolagem lateral').toBeLessThanOrEqual(largura[1] + 1)
  })
}

test('/entrada antiga leva a Meus arquivos', async ({ page }) => {
  await page.goto('/entrada')
  await expect(page).toHaveURL(/\/arquivos$/)
  await expect(page.getByRole('heading', { name: 'Meus arquivos' })).toBeVisible()
})

test('rota que não existe mostra página de não encontrada', async ({ page }) => {
  await page.goto('/nao-existe')
  await expect(page.getByText(/não encontrada/i)).toBeVisible()
})
