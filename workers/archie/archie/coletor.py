"""Coletor educado: se identifica, respeita o robots.txt, vai devagar e só baixa páginas públicas."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
import lxml.html
import trafilatura

from archie.texto import normalizar

log = logging.getLogger(__name__)


class ColetaRecusada(RuntimeError):
    """O site disse não (robots.txt, 401/403/429) — não insistir; avisar o admin."""


@dataclass
class Resposta:
    url: str  # depois dos redirecionamentos
    status: int
    tipo: str  # content-type sem parâmetros
    conteudo: bytes

    @property
    def html(self) -> str:
        return self.conteudo.decode("utf-8", errors="replace")

    @property
    def eh_pdf(self) -> bool:
        return self.tipo == "application/pdf" or self.conteudo[:5] == b"%PDF-"

    @property
    def eh_imagem(self) -> bool:
        return self.tipo.startswith("image/")


@dataclass
class Link:
    texto: str
    url: str


class Coletor:
    def __init__(self, user_agent: str, pausa_host_s: float = 5, max_bytes: int = 25 * 1024 * 1024,
                 transporte: httpx.BaseTransport | None = None):
        self.user_agent = user_agent
        self.pausa = pausa_host_s
        self.max_bytes = max_bytes
        self.http = httpx.Client(headers={"User-Agent": user_agent, "Accept-Language": "pt-BR,pt;q=0.9"},
                                 follow_redirects=True, timeout=60, transport=transporte)
        self._robots: dict[str, tuple[float, RobotFileParser | None]] = {}
        self._ultimo_pedido: dict[str, float] = {}

    # ---------- robots.txt (RFC 9309) ----------
    def _regras(self, url: str) -> RobotFileParser | None:
        """None = pode tudo. 4xx no robots.txt = sem regras; 5xx ou falha = não coletar agora."""
        partes = urlsplit(url)
        host = f"{partes.scheme}://{partes.netloc}"
        guardado = self._robots.get(host)
        if guardado and time.time() - guardado[0] < 24 * 3600:
            return guardado[1]
        self._esperar(host)
        try:
            r = self.http.get(f"{host}/robots.txt")
        except httpx.HTTPError as e:
            raise ColetaRecusada(f"não consegui ler {host}/robots.txt ({e}); tento de novo mais tarde") from e
        if r.status_code >= 500:
            raise ColetaRecusada(f"{host}/robots.txt respondeu {r.status_code}; tento de novo mais tarde")
        regras = None
        if r.status_code == 200 and "html" not in r.headers.get("content-type", ""):
            regras = RobotFileParser()
            regras.parse(r.text.splitlines())
        self._robots[host] = (time.time(), regras)
        return regras

    def pode(self, url: str) -> bool:
        regras = self._regras(url)
        return regras is None or regras.can_fetch(self.user_agent, url)

    def _esperar(self, host: str) -> None:
        espera = self._ultimo_pedido.get(host, 0) + self.pausa - time.time()
        if espera > 0:
            time.sleep(espera)
        self._ultimo_pedido[host] = time.time()

    # ---------- download ----------
    def baixar(self, url: str) -> Resposta:
        if not self.pode(url):
            raise ColetaRecusada(f"o robots.txt do site não permite visitar {url}")
        partes = urlsplit(url)
        self._esperar(f"{partes.scheme}://{partes.netloc}")
        try:
            with self.http.stream("GET", url) as r:
                if r.status_code in (401, 403, 429):
                    raise ColetaRecusada(
                        f"o site recusou o acesso ({r.status_code}) em {url}. Peça à TI da unidade para liberar o "
                        f"coletor (User-Agent: {self.user_agent}) ou aumente o intervalo da fonte.")
                r.raise_for_status()
                partes_corpo = []
                total = 0
                for pedaco in r.iter_bytes():
                    total += len(pedaco)
                    if total > self.max_bytes:
                        raise ValueError(f"arquivo maior que {self.max_bytes // 1024 // 1024} MB: {url}")
                    partes_corpo.append(pedaco)
                tipo = r.headers.get("content-type", "").split(";")[0].strip().lower()
                return Resposta(str(r.url), r.status_code, tipo, b"".join(partes_corpo))
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"{url} respondeu {e.response.status_code}") from e
        except httpx.HTTPError as e:
            raise RuntimeError(f"falha de rede em {url}: {e}") from e


# ---------- leitura de HTML ----------
def _arvore(html: str, base: str):
    arvore = lxml.html.fromstring(html or "<html></html>")
    arvore.make_links_absolute(base, resolve_base_href=True)
    return arvore


def _conteudo(arvore):
    """A parte da página com o conteúdo (WordPress): sem menu e rodapé, quando dá para achar."""
    for xpath in ("//article", "//*[contains(@class,'entry-content')]", "//main", "//*[@id='content']"):
        achados = arvore.xpath(xpath)
        if achados:
            return achados[0]
    return arvore


def links(html: str, base: str, so_conteudo: bool = True) -> list[Link]:
    arvore = _arvore(html, base)
    raiz = _conteudo(arvore) if so_conteudo else arvore
    vistos, saida = set(), []
    for a in raiz.iter("a"):
        href = (a.get("href") or "").strip()
        if not href.startswith("http") or href in vistos:
            continue
        vistos.add(href)
        saida.append(Link(" ".join(a.text_content().split()), href))
    return saida


def links_de_documento(html: str, base: str) -> list[Link]:
    return [l for l in links(html, base) if urlsplit(l.url).path.lower().endswith(".pdf")]


def imagens(html: str, base: str) -> list[str]:
    """Imagens enviadas ao site (wp-content/uploads), sem logo e ícones do tema."""
    arvore = _arvore(html, base)
    saida = []
    for img in arvore.iter("img"):
        src = (img.get("src") or img.get("data-src") or "").strip()
        if not src:
            continue
        src = urljoin(base, src)
        caminho = urlsplit(src).path.lower()
        if "/uploads/" not in caminho or "logo" in caminho or caminho.endswith((".svg", ".gif")):
            continue
        if src not in saida:
            saida.append(src)
    return saida


def texto_principal(html: str, url: str) -> str:
    texto = trafilatura.extract(html, url=url, include_links=False, include_tables=True, favor_recall=True)
    if texto:
        return texto
    return " ".join(_conteudo(_arvore(html, url)).text_content().split())


def assinatura_da_pagina(html: str, url: str) -> str:
    """O que conta como 'mudou' numa página: texto principal + documentos e imagens linkados."""
    partes = [normalizar(texto_principal(html, url))]
    partes += sorted(l.url for l in links_de_documento(html, url))
    partes += sorted(imagens(html, url))
    return "\n".join(partes)
