"""O laço do Archie: vigia as fontes, lê o que mudou, publica ou pede curadoria, e atende a fila."""

from __future__ import annotations

import logging
import signal
import time
import traceback
from datetime import date, datetime, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from archie import moderacao, pdf
from archie.banco import Banco
from archie.coletor import (ColetaRecusada, Coletor, Resposta, assinatura_da_pagina, imagens, links_de_documento,
                          texto_principal)
from archie.config import Config
from archie.extratores import avisos, calendario, grade
from archie.ia import IAIndisponivel, Ollama
from archie.publicar import Publicador
from archie.texto import hash_de, normalizar

log = logging.getLogger("archie")


def partir_texto(texto: str, tamanho: int = 1200) -> list[str]:
    """Trechos de ~1200 caracteres, quebrando em parágrafos (para a busca da Fase 6)."""
    trechos, atual = [], ""
    for par in [p.strip() for p in texto.split("\n") if p.strip()]:
        if atual and len(atual) + len(par) > tamanho:
            trechos.append(atual)
            atual = ""
        atual = f"{atual}\n{par}".strip()
        while len(atual) > tamanho * 1.5:
            trechos.append(atual[:tamanho])
            atual = atual[tamanho:]
    if atual:
        trechos.append(atual)
    return trechos


class Archie:
    def __init__(self, cfg: Config, banco: Banco, coletor: Coletor, ia: Ollama):
        self.cfg = cfg
        self.banco = banco
        self.coletor = coletor
        self.ia = ia
        self.parar = False
        self.iniciado_em = datetime.now(timezone.utc)
        self.processadas = 0
        self.erros = 0
        self.fuso = ZoneInfo(cfg.fuso)

    # ------------------------------------------------------------------ laço
    def rodar(self) -> None:
        signal.signal(signal.SIGTERM, self._sair)
        signal.signal(signal.SIGINT, self._sair)
        log.info("Archie no ar (worker %s, modelo %s em %s)", self.cfg.worker, self.cfg.modelo, self.cfg.ollama_url)
        while not self.parar:
            self.uma_rodada()
            for _ in range(self.cfg.intervalo_s):
                if self.parar:
                    break
                time.sleep(1)
        self.sinal("parada")
        log.info("Archie parou.")

    def _sair(self, *_):
        log.info("pedido para parar; termino a tarefa atual e saio")
        self.parar = True

    def uma_rodada(self) -> None:
        # 1. Pedidos da fila (botão "Verificar agora" e, na Fase 6, encaminhamentos dos alunos).
        while not self.parar:
            msg = self.banco.ler_fila()
            if not msg:
                break
            self.atender(msg)
        # 2. Envios ao acervo que ficaram sem tarefa (a fila descarta depois de 3 falhas).
        for item in self.banco.acervo_em_analise():
            if self.parar:
                break
            try:
                moderacao.atender(self, {"item_id": item["id"]})
            except Exception:
                log.exception("não consegui moderar o item %s agora", item["id"])
                break
        # 3. Fontes cujo intervalo venceu.
        for fonte in self.banco.fontes_vencidas():
            if self.parar:
                break
            self.processar_fonte(fonte)
        self.sinal(None)

    def atender(self, msg: dict) -> None:
        corpo = msg["message"] or {}
        try:
            if msg["read_ct"] > 3:
                log.warning("tarefa %s falhou 3 vezes; descartando: %s", msg["msg_id"], corpo)
            elif corpo.get("tipo") == "moderar_acervo":
                moderacao.atender(self, corpo)
            elif corpo.get("tipo") == "coletar":
                fonte = self.banco.fonte(str(corpo.get("fonte_id")))
                if fonte:
                    self.processar_fonte(fonte, forcar=bool(corpo.get("forcar")))
            else:
                log.warning("tarefa desconhecida: %s", corpo)
            self.banco.apagar_da_fila(msg["msg_id"])
        except Exception:  # fica na fila e volta depois do tempo de visibilidade
            log.exception("erro na tarefa %s", msg["msg_id"])

    def sinal(self, tarefa: str | None, erro: str | None = None) -> None:
        try:
            self.banco.sinal(self.cfg.worker, tarefa, {"texto_imagem": self.cfg.modelo, "embedding": self.cfg.modelo_embed},
                             self.iniciado_em, self.processadas, self.erros, erro)
        except Exception:
            log.exception("não consegui gravar o sinal de vida")

    # ------------------------------------------------------------------ fonte
    def processar_fonte(self, fonte: dict, forcar: bool = False) -> str:
        nome = fonte["nome"]
        self.sinal(f"lendo {nome}")
        log.info("→ %s (%s, %s)", nome, fonte["extrator"], fonte["url"])
        try:
            pagina = self.coletor.baixar(fonte["url"])
            if pagina.eh_pdf:
                hash_pagina = hash_de(pagina.conteudo)
            else:
                hash_pagina = hash_de(assinatura_da_pagina(pagina.html, pagina.url))
            mudou = forcar or hash_pagina != fonte.get("ultimo_hash")

            extrator = fonte["extrator"]
            if extrator == "calendario":
                resumo = self._documentos(fonte, pagina, forcar, "calendario")
            elif extrator == "grade":
                resumo = self._documentos(fonte, pagina, forcar, "grade")
            elif extrator == "avisos":
                resumo = self._avisos(fonte, pagina, forcar)
            else:
                resumo = self._geral(fonte, pagina, hash_pagina) if mudou else "sem mudança"
            self.banco.marcar_visita(str(fonte["id"]), hash_pagina)
            self.processadas += 1
            log.info("  %s: %s", nome, resumo)
            return resumo
        except ColetaRecusada as e:
            return self._falhou(fonte, str(e))
        except IAIndisponivel as e:
            return self._falhou(fonte, f"IA fora do ar: {e}")
        except Exception as e:
            log.debug(traceback.format_exc())
            return self._falhou(fonte, f"{type(e).__name__}: {e}")

    def _falhou(self, fonte: dict, motivo: str) -> str:
        self.erros += 1
        log.warning("  %s: %s", fonte["nome"], motivo)
        self.banco.marcar_visita(str(fonte["id"]), None, motivo[:500])
        self.sinal(None, f"{fonte['nome']}: {motivo[:300]}")
        return f"erro: {motivo}"

    def _contexto(self, fonte: dict) -> tuple[dict, list[dict]]:
        tenant = self.banco.tenant(str(fonte["tenant_id"]))
        return tenant, self.banco.cursos(str(fonte["tenant_id"]))

    # ------------------------------------------------------------------ PDFs linkados
    def _documentos(self, fonte: dict, pagina: Resposta, forcar: bool, tipo: str) -> str:
        tenant, cursos = self._contexto(fonte)
        if pagina.eh_pdf:
            docs = [(fonte["nome"], pagina.url, pagina)]
        else:
            links = links_de_documento(pagina.html, pagina.url)
            if tipo == "calendario":
                escolhidos = [l for l in links if "calendario" in normalizar(l.url + " " + l.texto)] or links
            else:  # grade: só os PDFs dos cursos que existem no tenant
                escolhidos = [l for l in links if any(normalizar(c["nome"]) in normalizar(l.texto) for c in cursos)]
            if not escolhidos:
                return "nenhum PDF para ler nesta página"
            docs = [(l.texto, l.url, None) for l in escolhidos]

        resumos = []
        for titulo, url, resposta in docs:
            resposta = resposta or self.coletor.baixar(url)
            if not resposta.eh_pdf:
                resumos.append(f"{titulo}: não é PDF")
                continue
            h = hash_de(resposta.conteudo)
            if not forcar and self.banco.ultimo_hash_documento(str(fonte["id"]), url) == h:
                continue
            self.sinal(f"lendo {titulo or url}")
            if tipo == "calendario":
                resumos.append(self._calendario(fonte, tenant, cursos, url, resposta.conteudo, h))
            else:
                resumos.append(self._grade(fonte, tenant, cursos, url, resposta.conteudo, h))
        return " | ".join(resumos) or "documentos sem mudança"

    def _calendario(self, fonte, tenant, cursos, url, dados: bytes, h: str) -> str:
        cal = calendario.ler(dados, self.ia, unidade=tenant["nome"], url=url, hoje=date.today())
        if not cal.eventos:
            raise RuntimeError("; ".join(cal.problemas) or "a IA não achou nenhuma data no calendário")
        with self.banco.transacao():
            cid = self.banco.registrar_captura(str(fonte["id"]), h, url, titulo=_nome_arquivo(url), itens=len(cal.eventos))
            cobertura = (min(e.inicio for e in cal.eventos), max(e.fim or e.inicio for e in cal.eventos))
            r = Publicador(self.banco, self.cfg, fonte, cid).eventos(cal.eventos, cursos, cobertura)
            self._conhecimento(fonte, cid, url, "\n\n".join(cal.texto), {"tipo": "calendario", "ano": cal.ano})
        return f"calendário {cal.ano}: {r.resumo()}"

    def _grade(self, fonte, tenant, cursos, url, dados: bytes, h: str) -> str:
        grades = grade.ler_pdf(dados)
        resumos = []
        with self.banco.transacao():
            cid = self.banco.registrar_captura(str(fonte["id"]), h, url, titulo=_nome_arquivo(url),
                                               itens=sum(len(g.aulas) for g in grades))
            for n, g in enumerate(grades):
                if g.problemas or not g.aulas:
                    log.info("  leitura por posição falhou (%s); tentando pela imagem", "; ".join(g.problemas))
                    g = grade.ler_com_ia(dados, self.ia, pagina=n)
                r = Publicador(self.banco, self.cfg, fonte, cid).grade(g, cursos, tenant["periodo_atual"])
                resumos.append(f"{g.curso} {g.periodo or ''}: {r.resumo()}" + (f" ({'; '.join(r.notas)})" if r.notas else ""))
        return " | ".join(resumos)

    # ------------------------------------------------------------------ avisos em imagem
    def _avisos(self, fonte: dict, pagina: Resposta, forcar: bool) -> str:
        tenant, cursos = self._contexto(fonte)
        urls = [pagina.url] if pagina.eh_imagem else imagens(pagina.html, pagina.url)
        resumos = []
        for url in urls[:12]:
            resposta = pagina if pagina.eh_imagem else self.coletor.baixar(url)
            if not resposta.eh_imagem:
                continue
            h = hash_de(resposta.conteudo)
            if not forcar and self.banco.ultimo_hash_documento(str(fonte["id"]), url) == h:
                continue
            self.sinal(f"olhando {_nome_arquivo(url)}")
            aviso = avisos.ler(resposta.conteudo, url, self.ia, unidade=tenant["nome"], hoje=date.today())
            with self.banco.transacao():
                cid = self.banco.registrar_captura(str(fonte["id"]), h, url, titulo=aviso.titulo or _nome_arquivo(url),
                                                   itens=len(aviso.eventos))
                r = Publicador(self.banco, self.cfg, fonte, cid).eventos(aviso.eventos, cursos, None)
                if aviso.para_alunos:
                    self._conhecimento(fonte, cid, url, f"{aviso.titulo}\n{aviso.resumo}", {"tipo": "aviso"})
            resumos.append(f"{aviso.titulo or _nome_arquivo(url)}: " + (r.resumo() if aviso.para_alunos else "não é aviso para alunos"))
        return " | ".join(resumos) or "nenhum aviso novo"

    # ------------------------------------------------------------------ texto da página
    def _geral(self, fonte: dict, pagina: Resposta, h: str) -> str:
        texto = pdf.texto_pdf(pagina.conteudo) if pagina.eh_pdf else [texto_principal(pagina.html, pagina.url)]
        texto = "\n".join(texto)
        with self.banco.transacao():
            cid = self.banco.registrar_captura(str(fonte["id"]), h, pagina.url, titulo=fonte["nome"])
            n = self._conhecimento(fonte, cid, pagina.url, texto, {"tipo": "pagina"})
        return f"texto guardado ({n} trechos)"

    def _conhecimento(self, fonte: dict, captura_id: int, url: str, texto: str, meta: dict) -> int:
        if not self.cfg.conhecimento or not texto.strip():
            return 0
        trechos = partir_texto(texto)
        try:
            embeddings = self.ia.embed(trechos)
        except IAIndisponivel as e:
            log.warning("  sem embedding agora (%s); guardo só o texto", e)
            embeddings = None
        return self.banco.trocar_trechos(str(fonte["tenant_id"]), str(fonte["id"]), captura_id, url, trechos,
                                         embeddings, meta)


def _nome_arquivo(url: str) -> str:
    return urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1] or url
