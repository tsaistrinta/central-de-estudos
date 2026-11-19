"""Linha de comando do Archie.

    python -m archie rodar                      # fica no ar: vigia as fontes e atende a fila
    python -m archie uma-vez [--fonte NOME] [--forcar]
    python -m archie testar ARQUIVO_OU_URL --extrator grade|calendario|aviso [--sem-ia]
    python -m archie status                     # confere banco, Ollama, modelos e acesso às fontes
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

from archie.config import Config


def _ia(cfg: Config):
    from archie.ia import Ollama

    return Ollama(cfg.ollama_url, cfg.modelo, cfg.modelo_embed, timeout=cfg.ia_timeout_s)


def _coletor(cfg: Config):
    from archie.coletor import Coletor

    return Coletor(cfg.user_agent, cfg.pausa_host_s, cfg.max_bytes)


def _banco(cfg: Config):
    from archie.banco import Banco

    if not cfg.database_url:
        sys.exit("Falta DATABASE_URL no .env (Supabase → Project Settings → Database → Connection string, 'Session pooler').")
    return Banco(cfg.database_url)


def cmd_rodar(cfg: Config, args) -> None:
    from archie.worker import Archie

    Archie(cfg, _banco(cfg), _coletor(cfg), _ia(cfg)).rodar()


def cmd_uma_vez(cfg: Config, args) -> None:
    from archie.worker import Archie

    banco = _banco(cfg)
    y = Archie(cfg, banco, _coletor(cfg), _ia(cfg))
    if args.fonte:
        fonte = banco.fonte(args.fonte)
        if not fonte:
            sys.exit(f"fonte não encontrada: {args.fonte}")
        print(y.processar_fonte(fonte, forcar=args.forcar))
    else:
        y.uma_rodada()
    y.sinal(None)


def cmd_testar(cfg: Config, args) -> None:
    """Lê um arquivo (ou URL) e mostra o que o Archie entendeu, sem gravar nada no banco."""
    alvo = args.alvo
    if alvo.startswith("http"):
        resposta = _coletor(cfg).baixar(alvo)
        dados, url = resposta.conteudo, resposta.url
    else:
        dados, url = Path(alvo).read_bytes(), alvo
    if args.extrator == "grade":
        from archie.extratores import grade

        grades = grade.ler_pdf(dados)
        if not args.sem_ia and any(g.problemas or not g.aulas for g in grades):
            grades = [grade.ler_com_ia(dados, _ia(cfg), n) if (g.problemas or not g.aulas) else g
                      for n, g in enumerate(grades)]
        saida = [g.como_dict() for g in grades]
    elif args.extrator == "calendario":
        from archie.extratores import calendario, eventos
        from archie import pdf

        if args.sem_ia:
            saida = {"texto_que_vai_para_a_ia": [calendario.texto_limpo(i) for i in pdf.itens_pdf(dados)]}
        else:
            cal = calendario.ler(dados, _ia(cfg), unidade=args.unidade, url=url, hoje=date.today())
            saida = {"ano": cal.ano, "problemas": cal.problemas, "eventos": [asdict(e) for e in cal.eventos]}
    else:
        from archie.extratores import avisos

        aviso = avisos.ler(dados, url, _ia(cfg), unidade=args.unidade, hoje=date.today())
        saida = asdict(aviso)
    print(json.dumps(saida, ensure_ascii=False, indent=2, default=str))


def cmd_status(cfg: Config, args) -> None:
    ok = True
    print(f"Ollama em {cfg.ollama_url}")
    try:
        modelos = _ia(cfg).modelos()
        for m in (cfg.modelo, cfg.modelo_embed):
            tem = any(x == m or x.startswith(m + ":") for x in modelos)
            ok &= tem
            print(f"  {'✓' if tem else '✗'} {m}" + ("" if tem else f"   → rode: ollama pull {m}"))
    except Exception as e:
        ok = False
        print(f"  ✗ {e}")
    print("Banco")
    try:
        banco = _banco(cfg)
        fontes = banco._todos("select nome, url, status, ultimo_erro, ultima_verificacao from fontes order by nome")
        print(f"  ✓ conectado; {len(fontes)} fontes")
        print("Acesso às fontes (robots.txt e resposta do site)")
        coletor = _coletor(cfg)
        for f in fontes:
            try:
                r = coletor.baixar(f["url"])
                print(f"  ✓ {f['nome']}: {r.status} {r.tipo} {len(r.conteudo) // 1024} KB")
            except Exception as e:
                ok = False
                print(f"  ✗ {f['nome']}: {e}")
    except SystemExit:
        raise
    except Exception as e:
        ok = False
        print(f"  ✗ {e}")
    sys.exit(0 if ok else 1)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="archie", description="Worker do Archie (Central de Estudos)")
    p.add_argument("-v", "--verboso", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("rodar", help="fica no ar vigiando as fontes")
    u = sub.add_parser("uma-vez", help="uma rodada (ou uma fonte) e sai")
    u.add_argument("--fonte", help="nome ou id da fonte")
    u.add_argument("--forcar", action="store_true", help="lê de novo mesmo sem mudança")
    t = sub.add_parser("testar", help="mostra o que o Archie entende de um arquivo, sem gravar")
    t.add_argument("alvo", help="caminho do arquivo ou URL")
    t.add_argument("--extrator", choices=["grade", "calendario", "aviso"], required=True)
    t.add_argument("--sem-ia", action="store_true", help="não chama o Ollama (grade por posição; calendário mostra o texto)")
    t.add_argument("--unidade", default="Fatec Indaiatuba")
    sub.add_parser("status", help="confere banco, Ollama e acesso às fontes")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verboso else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    cfg = Config.do_ambiente()
    {"rodar": cmd_rodar, "uma-vez": cmd_uma_vez, "testar": cmd_testar, "status": cmd_status}[args.cmd](cfg, args)


if __name__ == "__main__":
    main()
