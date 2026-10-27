# Identidade Foco — telas desktop (2026-10-27)

Referência visual para o novo frontend (React + Vite + Tailwind + shadcn/ui).
Artifact publicado: "Central de Estudos Foco" (39 telas em 1440×900 + Fundamentos). PNGs no zip `central-estudos-foco-telas.zip`.
Decisões da identidade em `claude/identidade-foco-prompts-base44.md` (arquivo do chat de frontend — ainda não está neste repositório).

## Tokens (CSS)
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
:root {
  --background: #f6f7f9;  --card: #ffffff;  --popover: #ffffff;
  --foreground: #14171f;  --muted-foreground: #5f6675;
  --border: #e5e7ec;      --input: #e5e7ec;  --ring: #2f4ad0;
  --primary: #2f4ad0;     --primary-foreground: #ffffff;  --primary-hover: #2740b8;
  --accent: #eaeefc;      --accent-foreground: #2f4ad0;
  --success: #16834f;     --success-soft: #e6f4ec;
  --warning: #b7700b;     --warning-soft: #fbf0dc;
  --destructive: #cc3a3a; --destructive-soft: #fbeaea;
  --highlight: #fdf0b8;
  --radius: 8px;          /* botões e inputs: calc(var(--radius) - 2px) */
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
  /* cores de matéria e grupo */
  --subject-cobalto: #3b5bdb; --subject-azul: #1c7ed6; --subject-petroleo: #0c8599; --subject-verde: #2b8a3e;
  --subject-mostarda: #a07400; --subject-laranja: #e8590c; --subject-framboesa: #c2255c; --subject-roxo: #5f3dc4;
  /* tipos de evento */
  --evt-prova: #cc3a3a; --evt-entrega: #b7700b; --evt-trabalho: #5f3dc4; --evt-apresentacao: #2f4ad0;
  --evt-aula: #1c7ed6; --evt-reuniao: #0c8599; --evt-leitura: #2b8a3e; --evt-projeto: #e8590c;
  --evt-lembrete: #5f6675; --evt-data-especial: #c2255c; --evt-outro: #5f6675;
}
```

## Regras de layout
- Tela de referência 1440×900; sidebar fixa de 224 px (branca, borda direita); conteúdo com padding 22 px 32 px sobre `--background`.
- Gap entre blocos 14–16 px. Raio: cards 8, botões/inputs 6, modais 12, pílulas 999. Controles com 34–36 px de altura.
- Ícones Lucide (traço 1.75). Fontes Geist e Geist Mono (datas, números, atalhos, código).
- Uma única cor de ação (#2f4ad0). Cor de matéria só como ponto de 8 px (raio 3) ou quadrado de 30–36 px com ícone branco; sem faixas coloridas em cards.
- Status: "Estudar depois" = aviso (#b7700b/#fbf0dc); "Já revisei" = sucesso (#16834f/#e6f4ec). Eventos: pílula com texto na cor e fundo a 13%.
- Sidebar: marca, busca (Ctrl K), Início, Cursos, Semestres, Materiais, Documentos, Agenda, Biblioteca, Revisar (contador), matérias do semestre atual, rodapé com usuário e engrenagem (Configurações).

## Telas

### Acesso e primeiro uso
- **01 · Entrar** — Google e Microsoft no MVP (sem Apple). “Esqueci minha senha” leva à tela 03. Erro de credencial aparece abaixo do campo de senha, em vermelho.
- **02 · Criar conta** — Aceite dos Termos e da Política é obrigatório (LGPD): o botão só habilita com a caixa marcada. Medidor de força da senha ao digitar.
- **03 · Recuperar senha** — Depois de enviar, o aviso verde aparece no lugar do botão. Usa o fluxo de reset do Supabase Auth com e-mail pelo Resend.
- **04 · Primeiro acesso** — Assistente em 3 passos para quem não tem nenhum curso: Curso → Semestre → Matérias. “Pular” leva ao Início vazio.

### Início e busca
- **05 · Início** — Saudação muda com a hora (Bom dia / Boa tarde / Boa noite). Card escuro some quando não há pendências (“Tudo revisado”). Próximos prazos: até 4 eventos futuros.
- **06 · Busca global (Ctrl K)** — Abre com Ctrl/Cmd+K ou pelo campo da sidebar. Resultados agrupados por tipo, navegação por teclado. Full-text em português no Postgres.

### Cursos, semestres e matérias
- **07 · Cursos** — Um card por curso, com contagens e % revisado.
- **08 · Curso** — Semestres do curso. O semestre marcado como “Atual” é o que aparece na sidebar.
- **09 · Semestre** — Tabela de matérias com professor, nº de materiais, % revisado e próximo prazo. Ações da linha no menu “⋮” (aparece no hover).
- **10 · Nova matéria** — Paleta fixa de 8 cores. A cor escolhida vale para pontos, barras, calendário e grafo.
- **11 · Matéria** — Página da matéria com abas Materiais / Documentos / Prazos e coluna lateral com progresso, prazos e etiquetas. É o destino dos links da sidebar.
- **12 · Semestres** — Visão geral de todas as matérias agrupadas por curso e semestre. Alterna entre Lista, Tabela e Linha do tempo.

### Materiais
- **13 · Materiais · Lista** — Visão padrão. Filtros combinam entre si. Selecionar linhas mostra a barra de ações em lote embaixo.
- **14 · Materiais · Quadro** — Arrastar um card entre colunas muda o status de revisão.
- **15 · Materiais · Por matéria** — Grupos recolhíveis por matéria, com cards em grade.
- **16 · Detalhe do material** — Painel lateral (drawer) ao clicar numa linha. Prévia do arquivo, status, metadados, etiquetas e descrição. Esc fecha.
- **17 · Novo material · Arquivo** — Upload direto ao R2 por URL pré-assinada, com barra de progresso. Mostra a cota usada. Salvar só habilita ao terminar o envio.
- **18 · Novo material · Código** — Editor com destaque de sintaxe (ex.: CodeMirror ou Shiki). A linguagem define o realce.

### Documentos
- **19 · Documentos** — Grade de documentos com trecho, grupo, nº de links e data. Filtro por grupo em chips.
- **20 · Editor de documento** — Tiptap. Digitar [[ abre o autocomplete; o link guarda o id do documento. Coluna direita com grupo, matéria, etiquetas, backlinks e links de saída. Salvamento automático.
- **21 · Grafo de conexões** — react-force-graph. Nó selecionado destaca as ligações em azul e abre o resumo à direita. Cores pelos grupos.
- **22 · Importar arquivos** — .md/.txt/.docx viram documentos editáveis; PDF e imagens viram anexos. Vários arquivos por vez.

### Agenda
- **23 · Agenda · Mês** — Eventos concluídos aparecem riscados. Coluna lateral com resumo por tipo e próximos eventos.
- **24 · Agenda · Dia** — Grade por hora com linha vermelha marcando o horário atual. Eventos sem horário ficam em “Dia todo”.
- **25 · Novo evento** — Tipo escolhido por pílulas coloridas. Descrição aceita [[ ]] para linkar documentos e materiais. Lembrete por e-mail opcional.

### Estudo
- **26 · Biblioteca de código** — Lista os materiais do tipo Código. Busca dentro do conteúdo. Botão Copiar copia o código.
- **27 · Revisar agora** — Fila de “Estudar depois”. Atalhos J/K, O e R. Ao marcar, o item sai com animação e o progresso sobe.

### Conta, plano e LGPD
- **28 · Configurações · Perfil** — Nome de exibição usado na saudação. Preferências simples com interruptores.
- **29 · Configurações · Conta e segurança** — E-mail, senha, logins sociais conectados e sessões ativas.
- **30 · Configurações · Plano e armazenamento** — Lê plano_usuario (tier, cota_bytes, bytes_usados). A barra é dividida por tipo de arquivo.
- **31 · Configurações · Privacidade e dados** — Exportar meus dados (.zip com JSON + arquivos) e excluir conta (apaga banco e R2). Exigências da LGPD.
- **32 · Planos** — Fase 2 (Stripe). Preços ainda em validação. O botão do plano atual fica desabilitado.

### Estados
- **33 · Lista vazia** — Todo lugar que lista coisas tem um estado vazio que explica o que fazer e oferece a ação principal.
- **34 · Carregando** — Skeletons no formato do conteúdo final, sem spinner na página inteira.
- **35 · Erro de conexão** — Faixa vermelha no topo + estado de erro no lugar da lista, com “Tentar de novo”.
- **36 · Confirmar exclusão** — Exclusões em cascata pedem para digitar o nome e listam o que será apagado. Exclusões simples usam o toast com Desfazer.
- **37 · Toasts** — Canto inferior direito, somem em 5 s. Sucesso escuro com Desfazer; erro claro com ícone vermelho.
- **38 · Armazenamento cheio** — Aparece quando a Edge Function recusa o upload por cota. Leva a “Gerenciar arquivos” (tela 30) ou a Planos.
- **39 · Página não encontrada** — Rota inexistente ou item excluído.
