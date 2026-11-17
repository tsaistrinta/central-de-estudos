"""Leitura de PDF com PyMuPDF: texto com posição, linhas em ordem de leitura e página como imagem."""

from __future__ import annotations

from dataclasses import dataclass

import pymupdf


@dataclass(frozen=True)
class Item:
    """Um pedaço de texto na página. x = início à esquerda, y = linha de base, medidos do canto de cima."""

    x: float
    y: float
    texto: str
    x1: float = 0.0


def abrir(dados: bytes) -> pymupdf.Document:
    return pymupdf.open(stream=dados, filetype="pdf")


def itens_da_pagina(pagina: pymupdf.Page) -> list[Item]:
    itens: list[Item] = []
    for bloco in pagina.get_text("dict")["blocks"]:
        for linha in bloco.get("lines", []):
            spans = [s for s in linha["spans"] if s["text"].strip()]
            if not spans:
                continue
            texto = " ".join(s["text"].strip() for s in spans)
            x0, _, x1, _ = linha["bbox"]
            itens.append(Item(round(x0, 1), round(spans[0]["origin"][1], 1), texto, round(x1, 1)))
    itens.sort(key=lambda i: (i.y, i.x))
    return itens


def itens_pdf(dados: bytes) -> list[list[Item]]:
    with abrir(dados) as doc:
        return [itens_da_pagina(p) for p in doc]


def linhas(itens: list[Item], tolerancia: float = 2.5) -> list[tuple[float, str]]:
    """Junta itens na mesma altura em linhas de texto (esquerda → direita)."""
    grupos: list[tuple[float, list[Item]]] = []
    for it in sorted(itens, key=lambda i: (i.y, i.x)):
        if grupos and abs(grupos[-1][0] - it.y) <= tolerancia:
            grupos[-1][1].append(it)
        else:
            grupos.append((it.y, [it]))
    saida = []
    for y, grupo in grupos:
        grupo.sort(key=lambda i: i.x)
        partes: list[str] = []
        anterior: Item | None = None
        for it in grupo:
            # Palavra quebrada pelo PDF ('nove' + 'mbro'): sem espaço quando os pedaços se encostam.
            if anterior and anterior.x1 and it.x - anterior.x1 < 0.8 and partes:
                partes[-1] += it.texto
            else:
                partes.append(it.texto)
            anterior = it
        saida.append((y, "  ".join(partes)))
    return saida


def texto_pdf(dados: bytes, max_paginas: int = 40) -> list[str]:
    with abrir(dados) as doc:
        return [p.get_text("text") for i, p in enumerate(doc) if i < max_paginas]


def png_da_pagina(dados: bytes, numero: int = 0, dpi: int = 150) -> bytes:
    with abrir(dados) as doc:
        return doc[numero].get_pixmap(dpi=dpi).tobytes("png")


def paginas(dados: bytes) -> int:
    with abrir(dados) as doc:
        return doc.page_count
