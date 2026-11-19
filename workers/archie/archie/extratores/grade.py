"""Grade de horários das Fatecs (PDF por curso): leitura pela posição do texto, com a IA como reserva.

Modelo do PDF (Fatec Indaiatuba, igual ao de outras unidades do CPS):

    HORÁRIO DE AULAS - 2º SEMESTRE DE 2026 - NOTURNO
    ANÁLISE E DESENVOLVIMENTO DE SISTEMAS
    HORÁRIO | 1º SEM | SALA | 2º SEM | SALA | ...
    [dia]  19h00 - 19h50 | disciplina  professor | sala | ...
           19h50 - 20h40 |    (a célula ocupa duas aulas seguidas)
           ...

Cada coluna "Nº SEM" tem a disciplina à esquerda e o professor à direita; a sala fica na coluna SALA logo depois.
As aulas vêm em pares de horários (aula dupla); disciplina, professor e sala de um par ficam na altura do meio dele.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from archie import pdf
from archie.pdf import Item
from archie.texto import bonito, normalizar

RE_HORARIO = re.compile(r"^(\d{1,2})h(\d{2})\s*[-–]\s*(\d{1,2})h(\d{2})$")
RE_SEM = re.compile(r"^(\d)\s*º?\s*SEM", re.I)
RE_CABECALHO = re.compile(r"(\d)\s*º\s*SEMESTRE\s+DE\s+(\d{4})", re.I)
DIAS = [("dom", 0), ("seg", 1), ("ter", 2), ("qua", 3), ("qui", 4), ("sex", 5), ("sab", 6)]
TURNOS = {"noturno": "noite", "noite": "noite", "matutino": "manha", "manha": "manha",
          "vespertino": "tarde", "tarde": "tarde"}


@dataclass
class AulaGrade:
    semestre: int
    dia_semana: int  # 0 = domingo
    inicio: str  # "19:00"
    fim: str
    disciplina: str  # como está no PDF ("P.O.O")
    professor: str | None = None
    sala: str | None = None


@dataclass
class Grade:
    curso: str | None
    periodo: str | None  # "2026/2"
    turno: str | None  # manha | tarde | noite
    aulas: list[AulaGrade] = field(default_factory=list)
    problemas: list[str] = field(default_factory=list)
    metodo: str = "posicao"
    confianca: float = 0.0
    conferencia: dict | None = None  # comparação com a segunda leitura (archie.conferencia)
    matriz: str | None = None  # "nova" quando o PDF é da matriz nova do curso ("(NOVO)" no cabeçalho)

    def como_dict(self) -> dict:
        return asdict(self)


def _hhmm(h: str, m: str) -> str:
    return f"{int(h):02d}:{m}"


def _dia(texto: str) -> int | None:
    n = normalizar(texto)
    if not n or not re.match(r"^(dom|seg|ter|qua|qui|sex|sab)", n):
        return None
    if not ("feira" in n or "feria" in n or n.startswith(("sab", "dom"))):
        return None
    for prefixo, numero in DIAS:
        if n.startswith(prefixo):
            return numero
    return None


def _sala(linhas: list[str]) -> str | None:
    if not linhas:
        return None
    partes = []
    for t in linhas:
        t = t.strip()
        if re.fullmatch(r"\d{1,3}", t):
            partes.append(f"Sala {t}")
        elif re.match(r"^lab\.?\s*\d", t, re.I):
            partes.append("Lab. " + re.sub(r"^lab\.?\s*", "", t, flags=re.I))
        else:
            partes.append(bonito(t))
    return " / ".join(partes)


def ler_itens(itens: list[Item]) -> Grade:
    """Monta a grade a partir dos textos posicionados de uma página."""
    g = Grade(curso=None, periodo=None, turno=None)
    por_y = sorted(itens, key=lambda i: (i.y, i.x))

    # Cabeçalho: período, turno e curso (a linha logo abaixo do "HORÁRIO DE AULAS").
    for k, it in enumerate(por_y):
        m = RE_CABECALHO.search(it.texto)
        if m and "HOR" in it.texto.upper():
            g.periodo = f"{m.group(2)}/{m.group(1)}"
            for palavra, turno in TURNOS.items():
                if palavra in normalizar(it.texto):
                    g.turno = turno
            if k + 1 < len(por_y):
                linha = por_y[k + 1].texto
                g.matriz = "nova" if re.search(r"\bnovo\b", linha, flags=re.I) else None
                g.curso = re.sub(r"\(?\bnovo\b\)?", "", linha, flags=re.I).strip()
            break

    sems = sorted([(int(RE_SEM.match(i.texto).group(1)), i) for i in itens if RE_SEM.match(i.texto)], key=lambda s: s[1].x)
    if not sems:
        g.problemas.append("não achei as colunas '1º SEM', '2º SEM'…")
        return g
    y_cab = sems[0][1].y
    salas = sorted(i.x for i in itens if normalizar(i.texto) == "sala" and abs(i.y - y_cab) <= 3)

    horarios = [(i, RE_HORARIO.match(i.texto)) for i in itens if RE_HORARIO.match(i.texto)]
    horarios.sort(key=lambda h: h[0].y)
    if not horarios:
        g.problemas.append("não achei a coluna de horários")
        return g

    # Blocos de dias: a sequência de horários recomeça a cada dia.
    blocos: list[list[tuple[float, str, str]]] = []
    ultimo = None
    for it, m in horarios:
        ini, fim = _hhmm(m.group(1), m.group(2)), _hhmm(m.group(3), m.group(4))
        if ultimo is None or ini <= ultimo:
            blocos.append([])
        blocos[-1].append((it.y, ini, fim))
        ultimo = ini

    rotulos = sorted([(i.y, _dia(i.texto)) for i in itens if _dia(i.texto) is not None])
    dias_dos_blocos: list[int | None] = []
    for b in blocos:
        topo, base = b[0][0], b[-1][0]
        perto = [(abs((topo + base) / 2 - y), d) for y, d in rotulos if topo - 15 <= y <= base + 15]
        dias_dos_blocos.append(min(perto)[1] if perto else None)
    if len(rotulos) == len(blocos) and None in dias_dos_blocos:
        dias_dos_blocos = [d for _, d in rotulos]
    if None in dias_dos_blocos:
        g.problemas.append("não consegui ligar todos os blocos de horário a um dia da semana")

    # Colunas: [início, divisa disciplina|professor, fim] e a faixa da sala de cada semestre.
    colunas = []
    x_hora = min(it.x for it, _ in horarios)
    for k, (sem, it) in enumerate(sems):
        sala_x = next((x for x in salas if x > it.x), None)
        if sala_x is None:
            g.problemas.append(f"coluna SALA do {sem}º semestre não encontrada")
            continue
        inicio = (colunas[-1]["sala_fim"] if colunas else x_hora + 25)
        colunas.append({"sem": sem, "inicio": inicio, "divisa": it.x, "sala_ini": sala_x - 8, "sala_fim": sala_x + 14})

    y_fim = blocos[-1][-1][0] + 12
    celulas: dict[tuple, dict[str, list[Item]]] = {}
    for it in itens:
        if it.y <= y_cab + 4 or it.y > y_fim or RE_HORARIO.match(it.texto) or _dia(it.texto) is not None:
            continue
        col = next((c for c in colunas if c["inicio"] <= it.x < c["sala_fim"]), None)
        if col is None:
            continue
        tipo = "sala" if it.x >= col["sala_ini"] else ("disciplina" if it.x < col["divisa"] else "professor")
        # Bloco do dia e par de horários mais perto da altura do texto.
        melhor = None
        for nb, b in enumerate(blocos):
            for np_ in range(0, len(b), 2):
                par = b[np_:np_ + 2]
                meio = (par[0][0] + par[-1][0]) / 2
                dist = abs(it.y - meio)
                if melhor is None or dist < melhor[0]:
                    melhor = (dist, nb, np_)
        if melhor is None or melhor[0] > 13:
            continue
        chave = (col["sem"], melhor[1], melhor[2])
        celulas.setdefault(chave, {}).setdefault(tipo, []).append(it)

    for (sem, nb, np_), partes in sorted(celulas.items()):
        nome = juntar_linhas([i.texto for i in sorted(partes.get("disciplina", []), key=lambda i: (i.y, i.x))])
        if not nome:
            continue  # professor ou sala sem disciplina: célula vazia ou resto de outra
        prof = " ".join(i.texto for i in sorted(partes.get("professor", []), key=lambda i: (i.y, i.x)))
        sala = [i.texto for i in sorted(partes.get("sala", []), key=lambda i: (i.y, i.x))]
        par = blocos[nb][np_:np_ + 2]
        dia = dias_dos_blocos[nb]
        if dia is None:
            continue
        g.aulas.append(AulaGrade(semestre=sem, dia_semana=dia, inicio=par[0][1], fim=par[-1][2],
                                 disciplina=re.sub(r"\s+", " ", nome).strip(),
                                 professor=bonito(prof) if prof else None, sala=_sala(sala)))

    g.aulas = juntar_aulas_seguidas(g.aulas)
    if not g.aulas:
        g.problemas.append("nenhuma aula encontrada")
    if not g.periodo:
        g.problemas.append("período letivo não encontrado no cabeçalho")
    g.confianca = 0.95 if not g.problemas else (0.6 if g.aulas else 0.0)
    return g


PALAVRAS_CURTAS = {"de", "da", "do", "e", "a", "o", "em", "i", "ii", "iii", "iv", "v", "vi", "ti"}


def juntar_linhas(linhas: list[str]) -> str:
    """Junta as linhas de uma célula; pedaço curto que não é palavra ('ES' de 'COMPUTADOR/ES') cola na anterior."""
    saida = ""
    for t in (x.strip() for x in linhas):
        if saida and len(t) <= 2 and t.isalpha() and t.lower() not in PALAVRAS_CURTAS:
            saida += t
        else:
            saida = f"{saida} {t}".strip()
    return saida


def _minutos(h: str) -> int:
    a, b = h.split(":")
    return int(a) * 60 + int(b)


def juntar_aulas_seguidas(aulas: list[AulaGrade]) -> list[AulaGrade]:
    """Mesma disciplina, professor e sala, com até 20 min de intervalo → uma aula só (19:00–22:30)."""
    aulas = sorted(aulas, key=lambda a: (a.semestre, a.dia_semana, a.inicio))
    saida: list[AulaGrade] = []
    for a in aulas:
        p = saida[-1] if saida else None
        if (p and p.semestre == a.semestre and p.dia_semana == a.dia_semana
                and normalizar(p.disciplina) == normalizar(a.disciplina)
                and normalizar(p.professor) == normalizar(a.professor) and normalizar(p.sala) == normalizar(a.sala)
                and 0 <= _minutos(a.inicio) - _minutos(p.fim) <= 20):
            p.fim = a.fim
        else:
            saida.append(AulaGrade(**asdict(a)))
    return saida


def ler_pdf(dados: bytes) -> list[Grade]:
    """Uma grade por página (alguns cursos põem manhã e noite no mesmo arquivo)."""
    return [ler_itens(itens) for itens in pdf.itens_pdf(dados) if itens]


# ---------------- Reserva: a IA olha a página como imagem ----------------

ESQUEMA_IA = {
    "type": "object",
    "properties": {
        "curso": {"type": "string"},
        "periodo": {"type": "string", "description": "ex.: 2026/2"},
        "turno": {"type": "string", "enum": ["manha", "tarde", "noite"]},
        "aulas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "semestre": {"type": "integer"},
                    "dia_semana": {"type": "integer", "description": "0=domingo, 1=segunda … 6=sábado"},
                    "inicio": {"type": "string", "description": "HH:MM"},
                    "fim": {"type": "string", "description": "HH:MM"},
                    "disciplina": {"type": "string"},
                    "professor": {"type": "string"},
                    "sala": {"type": "string"},
                },
                "required": ["semestre", "dia_semana", "inicio", "fim", "disciplina"],
            },
        },
        "confianca": {"type": "number", "description": "0 a 1: quanto você tem certeza da leitura"},
    },
    "required": ["curso", "periodo", "turno", "aulas", "confianca"],
}

PROMPT_IA = """Esta imagem é a grade de horários de um curso de uma Fatec.
Liste TODAS as aulas: para cada célula preenchida, o semestre da coluna (1º SEM = 1…), o dia da semana,
o horário de início do primeiro tempo e o de fim do último tempo que a célula ocupa, a disciplina como está escrita,
o professor e a sala. Não invente: se uma célula estiver ilegível, deixe de fora e diminua a confiança."""


def ler_com_ia(dados: bytes, ia, pagina: int = 0) -> Grade:
    resp = ia.json(PROMPT_IA, ESQUEMA_IA, imagens=[pdf.png_da_pagina(dados, pagina, dpi=170)], visao=True)
    curso_ia = str(resp.get("curso") or "")
    g = Grade(curso=re.sub(r"\(?\bnovo\b\)?", "", curso_ia, flags=re.I).strip() or None, periodo=resp.get("periodo"),
              turno=resp.get("turno"), metodo="ia",
              matriz="nova" if re.search(r"\bnovo\b", curso_ia, flags=re.I) else None)
    for a in resp.get("aulas", []):
        try:
            if not re.fullmatch(r"\d{2}:\d{2}", a["inicio"]) or not re.fullmatch(r"\d{2}:\d{2}", a["fim"]):
                continue
            if not 0 <= int(a["dia_semana"]) <= 6 or a["inicio"] >= a["fim"]:
                continue
            g.aulas.append(AulaGrade(int(a["semestre"]), int(a["dia_semana"]), a["inicio"], a["fim"],
                                     a["disciplina"].strip(), bonito(a["professor"]) if a.get("professor") else None,
                                     a.get("sala") or None))
        except (KeyError, TypeError, ValueError):
            continue
    g.aulas = juntar_aulas_seguidas(g.aulas)
    # Leitura por imagem nunca publica sozinha: no máximo "provável".
    g.confianca = min(float(resp.get("confianca") or 0.5), 0.75)
    return g
