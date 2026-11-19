# Archie v1 (Fase 5) — como funciona e como ligar

> O nome é uma homenagem ao Dr. Archimedes Lammoglia, patrono da Fatec Indaiatuba.

O Archie é o worker em `workers/archie/` (Python 3.12 + Ollama). Roda no seu PC, **só faz conexões de saída**
(site da Fatec, banco do Supabase e o Ollama local) e, se parar, o app continua no ar.

```
fontes (site) ──► coletor ──► mudou? ──► leitura ──► decisão ──► agenda / grade
                  robots.txt   hash       posição      confiança     curadoria (admin)
                  5 s/pedido   por PDF    ou IA        ≥ 0,85 / 0,6   histórico
```

## O que ele lê hoje

| Fonte (seed) | Lê como | Como | Resultado |
|---|---|---|---|
| Calendário Acadêmico | `calendario` | acha o PDF na página; tira a grade de números de cada mês; a IA (Qwen3.5) devolve as datas em JSON | eventos da unidade ou do curso (os de outros cursos são ignorados) |
| Grade de Horários e Salas | `grade` | baixa só os PDFs dos cursos do tenant; **lê pela posição do texto** (coluna = semestre, linha = par de horários); se o layout mudar, a IA olha a página como imagem | aulas, salas e professores de cada turma |
| Home do site | `avisos` | banners e "comunicado importante" são imagens: a IA (visão) diz se é aviso para alunos e tira as datas | eventos prováveis + texto do aviso |
| Editais | `geral` | só guarda o texto | base de conhecimento (busca da Fase 6) |

Teste real (16/11): o PDF `ADS_NOT.pdf` (2026/2) foi lido inteiro pela posição — 34 aulas do 3º ao 6º semestre,
sem IA. Ele mostrou que o seed provisório estava errado (ex.: IHC e Sociedade e Tecnologia são do 4º semestre;
o 3º tem Inglês III, Economia e Finanças e G.G.T.I.). Os testes usam as posições reais desse PDF
(`workers/archie/tests/fixtures/`).

## Regras de publicação

**Dupla leitura (desde 19/11/2026).** Nada é publicado sozinho com uma leitura só. Cada documento é lido por dois
caminhos independentes (`archie/conferencia.py`):

- **Grade de horários:** leitura pela posição do texto no PDF (sem IA) × leitura da imagem da página (IA).
  Compara disciplina por disciplina: semestre, dias, horários, sala e professor.
- **Calendário:** a IA lê o texto; um conferente sem IA acha no documento a linha que ela citou, lê o dia no começo
  da linha e o mês do cabeçalho acima, e compara com a data devolvida.
- **Aviso em imagem:** a IA lê o aviso; numa segunda passada só transcreve a imagem, e cada data tem de aparecer
  na transcrição.

Se as leituras não batem, o item **não chega aos alunos**: fica na curadoria com as duas versões lado a lado e o link
da fonte (com a página do PDF). Uma disciplina da grade só é ligada a uma disciplina **do mesmo semestre**; nome igual
em outro semestre vira pendência ("já existe no 3º, o PDF mostra no 4º"), e duas disciplinas do PDF nunca são
juntadas numa turma só. `ARCHIE_EXIGIR_APROVACAO=true` faz tudo passar pelo admin.

Com as leituras batendo:

- **≥ 0,85** → publica sozinho como **Oficial**, com o link da fonte (`eventos.origem = 'archie'`, `fonte_id`, `documento_url`).
- **≥ 0,6** → publica como **Provável** e abre um item na curadoria.
- **< 0,6** → não publica; só o item na curadoria.
- Data que **mudou** (mesmo título, outra data até 45 dias): aplica sozinho se a confiança for alta; avisa quem editou a própria versão (`evento_override`) com uma notificação "a data oficial mudou".
- Algo que **sumiu** da nova versão do PDF: nunca cancela sozinho; vai para a curadoria.
- **Disciplina nova** lida da grade: vai para a curadoria (há um botão "Aprovar as N disciplinas da grade"). Para criar sozinho, `ARCHIE_AUTO_ESTRUTURA=true`.
- Eventos manuais, do professor e da turma **nunca** são alterados. Leitura por imagem nunca passa de "Provável".
- O mesmo item não é proposto de novo — nem depois de você recusar.

Tudo passa pela tabela `curadoria`: o que o Archie aplicou sozinho fica com `decisao = 'aprovado'` e `decidido_por` vazio.
Em **/admin/curadoria** você vê o que está pendente e o histórico; em **/admin/fontes**, a última leitura de cada
fonte, os erros e o botão **Verificar agora**; em **/admin/servidor**, se o worker está no ar.

## Moderação do acervo público

Todo envio ao acervo de uma disciplina entra **em análise** e vira uma tarefa `moderar_acervo` na fila. O worker
baixa o arquivo do Supabase Storage (bucket privado `materiais`), verifica na memória e grava a decisão com
`archie_moderar` (`archie/moderacao.py`):

1. **Tipo real** pelos primeiros bytes (PDF, PNG, JPEG, WEBP, DOCX/PPTX/XLSX, texto). Executável, script ou zip comum → quarentena.
2. **Código embutido:** PDF com `/JavaScript`, `/Launch`, arquivo anexado etc. (procura também nos objetos comprimidos); Office com macro VBA ou ActiveX; zip-bomba.
3. **Antivírus:** se `clamscan`/`clamdscan` estiver instalado no PC (`sudo apt install clamav`), o arquivo passa por ele.
4. **Dados pessoais de terceiros:** CPF válido, 2+ celulares ou 3+ e-mails pessoais → quarentena, com trecho mascarado.
5. **Modelo local:** título, descrição, texto e (se for imagem ou PDF escaneado) a imagem. Reprova conteúdo sexual, violência, ódio, ilícito, golpe ou fora do âmbito acadêmico. Só publica com certeza ≥ 60%.

Links não são abertos: o Archie barra encurtadores, IP, `.exe`/`.apk` e similares e julga o resto pelo título.
O que reprova fica em `/admin/quarentena` com nome, e-mail, curso, histórico do aluno, hash SHA-256 e motivo.
Se o worker estiver desligado, os envios esperam (o admin pode liberar ou remover à mão).

**Precisa no `.env` do worker:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (só no PC do worker, nunca no git).

## Ligar (uma vez)

Pré-requisito: o Supabase do `docs/setup-supabase.md` já ligado.

### 1. Banco

1. **Database → Extensions**: ligue `vector`, `pgmq` e `pg_cron`.
2. No **SQL Editor**, rode nesta ordem:
   - `supabase/migrations/20261103000001_archie.sql`
   - `supabase/migrations/20261116000000_archie_v1.sql`
3. Se você rodou o `seed.sql` antes desta versão, as fontes já foram corrigidas pela migração (extrator e endereço com `index.php`). Se ainda não rodou, rode o seed depois das migrações.

### 2. Ollama e modelos

```bash
curl -fsSL https://ollama.com/install.sh | sh     # Linux
ollama pull qwen3.5:9b
ollama pull qwen3-embedding:0.6b
```

### 3. Worker

```bash
cd workers/archie
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # preencha DATABASE_URL (Session pooler do Supabase)
python -m archie status         # confere Ollama, modelos, banco e se o site deixa o coletor entrar
python -m archie uma-vez --fonte "Grade" --forcar
python -m archie rodar          # fica no ar
```

Ou com Docker (o Ollama continua no PC): `docker compose up -d --build` e `docker compose logs -f archie`.

> A `DATABASE_URL` dá acesso total ao banco (como a service role). Fica só no `.env` deste PC, fora do git.

### 4. Testar com documentos reais (sem gravar nada)

```bash
python -m archie testar ~/Downloads/ADS_NOT.pdf --extrator grade --sem-ia
python -m archie testar https://www.fatecid.com.br/site/wp-content/uploads/2026/08/UN-12_03_26_Calendario-Academico-2026_retificado-sem-logo-2.pdf --extrator calendario
python -m archie testar ~/Downloads/comunicado.png --extrator aviso
```

Bom para a avaliação do PTG: rode nos ~30 documentos reais e compare com o que está escrito.

## Se o site recusar (403)

Nos testes, algumas páginas internas do site (fora a home e os arquivos em `wp-content/uploads`) recusaram
acesso automatizado. O coletor **não finge ser navegador**: se receber 401/403/429, a fonte fica com status
`erro` e a mensagem aparece em /admin/fontes. O caminho certo é pedir à TI da unidade para liberar o
User-Agent `CentralDeEstudos-Archie/0.1 (+https://github.com/tsaistrinta/central-de-estudos)`. Enquanto isso,
dá para cadastrar como fonte o link direto do PDF (tipo `pdf`, extrator `calendario` ou `grade`).

## Testes do worker

```bash
cd workers/archie
python -m pytest                                    # sem banco: grade, calendário, coletor
ARCHIE_TESTE_PG=postgresql://postgres@localhost:5432/postgres python -m pytest   # com Postgres 16 local
```

Os testes com banco criam um banco novo por teste com `tests/sql/montar_banco.sh` (stubs do Supabase + migrações + seed).

## Próximo (Fase 6)

Caixa de entrada (aluno encaminha e-mail/print), plano de ensino, print do SIGA, busca com RAG nos
`conhecimento_trechos` que a v1 já guarda, resumo diário, e a tela "a data oficial mudou, aplicar?" para quem tem
versão própria de um evento (as notificações já são gravadas).
