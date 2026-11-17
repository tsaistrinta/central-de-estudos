from archie.extratores.grade import AulaGrade, juntar_aulas_seguidas, ler_pdf


def aulas_do(grade, sem):
    return [(a.dia_semana, a.inicio, a.fim, a.disciplina, a.professor, a.sala) for a in grade.aulas if a.semestre == sem]


def test_cabecalho(pdf_grade_ads):
    [g] = ler_pdf(pdf_grade_ads)
    assert g.problemas == []
    assert g.periodo == "2026/2"
    assert g.turno == "noite"
    assert g.curso == "ANÁLISE E DESENVOLVIMENTO DE SISTEMAS"
    assert g.confianca >= 0.9


def test_terceiro_semestre_igual_ao_pdf(pdf_grade_ads):
    [g] = ler_pdf(pdf_grade_ads)
    assert aulas_do(g, 3) == [
        (1, "19:00", "20:40", "INGLES III", "Magali", "Sala 9"),
        (1, "20:50", "22:30", "ECONOMIA E FINANÇAS", "Reinaldo", "Sala 9"),
        (2, "19:00", "20:40", "G.G.T.I.", "Michel", "Lab. 13"),
        (2, "20:50", "22:30", "ENG. SOFTWARE II", "Marlon", "Lab. 11"),
        (3, "19:00", "20:40", "ENG. SOFTWARE II", "Marlon", "Lab. 13"),
        (3, "20:50", "22:30", "G.G.T.I.", "Michel", "Lab. 13"),
        (4, "19:00", "22:30", "BANCO DE DADOS", "Marlon", "Lab. 11"),   # aula dupla juntada
        (5, "19:00", "22:30", "P.O.O", "Sérgio Furgeri", "Lab. 1 / Lab. 3 / Lab. 4"),
        (6, "09:30", "13:00", "ESTATÍSTICA", "Carlos Dias", "Lab. 11"),
    ]


def test_outros_semestres(pdf_grade_ads):
    [g] = ler_pdf(pdf_grade_ads)
    assert aulas_do(g, 1) == [] and aulas_do(g, 2) == []
    quarto = aulas_do(g, 4)
    assert (4, "20:50", "22:30", "I.H.C", "Michel", "Lab. 12") in quarto
    assert (1, "19:00", "20:40", "SOC TEC", "Miriam Urraza", "Sala 8") in quarto
    sexto = aulas_do(g, 6)
    assert (4, "19:00", "22:30", "REDES DE COMPUTADORES", "Lincon", "Lab. 7") in sexto
    assert (2, "19:00", "20:40", "LAB ENG SOFTWARE", "Marlon", "Lab. 5") in sexto
    assert [len(aulas_do(g, s)) for s in (3, 4, 5, 6)] == [9, 9, 7, 9]


def test_juntar_respeita_intervalo():
    a = AulaGrade(3, 1, "19:00", "20:40", "X", "P", "S")
    b = AulaGrade(3, 1, "21:30", "22:30", "X", "P", "S")
    assert len(juntar_aulas_seguidas([a, b])) == 2
