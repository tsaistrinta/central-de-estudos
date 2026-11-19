"""Calendário acadêmico (PDF): o texto vai página a página para a IA, que devolve as datas em JSON.

O PDF da Fatec tem, por mês, uma grade de dias (números soltos) e ao lado a lista "DD texto" / "DD a DD texto".
A grade de números atrapalha a IA, então saem as linhas que são só números antes de mandar.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

from archie import pdf
from archie.conferencia import conferir_evento_no_texto
from archie.extratores.eventos import EventoLido, validar_eventos

ESQUEMA = {
    "type": "object",
    "properties": {
        "eventos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string"},
                    "tipo": {"type": "string", "enum": ["prova", "entrega", "trabalho", "apresentacao", "aula",
                                                         "reuniao", "data_especial", "outro"]},
                    "inicio": {"type": "string", "description": "AAAA-MM-DD"},
                    "fim": {"type": ["string", "null"], "description": "AAAA-MM-DD do último dia, ou null"},
                    "sem_aula": {"type": "boolean"},
                    "para_quem": {"type": "string", "enum": ["alunos", "professores", "todos"]},
                    "cursos": {"type": "array", "items": {"type": "string"}},
                    "trecho": {"type": "string", "description": "o texto do PDF de onde saiu"},
                    "confianca": {"type": "number"},
                },
                "required": ["titulo", "tipo", "inicio", "fim", "sem_aula", "para_quem", "cursos", "trecho",
                             "confianca"],
            },
        }
    },
    "required": ["eventos"],
}

PROMPT = """Texto de uma página do CALENDÁRIO ACADÊMICO {ano} da {unidade}.
Cada mês tem o nome do mês e uma lista de linhas "DD texto" ou "DD a DD texto" (o texto pode continuar na linha de baixo).

Liste TODAS as datas e períodos da página. Regras:
- Datas completas AAAA-MM-DD do ano {ano}. "05 a 09" = inicio 05 e fim 09; "20 e 21" com um texto só = inicio 20, fim 21; um dia só = fim null.
- "Não haverá aula - Feriado - X" → titulo "Feriado · X", tipo "data_especial", sem_aula true.
- "Não haverá aula - X" (sem ser feriado), "Dia não letivo" → titulo "Sem aula · X", tipo "data_especial", sem_aula true.
- Recesso → titulo "Recesso escolar", sem_aula true.
- "Reposição 23/10" ou "Reposição do dia 12/12" → titulo "Reposição das aulas de 23/10", tipo "aula".
- Provas, avaliações e exames → tipo "prova". Prazos que o aluno precisa cumprir (trancamento, desistência, inscrição, revisão de média) → tipo "entrega".
- Semanas de tecnologia, workshops, vestibular, início e término das aulas → tipo "data_especial".
- para_quem: "professores" quando só os professores precisam fazer algo (entregar notas, fechar diários, chave no SIGA).
- cursos: os cursos citados (ex.: "Gestão Empresarial", "ADS", "Redes de Computadores"); lista vazia se vale para todos.
- titulo curto e claro, sem "Art." nem número de lei. trecho = o texto original da linha.
- confianca de 0 a 1; abaixe se a data ou o texto estiverem embaralhados.
Não invente datas que não estão no texto.

TEXTO:
{texto}"""


@dataclass
class Calendario:
    ano: int | None
    eventos: list[EventoLido] = field(default_factory=list)
    texto: list[str] = field(default_factory=list)  # texto limpo por página (vai para a base de conhecimento)
    problemas: list[str] = field(default_factory=list)


def _so_numero(t: str) -> bool:
    return bool(re.fullmatch(r"\d{1,2}", t.strip()))


def texto_limpo(itens: list[pdf.Item]) -> str:
    """Linhas da página sem a grade de dias do mês e sem 'Dom Seg Ter…'."""
    saida = []
    for _, linha in pdf.linhas(itens):
        partes = [p for p in linha.split("  ") if p.strip()]
        numeros = sum(1 for p in partes if _so_numero(p))
        if numeros >= 3:
            partes = [p for p in partes if not _so_numero(p)]
        if not partes:
            continue
        juntas = " ".join(partes)
        if re.fullmatch(r"(dom|seg|ter|qua|qui|sex|s[áa]b)[\s.]*((dom|seg|ter|qua|qui|sex|s[áa]b)[\s.]*)+", juntas, re.I):
            continue
        saida.append(juntas)
    return "\n".join(saida)


def ano_do_documento(textos: list[str], url: str = "") -> int | None:
    anos = Counter(re.findall(r"\b(20[2-4]\d)\b", " ".join(textos) + " " + url))
    return int(anos.most_common(1)[0][0]) if anos else None


def ler(dados: bytes, ia, unidade: str, url: str = "", hoje: date | None = None) -> Calendario:
    paginas = [texto_limpo(itens) for itens in pdf.itens_pdf(dados)]
    cal = Calendario(ano=ano_do_documento(paginas, url), texto=paginas)
    if not cal.ano:
        cal.problemas.append("não achei o ano do calendário")
        return cal
    brutos = []
    for n, texto in enumerate(paginas, start=1):
        if len(texto) < 40:
            continue
        resp = ia.json(PROMPT.format(ano=cal.ano, unidade=unidade, texto=texto), ESQUEMA)
        for e in resp.get("eventos", []):
            e["pagina"] = n
            brutos.append(e)
    cal.eventos, problemas = validar_eventos(brutos, ano=cal.ano, documento_url=url)
    cal.problemas += problemas
    # Segunda leitura, sem IA: a data tem de estar escrita na linha que a IA citou.
    for e in cal.eventos:
        e.conferencia = conferir_evento_no_texto(e.inicio, e.fim, e.trecho, paginas)
        if not e.pagina and e.conferencia.get("pagina"):
            e.pagina = e.conferencia["pagina"]
    return cal
