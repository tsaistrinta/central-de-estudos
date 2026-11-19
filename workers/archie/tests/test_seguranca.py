"""Testes de segurança do banco (caixa-branca): cada papel tenta furar as regras do produto.

Roda no schema de verdade (migrações + seed) num Postgres 16, como o Supabase faz: o usuário logado é o papel
"authenticated" com o id em request.jwt.claim.sub; o visitante é "anon". Nada aqui usa a service role.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager

import psycopg
import pytest
from psycopg.rows import dict_row

from tests.test_integracao import url  # noqa: F401  (fixture: banco novo por teste)

TENANT = "00000000-0000-0000-0000-000000000001"
TURMA_POO = "00000000-0000-0000-0000-0000000000e1"
TURMA_EST = "00000000-0000-0000-0000-0000000000e2"
DISC_POO = "00000000-0000-0000-0000-0000000000d1"


@pytest.fixture
def db(url):  # noqa: F811
    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        yield c


def criar_usuario(db, email: str, nome: str, papel: str | None = None) -> str:
    uid = str(uuid.uuid4())
    db.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s::jsonb)",
               (uid, email, f'{{"nome": "{nome}"}}'))
    if papel:
        db.execute("update perfis set papel = %s where id = %s", (papel, uid))
    return uid


@contextmanager
def como(url, uid: str | None):
    """Conexão como o app usa: visitante (anon) ou usuário logado (authenticated) sem privilégios extras."""
    with psycopg.connect(url, autocommit=True, row_factory=dict_row) as c:
        if uid:
            c.execute("set role authenticated")
            c.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid,))
        else:
            c.execute("set role anon")
        yield c


def falha(conexao, sql: str, args=(), contem: str | None = None):
    """O comando tem de ser recusado (erro do banco); devolve a mensagem."""
    with pytest.raises(psycopg.Error) as e:
        conexao.execute(sql, args)
    if contem:
        assert contem in str(e.value), str(e.value)
    return str(e.value)


@pytest.fixture
def pessoas(db):
    p = {
        "ana": criar_usuario(db, "ana.silva@aluno.cps.sp.gov.br", "Ana Silva"),
        "bruno": criar_usuario(db, "bruno.costa@aluno.cps.sp.gov.br", "Bruno Costa"),
        "prof": criar_usuario(db, "marcos.prof@fatec.sp.gov.br", "Marcos Prof", papel="professor"),
        "admin": criar_usuario(db, "lucas.admin@aluno.cps.sp.gov.br", "Lucas Admin", papel="admin"),
    }
    db.execute("update turmas set professor_id = %s where id = %s", (p["prof"], TURMA_POO))
    db.execute("insert into matriculas (usuario_id, turma_id) values (%s, %s)", (p["ana"], TURMA_POO))
    return p


# ------------------------------------------------------------------ cadastro e perfil

def test_cadastro_so_com_email_institucional(db):
    falha(db, "insert into auth.users (id, email) values (gen_random_uuid(), 'alguem@gmail.com')",
          contem="dominio_nao_permitido")


def test_aluno_nao_vira_admin_nem_professor(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        falha(c, "update perfis set papel = 'admin' where id = %s", (pessoas["ana"],), contem="row-level security")
        falha(c, "update perfis set papel = 'professor' where id = %s", (pessoas["ana"],), contem="row-level security")
        c.execute("update perfis set nome = 'Ana S.' where id = %s", (pessoas["ana"],))  # o resto do perfil, pode
        assert c.execute("select papel from perfis where id = %s", (pessoas["ana"],)).fetchone()["papel"] == "aluno"


def test_aluno_nao_ve_email_de_outros(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        emails = {r["email"] for r in c.execute("select email from perfis").fetchall()}
        assert emails <= {"ana.silva@aluno.cps.sp.gov.br"}


# ------------------------------------------------------------------ visitante (sem login)

@pytest.mark.parametrize("tabela", ["perfis", "eventos", "materiais", "mensagens", "acervo_itens", "pedidos_turma",
                                    "turma_codigos", "curadoria", "notificacoes", "auditoria", "matriculas"])
def test_visitante_nao_le_nada(url, pessoas, tabela):  # noqa: F811
    with como(url, None) as c:
        try:
            linhas = c.execute(f"select * from {tabela}").fetchall()
        except psycopg.Error:
            return  # recusado: ótimo
        assert linhas == [], f"visitante leu {len(linhas)} linha(s) de {tabela}"


@pytest.mark.parametrize("chamada", ["select pedir_entrada(%s::uuid, null)" % f"'{TURMA_POO}'",
                                     "select entrar_com_codigo('ABC123')", "select sou_admin()",
                                     "select listar_quarentena()", "select pedidos_pendentes()"])
def test_visitante_nao_chama_funcoes(url, pessoas, chamada):  # noqa: F811
    with como(url, None) as c:
        falha(c, chamada, contem="permission denied")


# ------------------------------------------------------------------ entrar na turma

def test_aluno_nao_se_matricula_sozinho(url, pessoas):  # noqa: F811
    with como(url, pessoas["bruno"]) as c:
        falha(c, "insert into matriculas (usuario_id, turma_id) values (%s, %s)", (pessoas["bruno"], TURMA_POO))


def test_pedido_so_quem_aprova_decide(url, db, pessoas):  # noqa: F811
    with como(url, pessoas["bruno"]) as c:
        assert c.execute("select pedir_entrada(%s, 'faço por aproveitamento')", (TURMA_POO,)).fetchone()[
            "pedir_entrada"] == "pendente"
        pid = c.execute("select id from pedidos_turma where usuario_id = %s", (pessoas["bruno"],)).fetchone()["id"]
        falha(c, "select decidir_pedido(%s, true)", (pid,), contem="sem_permissao")
        # Pendente: ainda não vê a conversa da turma.
        assert c.execute("select esta_na_turma(%s) x", (TURMA_POO,)).fetchone()["x"] is False
    with como(url, pessoas["ana"]) as c:  # colega da turma também não aprova
        falha(c, "select decidir_pedido(%s, true)", (pid,))
    with como(url, pessoas["prof"]) as c:
        c.execute("select decidir_pedido(%s, true)", (pid,))
    with como(url, pessoas["bruno"]) as c:
        assert c.execute("select esta_na_turma(%s) x", (TURMA_POO,)).fetchone()["x"] is True


def test_codigo_da_turma(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:  # aluno não gera nem lê o código
        falha(c, "select gerar_codigo_turma(%s)", (TURMA_POO,), contem="sem_permissao")
    with como(url, pessoas["prof"]) as c:
        codigo = c.execute("select gerar_codigo_turma(%s) c", (TURMA_POO,)).fetchone()["c"]
        assert len(codigo) == 6
        falha(c, "select gerar_codigo_turma(%s)", (TURMA_EST,), contem="sem_permissao")  # turma de outro professor
    with como(url, pessoas["ana"]) as c:
        assert c.execute("select * from turma_codigos").fetchall() == []
    with como(url, pessoas["bruno"]) as c:
        assert str(c.execute("select entrar_com_codigo(%s) t", (codigo.lower(),)).fetchone()["t"]) == TURMA_POO


def test_codigo_errado_bloqueia_depois_de_8(url, pessoas):  # noqa: F811
    with como(url, pessoas["prof"]) as c:
        codigo = c.execute("select gerar_codigo_turma(%s) c", (TURMA_POO,)).fetchone()["c"]
    with como(url, pessoas["bruno"]) as c:
        for _ in range(8):  # código errado: não entra (e a tentativa fica registrada)
            assert c.execute("select entrar_com_codigo('ZZZZZZ') t").fetchone()["t"] is None
        # Nona tentativa na mesma hora: bloqueado, mesmo com o código certo.
        falha(c, "select entrar_com_codigo(%s)", (codigo,), contem="tentativas_demais")
        assert c.execute("select esta_na_turma(%s) x", (TURMA_POO,)).fetchone()["x"] is False


# ------------------------------------------------------------------ dados pessoais e da turma

def test_material_privado_so_o_dono_ve(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        c.execute("insert into materiais (dono_id, tipo, titulo, na_entrada) values (%s, 'anotacao', 'Meu resumo', true)",
                  (pessoas["ana"],))
    with como(url, pessoas["bruno"]) as c:
        assert c.execute("select * from materiais where titulo = 'Meu resumo'").fetchall() == []
        falha(c, "insert into materiais (dono_id, tipo, titulo) values (%s, 'anotacao', 'Falso')", (pessoas["ana"],))


def test_evento_pessoal_e_tarefa_sao_privados(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        c.execute("""insert into eventos (tenant_id, escopo, escopo_id, titulo, tipo, inicio, origem, criado_por)
                     values (%s, 'pessoal', %s, 'Médico', 'outro', now(), 'manual', %s)""",
                  (TENANT, pessoas["ana"], pessoas["ana"]))
        c.execute("insert into tarefas (usuario_id, titulo) values (%s, 'Lista 3')", (pessoas["ana"],))
    with como(url, pessoas["bruno"]) as c:
        assert c.execute("select * from eventos where titulo = 'Médico'").fetchall() == []
        assert c.execute("select * from tarefas where titulo = 'Lista 3'").fetchall() == []


def test_conversa_da_turma_so_para_quem_esta_nela(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        c.execute("insert into mensagens (turma_id, canal, autor_id, texto) values (%s, 'geral', %s, 'oi turma')",
                  (TURMA_POO, pessoas["ana"]))
        falha(c, "insert into mensagens (turma_id, canal, autor_id, texto) values (%s, 'avisos', %s, 'falso aviso')",
              (TURMA_POO, pessoas["ana"]))  # canal de avisos é só do professor
    with como(url, pessoas["bruno"]) as c:
        assert c.execute("select * from mensagens").fetchall() == []
        falha(c, "insert into mensagens (turma_id, canal, autor_id, texto) values (%s, 'geral', %s, 'intruso')",
              (TURMA_POO, pessoas["bruno"]))


def test_so_matriculado_vota(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        pid = c.execute("""insert into propostas (turma_id, tipo, titulo, dados, origem, criado_por)
                           values (%s, 'novo_evento', 'Prova de POO', '{}'::jsonb, 'turma', %s) returning id""",
                        (TURMA_POO, pessoas["ana"])).fetchone()["id"]
    with como(url, pessoas["bruno"]) as c:
        falha(c, "insert into votos (proposta_id, usuario_id, valor) values (%s, %s, 'sim')", (pid, pessoas["bruno"]))
    with como(url, pessoas["ana"]) as c:
        c.execute("insert into votos (proposta_id, usuario_id, valor) values (%s, %s, 'sim')", (pid, pessoas["ana"]))
        falha(c, "insert into votos (proposta_id, usuario_id, valor) values (%s, %s, 'sim')", (pid, pessoas["prof"]))


# ------------------------------------------------------------------ acervo e quarentena

def test_acervo_nao_se_publica_sozinho_e_fica_entre_quem_cursa(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        item = c.execute("""insert into acervo_itens (disciplina_id, titulo, link_url, status)
                            values (%s, 'Prova 2025', 'https://exemplo.com/p.pdf', 'publicado') returning id, status""",
                         (DISC_POO,)).fetchone()
        assert item["status"] == "em_analise"  # o status pedido é ignorado
        falha(c, "insert into acervo_itens (disciplina_id, titulo, arquivo_chave) values (%s, 'X', 'outro/arq.pdf')",
              (DISC_POO,))  # arquivo de outra pessoa
        # Sem política de update: o autor não consegue se auto-publicar.
        assert c.execute("update acervo_itens set status = 'publicado' where id = %s returning id",
                         (item["id"],)).fetchall() == []
        falha(c, "select archie_moderar(%s, true, '{}'::jsonb)", (item["id"],), contem="permission denied")
    with como(url, pessoas["bruno"]) as c:  # não cursa POO
        falha(c, "insert into acervo_itens (disciplina_id, titulo, link_url) values (%s, 'Y', 'https://a.com')",
              (DISC_POO,))
        assert c.execute("select * from listar_quarentena()").fetchall() == []  # não é admin: nada


def test_curadoria_e_funcoes_internas_do_archie(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        assert c.execute("select * from curadoria").fetchall() == []
        falha(c, "select decidir_curadoria(gen_random_uuid(), true)", contem="so_admin")
        falha(c, "select aplicar_curadoria(gen_random_uuid())", contem="permission denied")
        falha(c, "select archie_pedir_coleta(gen_random_uuid())", contem="so_admin")
        falha(c, "insert into fontes (tenant_id, nome, url) values (%s, 'x', 'https://x')", (TENANT,))


# ------------------------------------------------------------------ isolamento entre unidades

def test_outra_unidade_nao_ve_nada_desta(url, db, pessoas):  # noqa: F811
    db.execute("""insert into tenants (id, nome, slug, dominios_permitidos)
                  values ('00000000-0000-0000-0000-000000000002', 'Outra Fatec', 'outra', '{outra.edu.br}')""")
    estranho = criar_usuario(db, "ze@outra.edu.br", "Zé de Outra Unidade")
    db.execute("""insert into eventos (tenant_id, escopo, titulo, tipo, inicio, origem)
                  values (%s, 'unidade', 'Evento da unidade', 'outro', now(), 'manual')""", (TENANT,))
    with como(url, estranho) as c:
        assert c.execute("select * from eventos where tenant_id = %s", (TENANT,)).fetchall() == []
        assert c.execute("select * from turmas").fetchall() == []
        assert c.execute("select * from perfis where id <> %s", (estranho,)).fetchall() == []
        falha(c, "select pedir_entrada(%s, null)", (TURMA_POO,), contem="turma_nao_encontrada")


# ------------------------------------------------------------------ LGPD: exportar e excluir a conta

def test_exportar_traz_so_os_meus_dados(url, pessoas):  # noqa: F811
    with como(url, pessoas["ana"]) as c:
        c.execute("insert into tarefas (usuario_id, titulo) values (%s, 'Lista 3')", (pessoas["ana"],))
        c.execute("insert into mensagens (turma_id, canal, autor_id, texto) values (%s, 'geral', %s, 'oi')",
                  (TURMA_POO, pessoas["ana"]))
    with como(url, pessoas["bruno"]) as c:
        c.execute("insert into tarefas (usuario_id, titulo) values (%s, 'Tarefa do Bruno')", (pessoas["bruno"],))
    with como(url, pessoas["ana"]) as c:
        d = c.execute("select exportar_meus_dados() d").fetchone()["d"]
        assert d["perfil"]["email"] == "ana.silva@aluno.cps.sp.gov.br"
        assert [t["titulo"] for t in d["tarefas"]] == ["Lista 3"]
        assert [m["texto"] for m in d["mensagens"]] == ["oi"]
        assert d["matriculas"][0]["disciplina"] == "Programação Orientada a Objetos"
    with como(url, None) as c:
        falha(c, "select exportar_meus_dados()", contem="permission denied")


def test_excluir_conta_apaga_o_pessoal_e_anonimiza_o_da_turma(url, db, pessoas):  # noqa: F811
    ana = pessoas["ana"]
    with como(url, ana) as c:
        c.execute("insert into materiais (dono_id, tipo, titulo) values (%s, 'anotacao', 'Privado da Ana')", (ana,))
        c.execute("insert into mensagens (turma_id, canal, autor_id, texto) values (%s, 'geral', %s, 'mensagem da Ana')",
                  (TURMA_POO, ana))
        c.execute("insert into duvidas (turma_id, autor_id, texto) values (%s, %s, 'dúvida da Ana')", (TURMA_POO, ana))
        c.execute("insert into tarefas (usuario_id, titulo) values (%s, 'Lista')", (ana,))
        falha(c, "select excluir_minha_conta('sim')", contem="confirmacao_invalida")
        c.execute("select excluir_minha_conta('excluir')")
    assert db.execute("select count(*) n from perfis where id = %s", (ana,)).fetchone()["n"] == 0
    assert db.execute("select count(*) n from auth.users where id = %s", (ana,)).fetchone()["n"] == 0
    assert db.execute("select count(*) n from materiais where titulo = 'Privado da Ana'").fetchone()["n"] == 0
    assert db.execute("select count(*) n from tarefas where usuario_id = %s", (ana,)).fetchone()["n"] == 0
    # O que era da turma continua, sem autor.
    assert db.execute("select autor_id from mensagens where texto = 'mensagem da Ana'").fetchone()["autor_id"] is None
    assert db.execute("select autor_id from duvidas where texto = 'dúvida da Ana'").fetchone()["autor_id"] is None
    a = db.execute("select dados from auditoria where acao = 'conta_excluida'").fetchone()["dados"]
    assert "ana" not in str(a).lower()  # o registro não guarda dado pessoal


def test_ultimo_admin_nao_se_exclui(url, pessoas):  # noqa: F811
    with como(url, pessoas["admin"]) as c:
        falha(c, "select excluir_minha_conta('EXCLUIR')", contem="ultimo_admin")
