# Archie na Oracle Cloud (grátis, sempre ligado)

O Archie sai do seu PC e passa a rodar numa máquina da Oracle, na cota **Always Free**: modelo `qwen3.5:9b` (local, sem
IA de terceiros) + worker, 24 horas por dia. Nenhuma porta fica aberta para a internet além do SSH: o worker só faz
conexões de saída (banco do Supabase e site da Fatec).

> **Sem risco de cobrança:** a conta nasce como *Free Tier*. Ela **só** cobra se você clicar em **"Upgrade to Pay As You
> Go"**. Não clique. Recursos "Always Free" ficam grátis para sempre; o que não é grátis simplesmente não deixa criar.
> O cartão pedido no cadastro é só para verificar identidade (pode aparecer uma pré-autorização pequena que é estornada).

## 1. Criar a conta (uma vez)

1. Acesse **oracle.com/cloud/free** → **Start for free**.
2. País: Brasil. **Home Region: Brazil East (São Paulo)** — a região não muda depois; São Paulo fica perto do Supabase.
3. Confirme o e-mail, cadastre o cartão para verificação e termine.
4. **Não** faça upgrade para Pay As You Go.
5. (Recomendado) **Billing → Budgets → Create Budget**: valor **R$ 1**, alerta para o seu e-mail. Se algo um dia sair
   da cota grátis, você é avisado na hora.

## 2. Criar a máquina

**Menu → Compute → Instances → Create instance**

| Campo | Valor |
|---|---|
| Name | `archie` |
| Image | **Canonical Ubuntu 24.04** (a versão **aarch64**) |
| Shape | **Ampere → VM.Standard.A1.Flex**, com o máximo da cota grátis da sua conta (hoje **2 OCPUs e 12 GB**) — o rótulo "Always Free-eligible" tem que aparecer |
| Networking | deixe a rede padrão; **Assign a public IPv4 address: sim** (para o SSH) |
| SSH keys | **Generate a key pair for me** → baixe as duas chaves e guarde a privada (`.key`) |
| Boot volume | 100 GB (a cota grátis vai até 200 GB no total) |

Clique **Create**. Se aparecer **"Out of capacity"**, tente de novo mais tarde ou troque o *Availability Domain*;
é comum na região de São Paulo em horário de pico.

## 3. Entrar por SSH

No terminal do seu PC (troque o IP pelo "Public IP" da instância):

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@IP_DA_MAQUINA
```

## 4. Instalar

Já dentro da máquina:

```bash
curl -fsSL https://raw.githubusercontent.com/tsaistrinta/central-de-estudos/main/workers/archie/deploy/oracle/instalar.sh | bash
```

O script atualiza o sistema, liga as atualizações de segurança automáticas, cria 4 GB de swap, instala o Docker e baixa o
código. Ele **não** grava chave nenhuma.

## 5. Preencher o `.env`

```bash
nano ~/central-de-estudos/workers/archie/.env
```

Copie do `.env` do seu PC as linhas `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, e confira
`ARCHIE_MODELO=qwen3.5:9b`. Salve (Ctrl+O, Enter, Ctrl+X). O arquivo fica só nessa máquina, com permissão só para você.

## 6. Ligar

Saia e entre de novo no SSH (para o Docker funcionar sem `sudo`) e rode:

```bash
cd ~/central-de-estudos/workers/archie
docker compose -f deploy/oracle/docker-compose.yml up -d --build
docker compose -f deploy/oracle/docker-compose.yml logs -f archie
```

A primeira vez baixa o modelo (cerca de 7 GB, 10 a 20 minutos). Depois disso, em **Administração → Servidor e IA** o
worker **oracle-a1** aparece com "último sinal há poucos segundos". Pode desligar o worker do seu PC.

## Dia a dia

- **Atualizar depois de um push:** `bash ~/central-de-estudos/workers/archie/deploy/oracle/atualizar.sh`
- **Ver o que ele está fazendo:** `docker compose -f deploy/oracle/docker-compose.yml logs -f archie`
- **Reiniciar:** `docker compose -f deploy/oracle/docker-compose.yml restart archie`
- Se a máquina reiniciar, tudo volta sozinho (`restart: always`).

## Por que dá certo na cota grátis

- **Memória:** o 9b ocupa uns 7 GB; o de embedding, menos de 1 GB; sobra para o worker e o sistema (mais 4 GB de swap).
- **Velocidade:** sem placa de vídeo, cada leitura com IA leva de segundos a alguns minutos. Como o Archie trabalha em
  segundo plano e a dupla leitura protege a precisão, isso não afeta os alunos. O limite por leitura foi para 30 minutos.
- **Máquina "ociosa":** a Oracle recolhe instâncias grátis paradas por 7 dias seguidos. Com o modelo sempre carregado
  e o Archie visitando as fontes, a máquina não fica ociosa.
