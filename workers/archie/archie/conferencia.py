"""Dupla leitura: nada do que o Archie lê vai para o admin sem passar por um segundo caminho de leitura.

- Grade de horários: leitura pela posição do texto no PDF (sem IA) x leitura da imagem da página (IA).
- Calendário: a IA lê o texto; depois um conferente sem IA procura no próprio documento a linha citada,
  o dia no começo da linha e o mês da seção em que ela está, e compara com a data que a IA devolveu.
- Aviso em imagem: a IA lê o aviso; numa segunda passada só transcreve o texto da imagem, e as datas são
  conferidas contra essa transcrição.

O resultado vai junto com o item na curadoria ("conferencia"), para o admin ver as duas leituras lado a lado.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from difflib import SequenceMatcher

from archie.texto import mesmo_nome, normalizar, sem_acento, similaridade

MESES = {"janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
         "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}
RE_MES = re.compile(r"\b(" + "|".join(MESES) + r")\b")
RE_CABECALHO_MES = re.compile(r"^\s*(" + "|".join(MESES) + r")\b[\s/de]*(\d{4})?\s*$")
RE_DIAS = re.compile(r"^\s*(\d{1,2})(?:\s*(a|e|-|–|ate)\s*(\d{1,2}))?\b")
RE_DATA_CURTA = re.compile(r"\b(\d{1,2})\s*/\s*(\d{1,2})(?:\s*/\s*(\d{2,4}))?\b")
RE_DATA_EXTENSO = re.compile(r"\b(\d{1,2})\s+de\s+(" + "|".join(MESES) + r")\b")


def _ok(detalhe: str, **extra) -> dict:
    return {"confere": True, "detalhe": detalhe, **extra}


def _diverge(detalhe: str, **extra) -> dict:
    return {"confere": False, "detalhe": detalhe, **extra}


# ---------------------------------------------------------------- calendário (texto)

def _parecido(trecho: str, linha: str) -> float:
    """1.0 quando a linha contém o trecho inteiro; parcial quando a linha é só um pedaço dele."""
    if not trecho or not linha:
        return 0.0
    if trecho in linha:
        return 1.0
    if linha in trecho:
        return len(linha) / len(trecho)
    return SequenceMatcher(None, trecho, linha).ratio()


def _leve(s: str) -> str:
    """Minúsculas e sem acento, mas mantendo / - e números (para ler datas)."""
    return re.sub(r"\s+", " ", sem_acento(s or "").lower()).strip()


def _achar_linha(trecho: str, paginas: list[str]) -> tuple[int, int, float] | None:
    """(página, linha, semelhança) da linha onde começa o trecho citado pela IA."""
    alvo = normalizar(trecho)
    sozinhas, juntas = [], []
    for p, texto in enumerate(paginas):
        linhas = [normalizar(l) for l in texto.splitlines()]
        for i, linha in enumerate(linhas):
            sozinhas.append((_parecido(alvo, linha), p, i))
            if i + 1 < len(linhas):  # o trecho pode começar numa linha e terminar na seguinte
                juntas.append((_parecido(alvo, f"{linha} {linhas[i + 1]}"), p, i))
    for candidatos in (sozinhas, juntas):
        if candidatos:
            nota, p, i = max(candidatos, key=lambda c: c[0])
            if nota >= 0.8:
                return p, i, nota
    return None


def conferir_evento_no_texto(inicio: date, fim: date | None, trecho: str | None, paginas: list[str]) -> dict:
    """Confere, sem IA, se a data que a IA leu é a mesma que está escrita na linha citada do documento."""
    if not trecho or not trecho.strip():
        return _diverge("a IA não indicou de que linha do documento tirou a data")
    achado = _achar_linha(trecho, paginas)
    if not achado:
        return _diverge("a linha citada pela IA não foi encontrada no documento")
    p, i, _ = achado
    linhas = [_leve(l) for l in paginas[p].splitlines()]

    # Dia: no começo da linha; se for continuação, até duas linhas acima.
    dias = None
    for k in range(i, max(-1, i - 3), -1):
        m = RE_DIAS.match(linhas[k])
        if m:
            dias = m
            break
    # Mês: o cabeçalho de mês ("OUTUBRO", "Outubro 2026") mais perto acima da linha, na mesma página.
    # Sem cabeçalho limpo, vale o último mês citado nas linhas de cima (nunca o da própria linha,
    # que pode ser "Reposição do dia 12 de outubro" dentro de novembro).
    mes = None
    for k in range(i - 1, -1, -1):
        m = RE_CABECALHO_MES.match(linhas[k])
        if m:
            mes = MESES[m.group(1)]
            break
    if mes is None:
        for k in range(i - 1, -1, -1):
            achados = RE_MES.findall(linhas[k])
            if achados:
                mes = MESES[achados[-1]]
                break
    if not dias or not mes:
        return _diverge("não deu para ler o dia ou o mês na linha do documento", pagina=p + 1)

    dia1 = int(dias.group(1))
    dia2 = int(dias.group(3)) if dias.group(3) else None
    escrito = f"{dia1:02d}/{mes:02d}" + (f" {'a' if dias.group(2) != 'e' else 'e'} {dia2:02d}/{mes:02d}" if dia2 else "")
    lido = inicio.strftime("%d/%m") + (f" a {fim.strftime('%d/%m')}" if fim else "")
    if inicio.day != dia1 or inicio.month != mes:
        return _diverge(f"no documento: {escrito}; a IA leu {lido}", pagina=p + 1)
    if dia2 and fim and fim.day != dia2:
        return _diverge(f"no documento: {escrito}; a IA leu {lido}", pagina=p + 1)
    if dia2 and not fim:
        return _diverge(f"no documento é um período ({escrito}); a IA leu um dia só ({lido})", pagina=p + 1)
    return _ok(f"a data confere com o documento ({escrito})", pagina=p + 1)


# ---------------------------------------------------------------- aviso em imagem (transcrição)

def datas_no_texto(texto: str, ano: int) -> set[date]:
    """Todas as datas escritas num texto ("12/10", "12/10/2026", "12 de outubro")."""
    n = _leve(texto)
    saida = set()
    for d, m, a in RE_DATA_CURTA.findall(n):
        try:
            aa = int(a) + (2000 if a and len(a) == 2 else 0) if a else ano
            saida.add(date(aa, int(m), int(d)))
        except ValueError:
            continue
    for d, nome in RE_DATA_EXTENSO.findall(n):
        try:
            saida.add(date(ano, MESES[nome], int(d)))
        except ValueError:
            continue
    return saida


def conferir_evento_na_transcricao(inicio: date, fim: date | None, transcricao: str) -> dict:
    """Confere uma data lida na imagem contra a transcrição feita numa segunda passada."""
    if not transcricao.strip():
        return _diverge("a segunda leitura da imagem não devolveu texto")
    achadas = {(d.day, d.month) for d in datas_no_texto(transcricao, inicio.year)}
    faltam = [d for d in (inicio, fim) if d and (d.day, d.month) not in achadas]
    if faltam:
        return _diverge("a data " + ", ".join(d.strftime("%d/%m") for d in faltam)
                        + " não aparece na transcrição da imagem")
    return _ok("a data aparece nas duas leituras da imagem")


# ---------------------------------------------------------------- grade de horários

def _chave_aula(a) -> tuple:
    return (a.dia_semana, a.inicio, a.fim)


def _mesmo_professor(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return not a and not b
    na, nb = normalizar(a), normalizar(b)
    return na == nb or na.startswith(nb) or nb.startswith(na) or similaridade(a, b) >= 0.8


def _mesma_sala(a: str | None, b: str | None) -> bool:
    return re.sub(r"[^a-z0-9]", "", normalizar(a)) == re.sub(r"[^a-z0-9]", "", normalizar(b))


def _mesma_disciplina(a: str, b: str) -> bool:
    return normalizar(a) == normalizar(b) or mesmo_nome(a, b) or mesmo_nome(b, a) or similaridade(a, b) >= 0.8


def grupos_da_grade(g) -> dict[tuple[int, str], list]:
    grupos: dict[tuple[int, str], list] = defaultdict(list)
    for a in g.aulas:
        grupos[(a.semestre, normalizar(a.disciplina))].append(a)
    return grupos


def _txt(aulas) -> str:
    dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
    return "; ".join(f"{dias[a.dia_semana]} {a.inicio}–{a.fim}" + (f" ({a.sala})" if a.sala else "")
                     for a in sorted(aulas, key=_chave_aula)) or "nada"


def comparar_grades(principal, segunda) -> dict:
    """Compara duas leituras da mesma página da grade, disciplina por disciplina.

    Devolve {"leituras": 2, "concordam": bool, "grupos": {"sem|disciplina": {...}}, "so_na_segunda": [...]}.
    Um grupo só "confere" se a mesma disciplina, no mesmo semestre, tem os mesmos dias, horários e salas
    nas duas leituras (e o professor bate, quando as duas trazem professor).
    """
    g1, g2 = grupos_da_grade(principal), grupos_da_grade(segunda)
    usados: set[tuple[int, str]] = set()
    grupos = {}
    for (sem, nome), aulas in g1.items():
        par = next((k for k in g2 if k[0] == sem and k not in usados and _mesma_disciplina(nome, k[1])), None)
        chave = f"{sem}|{nome}"
        if not par:
            grupos[chave] = _diverge(f"a leitura da imagem não encontrou {aulas[0].disciplina} no {sem}º semestre",
                                     posicao=_txt(aulas), imagem="nada")
            continue
        usados.add(par)
        outras = g2[par]
        a1 = sorted(aulas, key=_chave_aula)
        a2 = sorted(outras, key=_chave_aula)
        problemas = []
        if [_chave_aula(a) for a in a1] != [_chave_aula(a) for a in a2]:
            problemas.append("dias ou horários diferentes")
        elif any(not _mesma_sala(x.sala, y.sala) for x, y in zip(a1, a2)):
            problemas.append("sala diferente")
        p1 = next((a.professor for a in a1 if a.professor), None)
        p2 = next((a.professor for a in a2 if a.professor), None)
        if p1 and p2 and not _mesmo_professor(p1, p2):
            problemas.append(f"professor diferente ({p1} x {p2})")
        detalhe = "as duas leituras batem" if not problemas else "; ".join(problemas)
        grupos[chave] = (_ok if not problemas else _diverge)(detalhe, posicao=_txt(a1), imagem=_txt(a2))
    sobras = [f"{k[0]}º sem.: {g2[k][0].disciplina} ({_txt(g2[k])})" for k in g2 if k not in usados]
    concordam = all(v["confere"] for v in grupos.values()) and not sobras
    return {"leituras": 2, "concordam": concordam, "grupos": grupos, "so_na_imagem": sobras}


def uma_leitura(motivo: str) -> dict:
    """Quando só deu para ler de um jeito: nunca conta como conferido."""
    return {"leituras": 1, "concordam": False, "grupos": {}, "so_na_imagem": [], "motivo": motivo}


def do_grupo(conferencia: dict | None, sem: int, disciplina: str) -> dict:
    if not conferencia:
        return _diverge("sem segunda leitura")
    if conferencia.get("leituras", 1) < 2:
        return _diverge(conferencia.get("motivo") or "só uma leitura")
    return conferencia["grupos"].get(f"{sem}|{normalizar(disciplina)}") or _diverge("sem segunda leitura")
