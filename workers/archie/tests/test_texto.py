from archie.texto import bonito, mesmo_nome, similaridade


def test_mesmo_nome_de_disciplina():
    assert mesmo_nome("P.O.O", "Programação Orientada a Objetos", "POO")
    assert mesmo_nome("ENG. SOFTWARE II", "Engenharia de Software II", "ES II")
    assert mesmo_nome("I.H.C", "Interação Humano-Computador", "IHC")
    assert mesmo_nome("BANCO DE DADOS", "Banco de Dados", "BD")
    assert mesmo_nome("ESTATÍSTICA", "Estatística", "EST")
    assert mesmo_nome("SOC TEC", "Sociedade e Tecnologia", "SOC")
    assert not mesmo_nome("BANCO DE DADOS I", "Banco de Dados", "BD")
    assert not mesmo_nome("ENG SOFT III", "Engenharia de Software II", "ES II")
    assert not mesmo_nome("INGLES III", "Inglês IV", None)


def test_similaridade_de_titulos():
    assert similaridade("Exames finais", "Período de aplicação e correção de exames finais") >= 0.85
    assert similaridade("Feriado · Finados", "Feriado · Dia de finados") >= 0.6
    assert similaridade("Feriado · Finados", "Semana de Tecnologia ADS") < 0.5


def test_bonito():
    assert bonito("BANCO DE DADOS") == "Banco de Dados"
    assert bonito("ENG. SOFTWARE II") == "Eng. Software II"
    assert bonito("G.G.T.I.") == "G.G.T.I."
    assert bonito("ECONOMIA E FINANÇAS") == "Economia e Finanças"
    assert bonito("SÉRGIO FURGERI") == "Sérgio Furgeri"
