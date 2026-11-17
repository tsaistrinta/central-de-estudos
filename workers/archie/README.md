# Archie — worker da Central de Estudos

Coletor + leitura (grade de horários pela posição do texto; calendário e avisos com Qwen3.5 no Ollama) +
publicação por confiança com curadoria do admin. Roda no PC do Lucas e só faz conexões de saída.

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env            # DATABASE_URL do Supabase (Session pooler)
python -m archie status           # Ollama, modelos, banco e acesso às fontes
python -m archie rodar            # fica no ar
python -m archie testar ARQUIVO.pdf --extrator grade --sem-ia   # vê o que ele entende, sem gravar
python -m pytest                # testes (com banco: ARCHIE_TESTE_PG=postgresql://…/postgres)
```

Como funciona, regras de confiança e passo a passo completo: [`docs/archie.md`](../../docs/archie.md).
