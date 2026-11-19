// Fluxos de aluno, do jeito que ele usa (caixa-preta, modo demonstração).
import { expect, test } from '@playwright/test'

test.describe('aluno', () => {
  test.skip(({ isMobile }) => !!isMobile, 'fluxos completos no computador; o celular é coberto em telas.spec')

  test('guarda uma anotação sem matéria e depois organiza', async ({ page }) => {
    await page.goto('/arquivos')
    await page.getByRole('button', { name: 'Adicionar arquivo' }).first().click()
    await page.getByRole('button', { name: /Anotação/ }).click()
    await page.getByLabel('Título').fill('Anotação do teste ponta a ponta')
    await page.getByLabel('Texto').fill('Herança múltipla não existe em Java.')
    await page.getByRole('button', { name: 'Salvar' }).click()
    const item = page.getByRole('listitem').filter({ hasText: 'Anotação do teste ponta a ponta' })
    await expect(item).toBeVisible()
    await item.getByLabel('Matéria do arquivo').selectOption({ label: 'Programação Orientada a Objetos' })
    await item.getByRole('button', { name: 'Guardar na matéria' }).click()
    // Saiu de "Para organizar" e está nos guardados, com a matéria.
    await page.getByLabel('Filtrar por matéria').selectOption({ label: 'Programação Orientada a Objetos' })
    await expect(page.getByRole('listitem').filter({ hasText: 'Anotação do teste ponta a ponta' })).toContainText('Programação Orientada a Objetos')
    await page.getByLabel('Buscar nos seus arquivos').fill('heranca')
    await expect(page.getByText('Anotação do teste ponta a ponta')).toBeVisible()
  })

  test('cria evento escrevendo uma frase', async ({ page }) => {
    await page.goto('/agenda?visao=semana')
    await page.getByRole('button', { name: /Novo evento/ }).first().click()
    await page.getByPlaceholder('estudar estatística sábado 10h por 2h').fill('estudar estatística sábado 10h por 2h')
    await page.getByRole('button', { name: 'Usar' }).click()
    await expect(page.getByPlaceholder('Adicione um título')).toHaveValue('Estudar estatística')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await page.getByRole('button', { name: /^Lista$/ }).click()
    await expect(page.getByText('Estudar estatística').first()).toBeVisible()
  })

  test('entra numa matéria com o código da turma', async ({ page }) => {
    await page.goto('/materias')
    await page.getByRole('button', { name: 'Adicionar matéria' }).click()
    const form = page.locator('form').filter({ has: page.locator('#cod-turma') })
    await page.locator('#cod-turma').fill('ZZZZZZ')
    await form.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(/código.*(inválido|não)/i)).toBeVisible()
    await page.locator('#cod-turma').fill('gp7r2k')
    await form.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Gestão de Projetos').first()).toBeVisible()
  })

  test('pede para entrar numa matéria e fica aguardando', async ({ page }) => {
    await page.goto('/materias')
    await page.getByRole('button', { name: 'Adicionar matéria' }).click()
    const linha = page.getByRole('listitem').filter({ hasText: 'Programação para Dispositivos Móveis' })
    await linha.getByRole('button', { name: 'Pedir para entrar' }).click()
    await expect(linha.getByText('Aguardando')).toBeVisible()
  })

  test('recuperar senha pede código, não link', async ({ page }) => {
    await page.goto('/recuperar-senha')
    await expect(page.getByText('Enviaremos um código de 6 dígitos para o seu e-mail.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Receber código' })).toBeVisible()
  })

  test('aula mostra a fonte oficial da grade', async ({ page }) => {
    await page.goto('/materias/d-poo')
    const fonte = page.getByRole('link', { name: /Grade oficial: ADS_NOT\.pdf/ })
    await expect(fonte).toHaveAttribute('href', /^https:\/\/www\.fatecid\.com\.br\/.*ADS_NOT\.pdf#page=1$/)
  })

  test('busca global com Ctrl+K leva à matéria pelo teclado', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading').first()).toBeVisible() // app montado
    await page.keyboard.press('Control+k')
    const busca = page.getByRole('dialog', { name: 'Busca global' })
    await expect(busca).toBeVisible()
    await page.keyboard.type('estatist')
    await expect(busca.getByRole('option', { name: /Estatística/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/materias\/d-est$/)
    await expect(busca).toBeHidden()
  })

  test('ação "Novo evento" da busca abre o formulário na agenda', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Buscar/ }).click()
    await page.getByRole('option', { name: 'Novo evento na agenda' }).click()
    await expect(page.getByPlaceholder('Adicione um título')).toBeVisible()
  })
})
