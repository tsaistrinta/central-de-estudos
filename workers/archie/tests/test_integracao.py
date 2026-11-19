"""Testes com o schema de verdade num Postgres 16 (veja tests/sql/montar_banco.sh).

ARCHIE_TESTE_PG=postgresql://postgres@localhost:5432/postgres  python -m pytest
Cada teste ganha um banco novo com as migrações e o seed do piloto.
"""

import copy
import os
import subprocess
import uuid
from urllib.parse import urlsplit, urlunsplit
from datetime import date
from pathlib import Path

import httpx
import psycopg
import pytest
from psycopg.rows import dict_row

from tests.conftest import pdf_de_posicoes
from tests.test_calendario import IAFalsa
from archie.banco import Banco
from archie.coletor import Coletor
from archie.conferencia import comparar_grades, uma_leitura
from archie.config import Config
from archie.extratores.eventos import EventoLido
from archie.extratores.grade import ler_pdf
from archie.publicar import Publicador
from archie.worker import Archie

TENANT = "00000000-0000-0000-0000-000000000001"
SQL = Path(__file__).parent / "sql" / "montar_banco.sh"


@pytest.fixture
def url():
    base = os.environ.get("ARCHIE_TESTE_PG")
    if not base:
        pytest.skip("defina ARCHIE_TESTE_PG para os testes com banco")
    nome = f"archie_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(base, autocommit=True) as c:
        c.execute(f"create database {nome}")
    partes = urlsplit(base)
    u = urlunsplit(partes._replace(path=f"/{nome}"))
    subprocess.run(["bash", str(SQL), u], check=True, capture_output=True)
    yield u
    with psycopg.connect(base, autocommit=True) as c:
        c.execute(f"drop database {nome} with (force)")


@pytest.fixture
def banco(url):
    b = Banco(url)
    yield b
    b.fechar()


def cfg(**kw) -> Config:
    os.environ.pop("DATABASE_URL", None)
    c = Config.do_ambiente()
    c.pausa_host_s = 0
    for k, v in kw.items():
        setattr(c, k, v)
    return c


def fonte(banco, extrator):
    return banco._um("select * from fontes where extrator = %s", extrator)


def q(banco, sql, *args):
    return banco._todos(sql, *args)


def aulas(banco, turma):
    return [(r["dia_semana"], r["i"], r["f"], r["sala"]) for r in q(banco, """
        select dia_semana, to_char(inicio, 'HH24:MI') i, to_char(fim, 'HH24:MI') f, sala from aulas_horario
        where turma_id = %s order by dia_semana, inicio""", turma)]


def grade_conferida(segunda=None):
    """A grade real do PDF com a segunda leitura (pela imagem) igual à primeira, ou a que for passada."""
    [g] = ler_pdf(pdf_de_posicoes("grade_ads_noturno_2026_2.tsv"))
    g.conferencia = comparar_grades(g, segunda or copy.deepcopy(g))
    return g


def test_grade_do_pdf_corrige_o_seed_provisorio(banco):
    g = grade_conferida()
    f = fonte(banco, "grade")
    cursos = banco.cursos(TENANT)
    r = Publicador(banco, cfg(), f, None).grade(g, cursos, "2026/2", documento_url="https://x/ADS_NOT.pdf", pagina=1)

    # As 6 turmas do seed foram achadas pelo nome abreviado do PDF, no mesmo semestre, e ganharam o horário real.
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e1") == [(5, "19:00", "22:30", "Lab. 1 / Lab. 3 / Lab. 4")]
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e2") == [(6, "09:30", "13:00", "Lab. 11")]
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e3") == [(2, "20:50", "22:30", "Lab. 11"),
                                                                     (3, "19:00", "20:40", "Lab. 13")]
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e4") == [(4, "20:50", "22:30", "Lab. 12")]  # IHC é do 4º
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e5") == [(1, "19:00", "20:40", "Sala 8")]
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e6") == [(4, "19:00", "22:30", "Lab. 11")]
    prof = {t["id"]: t["professor_nome"] for t in q(banco, "select id::text, professor_nome from turmas")}
    assert prof["00000000-0000-0000-0000-0000000000e1"] == "Sérgio Furgeri"
    assert prof["00000000-0000-0000-0000-0000000000e6"] == "Marlon"
    assert r.mudancas == 6

    # Toda curadoria leva a fonte (PDF e página), o semestre e o resultado da segunda leitura.
    aplicada = q(banco, "select dados from curadoria where decisao = 'aprovado' and item_tipo = 'grade_turma' limit 1")[0]
    assert aplicada["dados"]["documento_url"] == "https://x/ADS_NOT.pdf" and aplicada["dados"]["pagina"] == 1
    assert aplicada["dados"]["conferencia"]["confere"] and aplicada["dados"]["semestre"] in (3, 4)
    # E a turma guarda o link do PDF, que o aluno vê no cartão da aula.
    t = q(banco, "select horario_fonte_url, horario_pagina from turmas where id = '00000000-0000-0000-0000-0000000000e5'")[0]
    assert t == {"horario_fonte_url": "https://x/ADS_NOT.pdf", "horario_pagina": 1}

    # Disciplinas que o seed não tinha esperam o admin (estrutura nova não entra sozinha por padrão).
    pend = q(banco, "select resumo, dados from curadoria where decisao is null and item_tipo = 'disciplina_nova'")
    nomes = {p["dados"]["nome_no_pdf"] for p in pend}
    assert {"INGLES III", "ECONOMIA E FINANÇAS", "G.G.T.I.", "PROG. WEB", "TOP ESP INFO"} <= nomes
    assert len(pend) == r.pendentes == 30 - 6  # 30 disciplinas no PDF, 6 já existiam
    aplicadas = q(banco, "select count(*) n from curadoria where decisao = 'aprovado' and decidido_por is null")
    assert aplicadas[0]["n"] == 6

    # Rodar de novo não repete nada.
    r2 = Publicador(banco, cfg(), f, None).grade(g, cursos, "2026/2")
    assert (r2.mudancas, r2.pendentes, r2.iguais) == (0, 0, 6)


def test_grade_sem_segunda_leitura_nao_publica_nada(banco):
    [g] = ler_pdf(pdf_de_posicoes("grade_ads_noturno_2026_2.tsv"))
    g.conferencia = uma_leitura("só a leitura pela posição (a IA não respondeu)")
    r = Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(g, banco.cursos(TENANT), "2026/2")
    assert r.mudancas == 0 and r.publicados == 0
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e1") != [(5, "19:00", "22:30", "Lab. 1 / Lab. 3 / Lab. 4")]
    motivos = {m["motivo"] for m in q(banco, "select motivo from curadoria where item_tipo = 'grade_turma'")}
    assert motivos == {"as duas leituras não batem: só a leitura pela posição (a IA não respondeu)"}


def test_grade_com_leituras_divergentes_retem_so_o_que_diverge(banco):
    segunda = copy.deepcopy(ler_pdf(pdf_de_posicoes("grade_ads_noturno_2026_2.tsv"))[0])
    for a in segunda.aulas:
        if a.disciplina == "P.O.O":
            a.inicio = "20:50"  # a IA leu outro horário para POO
        if a.disciplina == "ESTATÍSTICA":
            a.sala = "Lab. 9"  # e outra sala para Estatística
    g = grade_conferida(segunda)
    r = Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(g, banco.cursos(TENANT), "2026/2")
    assert r.mudancas == 4  # as outras 4 turmas do seed batem nas duas leituras
    retidas = {c["dados"]["disciplina_nome"]: c for c in q(
        banco, "select motivo, dados from curadoria where decisao is null and item_tipo = 'grade_turma'")}
    assert set(retidas) == {"Programação Orientada a Objetos", "Estatística"}
    assert "dias ou horários diferentes" in retidas["Programação Orientada a Objetos"]["motivo"]
    assert "sala diferente" in retidas["Estatística"]["motivo"]
    c = retidas["Estatística"]["dados"]["conferencia"]
    assert c["posicao"] == "sáb 09:30–13:00 (Lab. 11)" and c["imagem"] == "sáb 09:30–13:00 (Lab. 9)"


def test_grade_nao_casa_nome_de_outro_semestre(banco):
    # Como estava em produção: IHC e Sociedade e Tecnologia cadastradas por engano no 3º semestre.
    q(banco, "update disciplinas set semestre_matriz = 3 where sigla in ('IHC', 'SOC') returning id")
    r = Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(grade_conferida(), banco.cursos(TENANT), "2026/2")
    assert r.mudancas == 4
    assert aulas(banco, "00000000-0000-0000-0000-0000000000e5") != [(1, "19:00", "20:40", "Sala 8")]
    conflito = q(banco, """select motivo, dados from curadoria where decisao is null
                          and dados->>'nome_no_pdf' = 'SOC TEC'""")[0]
    assert conflito["dados"]["ja_existe_em"]["semestre"] == 3 and conflito["dados"]["semestre"] == 4
    assert "já existe" in conflito["motivo"] and "4º" in conflito["motivo"]


def test_grade_exigindo_aprovacao_nao_publica_sozinha(banco):
    r = Publicador(banco, cfg(exigir_aprovacao=True), fonte(banco, "grade"), None).grade(
        grade_conferida(), banco.cursos(TENANT), "2026/2")
    assert r.mudancas == 0 and r.pendentes == 30
    assert {m["motivo"] for m in q(banco, "select motivo from curadoria where item_tipo = 'grade_turma'")} == {
        "aguardando sua aprovação"}


def test_grade_de_outro_periodo_fica_para_depois(banco):
    [g] = ler_pdf(pdf_de_posicoes("grade_ads_noturno_2026_2.tsv"))
    r = Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(g, banco.cursos(TENANT), "2027/1")
    assert r.itens == 0 and "2026/2" in r.notas[0]


def ev(titulo, tipo, inicio, fim=None, conf=0.95, cursos=(), confere=True):
    return EventoLido(titulo=titulo, tipo=tipo, inicio=inicio, fim=fim, confianca=conf, cursos=list(cursos),
                      documento_url="https://www.fatecid.com.br/site/wp-content/uploads/2026/08/Calendario-2026.pdf",
                      conferencia={"confere": confere, "detalhe": "a data confere com o documento" if confere
                                   else "no documento: 16/10; a IA leu 15/10"})


def test_calendario_novo_igual_mudou_e_sumiu(banco):
    f = fonte(banco, "calendario")
    lidos = [
        ev("Feriado · Dia de finados", "data_especial", date(2026, 11, 2)),                     # igual ao seed
        ev("Período de aplicação e correção de exames finais", "prova", date(2026, 12, 17), date(2026, 12, 23)),
        ev("Inscrição para exames finais", "entrega", date(2026, 12, 15)),                     # não rouba o par
        ev("Sem aula · Dia do Professor", "data_especial", date(2026, 10, 15)),                # novo, oficial
        ev("Workshop de Monografias", "data_especial", date(2026, 11, 23), date(2026, 11, 27)),  # = "Oficina…"
        ev("Semana de Tecnologia de Comércio Exterior", "data_especial", date(2026, 9, 28), date(2026, 10, 2),
           cursos=["Comércio Exterior"]),                                                     # outro curso
        ev("Feriado · Dia da Consciência Negra", "data_especial", date(2026, 11, 20), date(2026, 11, 21), conf=0.7),
        ev("Reunião misteriosa", "reuniao", date(2026, 11, 30), conf=0.3),                    # baixa: só curadoria
        ev("Semana de Tecnologia do ADS", "data_especial", date(2026, 10, 5), date(2026, 10, 10),
           cursos=["Análise e Desenvolvimento de Sistemas"]),
    ]
    p = Publicador(banco, cfg(), f, None)
    r = p.eventos(lidos, banco.cursos(TENANT), (date(2026, 9, 28), date(2026, 12, 23)))

    exames = q(banco, "select inicio, fim, origem from eventos where titulo = 'Exames finais'")[0]
    assert exames["inicio"].date() == date(2026, 12, 17) and exames["origem"] == "archie"
    assert q(banco, "select count(*) n from eventos where titulo = 'Inscrição para exames finais'")[0]["n"] == 1
    prof = q(banco, "select status, origem, fonte_id from eventos where titulo like 'Sem aula · Dia do Professor'")[0]
    assert prof["status"] == "oficial" and prof["origem"] == "archie" and prof["fonte_id"] == f["id"]
    assert q(banco, "select count(*) n from eventos where titulo ilike %s", "%comércio exterior%")[0]["n"] == 0
    # A Consciência Negra já existia (20/11) e agora vai até 21/11 (emenda); confiança 0,7 = vai para revisão.
    tipos = sorted((c["item_tipo"], c["decisao"] or "pendente") for c in q(banco, "select * from curadoria"))
    assert ("evento_mudanca", "pendente") in tipos
    assert ("evento_novo", "pendente") in tipos       # reunião com confiança baixa
    assert q(banco, "select count(*) n from eventos where titulo = 'Reunião misteriosa'")[0]["n"] == 0
    # "Revisão de médias" (seed, 15–17/12) e o sábado de reposição de 14/11 não estão mais no documento.
    sumiu = {c["resumo"].split(" · ")[0] for c in q(banco, "select resumo from curadoria where item_tipo = 'evento_sumiu'")}
    assert "Não aparece mais: Revisão de médias" in sumiu
    assert r.ignorados == 1 and r.publicados == 2 and r.mudancas == 1 and r.iguais >= 3

    # Segunda leitura igual: nada novo.
    antes = q(banco, "select count(*) n from curadoria")[0]["n"]
    Publicador(banco, cfg(), f, None).eventos(lidos, banco.cursos(TENANT), (date(2026, 9, 28), date(2026, 12, 23)))
    assert q(banco, "select count(*) n from curadoria")[0]["n"] == antes


def test_provavel_e_override_do_aluno(banco):
    f = fonte(banco, "avisos")
    r = Publicador(banco, cfg(), f, None).eventos([ev("Palestra de carreira", "data_especial", date(2026, 11, 25),
                                                     conf=0.7)], banco.cursos(TENANT), None)
    assert r.provaveis == 1
    e = q(banco, "select id, status from eventos where titulo = 'Palestra de carreira'")[0]
    assert e["status"] == "provavel"
    assert q(banco, "select count(*) n from curadoria where item_tipo = 'evento_provavel' and decisao is null")[0]["n"] == 1


def _login(con, usuario):
    con.execute("set role authenticated")
    con.execute("select set_config('request.jwt.claim.sub', %s, false)", (usuario,))


def _criar_usuario(url, email, papel="aluno"):
    with psycopg.connect(url, autocommit=True) as c:
        uid = c.execute("insert into auth.users (email) values (%s) returning id::text", (email,)).fetchone()[0]
        c.execute("update perfis set papel = %s where id = %s", (papel, uid))
    return uid


def test_admin_decide_e_aluno_nao_aplica_nada(banco, url):
    [g] = ler_pdf(pdf_de_posicoes("grade_ads_noturno_2026_2.tsv"))
    Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(g, banco.cursos(TENANT), "2026/2")
    ingles = q(banco, "select id::text from curadoria where dados ->> 'nome_no_pdf' = 'INGLES III'")[0]["id"]
    admin = _criar_usuario(url, "lucas@aluno.cps.sp.gov.br", "admin")
    aluno = _criar_usuario(url, "colega@aluno.cps.sp.gov.br")

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, aluno)
        for sql in ("select public.aplicar_curadoria(%s)", "select public.aplicar_proposta(%s)"):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(sql, (ingles,))
        with pytest.raises(psycopg.errors.RaiseException, match="so_admin"):
            c.execute("select public.decidir_curadoria(%s, true)", (ingles,))
        assert c.execute("select count(*) n from curadoria").fetchone()["n"] == 0  # RLS: aluno não vê

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, admin)
        c.execute("select public.decidir_curadoria(%s, true)", (ingles,))
        d = c.execute("""select d.nome, d.semestre_matriz, t.professor_nome, t.fonte from disciplinas d
                         join turmas t on t.disciplina_id = d.id where d.nome = 'Ingles III'""").fetchone()
        assert d == {"nome": "Ingles III", "semestre_matriz": 3, "professor_nome": "Magali", "fonte": "archie"}
        cur = c.execute("select decisao, decidido_por::text from curadoria where id = %s", (ingles,)).fetchone()
        assert cur == {"decisao": "aprovado", "decidido_por": admin}
        assert c.execute("select acao from auditoria").fetchone()["acao"] == "curadoria_aprovada"
        msg = c.execute("select public.archie_pedir_coleta(id) m from fontes where extrator = 'grade'").fetchone()["m"]
        assert msg > 0

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, aluno)
        with pytest.raises(psycopg.errors.RaiseException, match="so_admin"):
            c.execute("select public.archie_pedir_coleta(id) from fontes limit 1")


PAGINA_GRADE = """<html><body><article><p>Clique no curso:</p>
<a href="https://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf">– ANÁLISE E DESENVOLVIMENTO DE SISTEMAS</a>
<a href="https://www.fatecid.com.br/site/wp-content/uploads/2026/08/COMEX.pdf">– COMÉRCIO EXTERIOR</a>
</article></body></html>"""


def test_worker_le_a_fonte_da_grade_e_atende_a_fila(banco, url):
    pdf = pdf_de_posicoes("grade_ads_noturno_2026_2.tsv")
    pedidos = []

    def site(req: httpx.Request):
        pedidos.append(req.url.path)
        if req.url.path.endswith("grade-de-horarios-e-salas/"):
            return httpx.Response(200, headers={"content-type": "text/html"}, text=PAGINA_GRADE)
        if req.url.path.endswith("ADS_NOT.pdf"):
            return httpx.Response(200, headers={"content-type": "application/pdf"}, content=pdf)
        return httpx.Response(404, headers={"content-type": "text/html"}, text="não achei")

    c = cfg()
    # A segunda leitura (a IA olhando a imagem) vê a mesma grade; nas releituras forçadas, também.
    [lida] = ler_pdf(pdf)
    resposta_ia = {"curso": lida.curso, "periodo": lida.periodo, "turno": lida.turno, "confianca": 0.9,
                   "aulas": [{"semestre": a.semestre, "dia_semana": a.dia_semana, "inicio": a.inicio, "fim": a.fim,
                              "disciplina": a.disciplina, "professor": a.professor, "sala": a.sala}
                             for a in lida.aulas]}
    ia = IAFalsa([copy.deepcopy(resposta_ia) for _ in range(3)])
    y = Archie(c, banco, Coletor("Teste", 0, transporte=httpx.MockTransport(site)), ia)
    f = fonte(banco, "grade")
    resumo = y.processar_fonte(f)
    assert "ANÁLISE E DESENVOLVIMENTO DE SISTEMAS 2026/2: 6 atualizados, 24 para revisar" in resumo
    assert len(ia.prompts) == 1  # a página foi lida também pela imagem
    assert not any(p.endswith("COMEX.pdf") for p in pedidos)  # curso fora do tenant nem é baixado
    f2 = fonte(banco, "grade")
    assert f2["status"] == "ativa" and f2["ultima_verificacao"] is not None and f2["ultimo_hash"]
    assert q(banco, "select itens, titulo from capturas")[0] == {"itens": 34, "titulo": "ADS_NOT.pdf"}

    # Mesma página e mesmo PDF: não lê de novo.
    assert y.processar_fonte(f2) == "documentos sem mudança"

    # Botão "Verificar agora" → fila → o worker lê de novo (forçado) e apaga a tarefa.
    banco._todos("select pgmq.send('archie_jobs', jsonb_build_object('tipo','coletar','fonte_id',%s::text,'forcar',true))",
                 str(f["id"]))
    banco._todos("update fontes set ultima_verificacao = now()")  # nenhuma fonte vencida
    y.uma_rodada()
    assert q(banco, "select count(*) n from pgmq.q_archie_jobs")[0]["n"] == 0
    assert q(banco, "select count(*) n from capturas")[0]["n"] == 2
    status = q(banco, "select * from archie_status")[0]
    assert status["worker"] == c.worker and status["processadas"] == 3


def test_site_recusou_vira_erro_na_fonte(banco):
    def site(req):
        return httpx.Response(403, text="proibido")

    y = Archie(cfg(), banco, Coletor("Teste", 0, transporte=httpx.MockTransport(site)), IAFalsa([]))
    resumo = y.processar_fonte(fonte(banco, "grade"))
    assert resumo.startswith("erro:") and "403" in resumo
    f = fonte(banco, "grade")
    assert f["status"] == "erro" and "403" in f["ultimo_erro"]


def test_entrada_por_pedido_codigo_e_acervo_moderado(banco, url, monkeypatch):
    """Aluno não se matricula sozinho; entra por código; envia ao acervo; o Archie modera; fora da turma não vê."""
    from archie import moderacao
    from tests.test_moderacao import IAFalsa as IAModeracao, OK, _pdf

    admin = _criar_usuario(url, "lucas@aluno.cps.sp.gov.br", "admin")
    aluno = _criar_usuario(url, "colega@aluno.cps.sp.gov.br")
    outro = _criar_usuario(url, "outro@aluno.cps.sp.gov.br")
    turma = q(banco, "select id::text, disciplina_id::text d from turmas order by id limit 1")[0]

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, aluno)
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("insert into matriculas (turma_id) values (%s)", (turma["id"],))
        assert c.execute("select public.pedir_entrada(%s, 'aproveitamento') r", (turma["id"],)).fetchone()["r"] == "pendente"
    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, admin)
        codigo = c.execute("select public.gerar_codigo_turma(%s) c", (turma["id"],)).fetchone()["c"]
        assert [p["nome"] for p in c.execute("select * from public.pedidos_pendentes()").fetchall()]
    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, aluno)
        assert c.execute("select public.entrar_com_codigo(%s) t", (codigo.lower(),)).fetchone()["t"] is not None
        assert c.execute("select status from pedidos_turma").fetchone()["status"] == "aprovado"
        item = c.execute("""insert into acervo_itens (disciplina_id, titulo, tipo, arquivo_chave, arquivo_nome, status)
                            values (%s, 'P1 2025/2', 'prova_antiga', %s, 'p1.pdf', 'publicado') returning id::text, status""",
                         (turma["d"], f"{aluno}/x/p1.pdf")).fetchone()
        assert item["status"] == "em_analise"  # ninguém se auto-publica

    monkeypatch.setattr(moderacao, "baixar", lambda *a, **k: _pdf("Questao 1: heranca em Java"))
    y = Archie(cfg(), banco, Coletor("Teste", 0), IAModeracao(OK))
    banco._todos("update fontes set ultima_verificacao = now()")
    y.uma_rodada()
    i = q(banco, "select status, moderacao from acervo_itens where id = %s", item["id"])[0]
    assert i["status"] == "publicado" and i["moderacao"]["origem"] == "archie" and len(i["moderacao"]["sha256"]) == 64
    assert q(banco, "select count(*) n from pgmq.q_archie_jobs")[0]["n"] == 0

    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        _login(c, outro)  # não cursa a disciplina
        assert c.execute("select count(*) n from acervo_itens").fetchone()["n"] == 0


def test_grade_da_matriz_nova_nao_mexe_na_matriz_antiga(banco):
    g = grade_conferida()
    g.matriz = "nova"  # o mesmo PDF, como se fosse da matriz nova
    r = Publicador(banco, cfg(), fonte(banco, "grade"), None).grade(g, banco.cursos(TENANT), "2026/2")
    assert r.mudancas == 0  # nenhuma turma da matriz antiga (seed) foi alterada
    soc = q(banco, "select motivo, dados from curadoria where dados->>'nome_no_pdf' = 'SOC TEC'")[0]
    assert soc["dados"]["disciplina"]["matriz"] == "nova"
    assert "matriz antiga" in soc["motivo"] and "matriz nova" in soc["motivo"]
    # Aprovando, a disciplina nova nasce marcada como da matriz nova, separada da antiga.
    cid = q(banco, "select id from curadoria where dados->>'nome_no_pdf' = 'SOC TEC'")[0]["id"]
    turma = q(banco, "select aplicar_curadoria(%s) x", cid)[0]["x"]
    nova = q(banco, "select d.matriz, d.semestre_matriz from turmas t join disciplinas d on d.id = t.disciplina_id where t.id = %s", turma)[0]
    assert nova == {"matriz": "nova", "semestre_matriz": 4}
    antiga = q(banco, "select matriz from disciplinas where id = '00000000-0000-0000-0000-0000000000d5'")[0]
    assert antiga["matriz"] is None  # a da matriz antiga continua igual
