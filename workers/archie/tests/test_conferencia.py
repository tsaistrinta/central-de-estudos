"""Dupla leitura: o conferente sem IA pega os erros típicos do modelo (dia trocado, mês errado, período virando dia)."""

from datetime import date

from archie.conferencia import (comparar_grades, conferir_evento_na_transcricao, conferir_evento_no_texto,
                                datas_no_texto, do_grupo, uma_leitura)
from archie.extratores.grade import AulaGrade, Grade

PAGINA = """CALENDÁRIO ACADÊMICO 2026 - 2º SEMESTRE
OUTUBRO
05 a 09 Semana de Tecnologia - ADS
12 Não haverá aula - Feriado - Nossa Senhora Aparecida
15 Não haverá aula - Dia do Professor
NOVEMBRO
02 Não haverá aula - Feriado - Dia de finados
20 e 21 Não haverá aula - Feriado - Dia da Consciência Negra
23 a 27 Oficina de Monografias e entrega
dos trabalhos de graduação
28 Reposição das aulas de 12 de outubro"""


def test_data_certa_confere():
    c = conferir_evento_no_texto(date(2026, 10, 12), None, "12 Não haverá aula - Feriado - Nossa Senhora Aparecida",
                                 [PAGINA])
    assert c["confere"] and c["pagina"] == 1 and "12/10" in c["detalhe"]


def test_dia_trocado_nao_confere():
    c = conferir_evento_no_texto(date(2026, 10, 16), None, "15 Não haverá aula - Dia do Professor", [PAGINA])
    assert not c["confere"] and "no documento: 15/10" in c["detalhe"] and "a IA leu 16/10" in c["detalhe"]


def test_mes_errado_nao_confere():
    # A IA colocou finados em outubro: a linha está na seção de NOVEMBRO.
    c = conferir_evento_no_texto(date(2026, 10, 2), None, "02 Não haverá aula - Feriado - Dia de finados", [PAGINA])
    assert not c["confere"] and "02/11" in c["detalhe"]


def test_periodo_lido_como_um_dia_nao_confere():
    c = conferir_evento_no_texto(date(2026, 10, 5), None, "05 a 09 Semana de Tecnologia - ADS", [PAGINA])
    assert not c["confere"] and "período" in c["detalhe"]
    ok = conferir_evento_no_texto(date(2026, 10, 5), date(2026, 10, 9), "05 a 09 Semana de Tecnologia - ADS", [PAGINA])
    assert ok["confere"]


def test_periodo_com_e_e_texto_que_continua_na_linha_de_baixo():
    assert conferir_evento_no_texto(date(2026, 11, 20), date(2026, 11, 21),
                                    "20 e 21 Não haverá aula - Feriado - Dia da Consciência Negra", [PAGINA])["confere"]
    # O trecho citado é a continuação da linha: o dia vem da linha de cima.
    c = conferir_evento_no_texto(date(2026, 11, 23), date(2026, 11, 27), "dos trabalhos de graduação", [PAGINA])
    assert c["confere"]


def test_mes_citado_no_texto_da_linha_nao_engana():
    assert conferir_evento_no_texto(date(2026, 11, 28), None, "28 Reposição das aulas de 12 de outubro",
                                    [PAGINA])["confere"]


def test_trecho_inventado_ou_ausente_nao_confere():
    assert not conferir_evento_no_texto(date(2026, 12, 1), None, "Formatura geral no ginásio", [PAGINA])["confere"]
    assert not conferir_evento_no_texto(date(2026, 12, 1), None, None, [PAGINA])["confere"]


def test_transcricao_da_imagem():
    texto = "COMUNICADO: dia 14/11 não haverá aula. Reposição em 28 de novembro."
    assert datas_no_texto(texto, 2026) == {date(2026, 11, 14), date(2026, 11, 28)}
    assert conferir_evento_na_transcricao(date(2026, 11, 14), None, texto)["confere"]
    c = conferir_evento_na_transcricao(date(2026, 11, 15), None, texto)
    assert not c["confere"] and "15/11" in c["detalhe"]
    assert not conferir_evento_na_transcricao(date(2026, 11, 14), None, "")["confere"]


def _grade(*aulas):
    return Grade(curso="ADS", periodo="2026/2", turno="noite", aulas=[AulaGrade(*a) for a in aulas])


def test_grades_iguais_conferem_mesmo_com_nome_escrito_diferente():
    a = _grade((3, 5, "19:00", "22:30", "P.O.O", "Sérgio Furgeri", "Lab. 1"))
    b = _grade((3, 5, "19:00", "22:30", "POO", "Sergio Furgeri", "Lab 1"))
    c = comparar_grades(a, b)
    assert c["concordam"] and do_grupo(c, 3, "P.O.O")["confere"]


def test_grades_com_horario_professor_ou_semestre_diferente():
    a = _grade((3, 5, "19:00", "22:30", "P.O.O", "Sérgio Furgeri", "Lab. 1"),
               (4, 1, "19:00", "20:40", "SOC TEC", "Miriam", "Sala 8"))
    b = _grade((3, 5, "19:00", "20:40", "P.O.O", "Carlos Dias", "Lab. 1"),
               (3, 1, "19:00", "20:40", "SOC TEC", "Miriam", "Sala 8"))  # a IA pôs no 3º semestre
    c = comparar_grades(a, b)
    assert not c["concordam"]
    poo = do_grupo(c, 3, "P.O.O")
    assert not poo["confere"] and "horários" in poo["detalhe"] and "professor" in poo["detalhe"]
    assert not do_grupo(c, 4, "SOC TEC")["confere"]
    assert c["so_na_imagem"] and "3º sem." in c["so_na_imagem"][0]


def test_uma_leitura_so_nunca_confere():
    c = uma_leitura("a IA não respondeu")
    assert not do_grupo(c, 3, "P.O.O")["confere"]
    assert not do_grupo(None, 3, "P.O.O")["confere"]
