"""Normalização de texto e comparação de nomes (disciplinas, títulos de eventos, professores)."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from difflib import SequenceMatcher

PALAVRAS_VAZIAS = {"a", "o", "e", "de", "da", "do", "das", "dos", "em", "para", "com", "na", "no", "ao", "à"}
ROMANOS = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalizar(s: str | None) -> str:
    """'ENG. Software-II' -> 'eng software ii'."""
    s = sem_acento(s or "").lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def compacto(s: str | None) -> str:
    return normalizar(s).replace(" ", "")


def palavras(s: str | None) -> list[str]:
    return [p for p in normalizar(s).split() if p not in PALAVRAS_VAZIAS]


def sigla_de(nome: str) -> str:
    """'Programação Orientada a Objetos' -> 'poo'; 'Engenharia de Software II' -> 'esii'."""
    return "".join(p if p in ROMANOS else p[0] for p in palavras(nome))


def mesmo_nome(curto: str, nome: str, sigla: str | None = None) -> bool:
    """O nome abreviado do PDF ('P.O.O', 'ENG. SOFTWARE II', 'I.H.C') é esta disciplina?"""
    c = compacto(curto)
    if not c:
        return False
    if c in {compacto(nome), compacto(sigla)}:
        return True
    if c == sigla_de(nome):
        return True
    a, b = palavras(curto), palavras(nome)
    # Cada palavra do PDF é o começo da palavra correspondente do nome: 'eng software ii' ~ 'engenharia software ii'.
    if len(a) == len(b) and all(y.startswith(x) if x not in ROMANOS else x == y for x, y in zip(a, b)):
        return True
    return False


def similaridade(a: str | None, b: str | None) -> float:
    """0..1 entre dois títulos. Um título contido no outro conta como parecido ('Exames finais' x
    'Período de aplicação e correção de exames finais')."""
    na, nb = normalizar(a), normalizar(b)
    if not na or not nb:
        return 0.0
    r = SequenceMatcher(None, na, nb).ratio()
    pa, pb = set(palavras(a)), set(palavras(b))
    curto, longo = (pa, pb) if len(pa) <= len(pb) else (pb, pa)
    if len(curto) >= 2 and curto <= longo:
        r = max(r, 0.9)
    elif curto and len(curto & longo) / len(curto) >= 0.75 and len(curto) >= 3:
        r = max(r, 0.8)
    return round(r, 3)


CONECTIVOS = {"de", "da", "do", "das", "dos", "e", "em", "para", "a", "o"}


def bonito(s: str) -> str:
    """'BANCO DE DADOS' -> 'Banco de Dados'; mantém siglas como 'P.O.O', 'G.G.T.I.', 'II'."""
    saida = []
    for i, p in enumerate(s.split()):
        baixo = p.lower()
        if i > 0 and baixo in CONECTIVOS:
            saida.append(baixo)
        elif baixo in ROMANOS and i > 0:
            saida.append(p.upper())
        elif "." in p.rstrip(".") or (len(p) <= 3 and p.isupper() and i > 0 and baixo not in CONECTIVOS):
            saida.append(p)
        else:
            saida.append(p[:1].upper() + p[1:].lower())
    return " ".join(saida)


def hash_de(dados: bytes | str) -> str:
    if isinstance(dados, str):
        dados = dados.encode()
    return hashlib.sha256(dados).hexdigest()
