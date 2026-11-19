"""Evento lido de um documento (calendário, aviso) e a checagem do que a IA devolveu."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from archie.texto import normalizar

TIPOS = {"prova", "entrega", "trabalho", "apresentacao", "aula", "reuniao", "leitura", "projeto", "lembrete",
         "data_especial", "outro"}


@dataclass
class EventoLido:
    titulo: str
    tipo: str
    inicio: date
    fim: date | None = None
    hora_inicio: str | None = None  # "19:00" quando não é o dia todo
    hora_fim: str | None = None
    sem_aula: bool = False
    cursos: list[str] = field(default_factory=list)
    trecho: str | None = None
    confianca: float = 0.5
    documento_url: str | None = None
    pagina: int | None = None
    conferencia: dict | None = None  # resultado da segunda leitura (archie.conferencia)

    @property
    def dia_todo(self) -> bool:
        return self.hora_inicio is None


def _data(texto) -> date | None:
    if not isinstance(texto, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", texto.strip()):
        return None
    try:
        return date.fromisoformat(texto.strip())
    except ValueError:
        return None


def _hora(texto) -> str | None:
    if isinstance(texto, str) and re.fullmatch(r"\d{1,2}:\d{2}", texto.strip()):
        h, m = texto.strip().split(":")
        if int(h) < 24 and int(m) < 60:
            return f"{int(h):02d}:{m}"
    return None


def validar_eventos(brutos: list[dict], ano: int | None, documento_url: str = "",
                    teto_confianca: float = 0.95) -> tuple[list[EventoLido], list[str]]:
    """Descarta o que não fecha (data inválida, fora do ano, só para professores) e junta repetidos."""
    saida: dict[tuple, EventoLido] = {}
    problemas = []
    for b in brutos:
        titulo = re.sub(r"\s+", " ", str(b.get("titulo") or "")).strip()[:140]
        inicio = _data(b.get("inicio"))
        if not titulo or not inicio:
            problemas.append(f"item sem título ou data: {str(b)[:120]}")
            continue
        if ano and abs(inicio.year - ano) > 1:
            problemas.append(f"data fora do ano {ano}: {titulo} ({inicio})")
            continue
        if b.get("para_quem") == "professores":
            continue
        fim = _data(b.get("fim"))
        if fim and fim <= inicio:
            fim = None
        if fim and (fim - inicio).days > 120:
            problemas.append(f"período longo demais, ficou só o início: {titulo}")
            fim = None
        tipo = b.get("tipo") if b.get("tipo") in TIPOS else "outro"
        try:
            confianca = max(0.0, min(float(b.get("confianca", 0.5)), teto_confianca))
        except (TypeError, ValueError):
            confianca = 0.5
        e = EventoLido(titulo=titulo, tipo=tipo, inicio=inicio, fim=fim, hora_inicio=_hora(b.get("hora_inicio")),
                       hora_fim=_hora(b.get("hora_fim")), sem_aula=bool(b.get("sem_aula")),
                       cursos=[c for c in (b.get("cursos") or []) if isinstance(c, str) and c.strip()],
                       trecho=(b.get("trecho") or None), confianca=confianca, documento_url=documento_url or None,
                       pagina=b.get("pagina") if isinstance(b.get("pagina"), int) else None)
        if e.sem_aula and not re.search(r"feriado|sem aula|recesso|n[ãa]o letivo", titulo, re.I):
            e.titulo = f"Sem aula · {titulo}"  # a agenda tira as aulas desses dias pelo título
        chave = (normalizar(e.titulo), e.inicio, tuple(sorted(normalizar(c) for c in e.cursos)))
        if chave not in saida or saida[chave].confianca < e.confianca:
            saida[chave] = e
    return sorted(saida.values(), key=lambda e: (e.inicio, e.titulo)), problemas
