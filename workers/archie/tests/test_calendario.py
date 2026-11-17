from datetime import date

from archie.extratores import calendario
from archie.extratores.eventos import validar_eventos
from archie.pdf import Item


def test_texto_limpo_tira_a_grade_de_dias():
    itens = [Item(108, 590, "nove", 125), Item(125, 590, "mbro", 145), Item(239, 590, "2026", 255),
             Item(46, 623, "Dom"), Item(75, 623, "Seg"), Item(104, 623, "Ter"), Item(123, 623, "Qua"),
             Item(247, 614, "02"), Item(275, 614, "Não haverá aula - Feriado - Dia de finados"),
             Item(49, 678, "15"), Item(74, 678, "16"), Item(100, 678, "17"), Item(275, 678, "- §1º Inciso II)"),
             Item(56, 458, "17"), Item(91, 458, "Reposição do dia 12/12")]
    texto = calendario.texto_limpo(itens)
    assert "novembro 2026" in texto
    assert "Dom" not in texto
    assert "02 Não haverá aula - Feriado - Dia de finados" in texto
    assert "- §1º Inciso II)" in texto and "15" not in texto.split("\n")[-1]
    assert "17 Reposição do dia 12/12" in texto


def test_validar_eventos():
    brutos = [
        {"titulo": "Feriado · Dia de finados", "tipo": "data_especial", "inicio": "2026-11-02", "fim": None,
         "sem_aula": True, "para_quem": "todos", "cursos": [], "confianca": 0.97},
        {"titulo": "Dia do Professor", "tipo": "data_especial", "inicio": "2026-10-15", "fim": "2026-10-15",
         "sem_aula": True, "para_quem": "todos", "cursos": [], "confianca": 0.9},
        {"titulo": "Prazo para entrega de médias finais", "tipo": "entrega", "inicio": "2026-12-07",
         "para_quem": "professores", "cursos": [], "confianca": 0.9},
        {"titulo": "Data errada", "tipo": "outro", "inicio": "2031-02-30", "confianca": 0.9},
        {"titulo": "Feriado · Dia de finados", "tipo": "data_especial", "inicio": "2026-11-02",
         "para_quem": "todos", "cursos": [], "confianca": 0.5},
    ]
    eventos, problemas = validar_eventos(brutos, ano=2026)
    assert [(e.titulo, e.inicio, e.fim) for e in eventos] == [
        ("Sem aula · Dia do Professor", date(2026, 10, 15), None),
        ("Feriado · Dia de finados", date(2026, 11, 2), None),
    ]
    assert eventos[1].confianca == 0.95  # teto
    assert len(problemas) == 1


class IAFalsa:
    def __init__(self, respostas):
        self.respostas = list(respostas)
        self.prompts = []

    def json(self, prompt, esquema, imagens=None, visao=False, **_):
        self.prompts.append(prompt)
        return self.respostas.pop(0) if self.respostas else {"eventos": []}

    def embed(self, textos):
        return [[0.1, 0.2, 0.3] for _ in textos]


def test_ler_manda_cada_pagina_para_a_ia():
    import pymupdf

    doc = pymupdf.open()
    p = doc.new_page()
    p.insert_text((100, 100), "novembro 2026", fontsize=9)
    p.insert_text((247, 140), "02", fontsize=8)
    p.insert_text((275, 140), "Não haverá aula - Feriado - Dia de finados", fontsize=8)
    ia = IAFalsa([{"eventos": [{"titulo": "Feriado · Dia de finados", "tipo": "data_especial",
                               "inicio": "2026-11-02", "fim": None, "sem_aula": True, "para_quem": "todos",
                               "cursos": [], "trecho": "02 Não haverá aula", "confianca": 0.95}]}])
    cal = calendario.ler(doc.tobytes(), ia, unidade="Fatec Indaiatuba", url="https://x/Calendario-2026.pdf")
    assert cal.ano == 2026
    assert len(ia.prompts) == 1 and "Dia de finados" in ia.prompts[0]
    assert cal.eventos[0].documento_url == "https://x/Calendario-2026.pdf"
