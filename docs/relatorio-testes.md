# Relatório de testes e qualidade — 19/11/2026

Resumo do que foi verificado na Central de Estudos e do resultado. Tudo roda sozinho a cada push no GitHub
(`.github/workflows/ci.yml`).

## Números

| Tipo | Ferramenta | Quantidade | Resultado |
|---|---|---|---|
| Caixa-branca · regras do app | Vitest (`src/lib/__tests__`) | 24 | todos passam |
| Caixa-branca · Archie (leitura, dupla leitura, publicação, moderação) | pytest + Postgres 16 | 50 | todos passam |
| Caixa-branca · segurança do banco (regras de acesso por papel, LGPD) | pytest + Postgres 16 (`tests/test_seguranca.py`) | 34 | todos passam |
| Caixa-preta · telas (computador e celular) | Playwright (`e2e/telas.spec.ts`) | 70 | todas abrem sem erro |
| Caixa-preta · fluxos de aluno | Playwright (`e2e/fluxos.spec.ts`) | 8 | todos passam |
| Acessibilidade WCAG 2.1 AA | axe-core (`e2e/acessibilidade.spec.ts`) | 40 | nenhuma falha séria |
| Desempenho do banco | carga sintética (600 alunos, 22 mil eventos, 65 mil mensagens) | 7 consultas | todas abaixo de 10 ms |

## Problemas encontrados pelos testes (e corrigidos)

1. **Limite de códigos de turma não funcionava.** O erro de código inválido desfazia o registro da tentativa;
   dava para chutar códigos sem limite. Corrigido (`20261119000200_limite_de_codigos.sql`).
2. **Edições podiam mover ou promover conteúdo.** Editando algo seu, um aluno conseguia transformar a mensagem em
   "aviso do professor", mover material para outra turma, marcá-lo como oficial ou mudar o voto de votação.
   Corrigido com travas no banco (`20261119000700_edicoes_seguras.sql`).
3. **Semestre errado de Sociedade e Tecnologia e IHC.** Dado provisório do seed + o Archie aceitando nome igual em
   outro semestre. Corrigido no banco e no Archie (só liga disciplina do mesmo semestre e da mesma matriz).
4. **Duas turmas de Engenharia de Software II viravam uma.** A Fatec roda a matriz antiga e a nova; agora são
   separadas (`disciplinas.matriz`).
5. **Busca "Ctrl K" sem função.** Era só um enfeite; virou busca global de verdade.
6. **Contraste insuficiente** em selos e textos secundários e campos sem rótulo para leitor de tela.
7. **Textos com plural preguiçoso** ("aula(s)", "em 0 d", "Bom dia" de madrugada).
8. **Regras de acesso lentas em escala**: 68 políticas recalculavam o usuário linha por linha
   (materiais de uma matéria: 22 ms → 3 ms).
9. **Recuperação de senha por link** quebrava no e-mail institucional (o Microsoft 365 abre o link antes);
   virou código de 6 dígitos.

## Como rodar

```bash
npm test                      # unidade (Vitest)
npm run test:e2e              # telas, fluxos e acessibilidade (Playwright, modo demonstração)
cd workers/archie && pytest   # Archie + segurança do banco (precisa de Postgres 16, veja docs/archie.md)
```
