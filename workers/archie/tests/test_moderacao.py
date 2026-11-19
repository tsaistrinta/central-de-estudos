"""Moderação do acervo: regras que não dependem do modelo + decisão com um modelo falso."""

import io
import zipfile

import pymupdf
import pytest

from archie import moderacao as m
from archie.ia import IAIndisponivel


def _pdf(texto: str, js: bool = False) -> bytes:
    doc = pymupdf.open()
    pag = doc.new_page()
    pag.insert_text((72, 72), texto)
    if js:  # PDF com ação JavaScript ao abrir (como um malicioso faria), guardado comprimido
        doc.xref_set_key(doc.pdf_catalog(), "OpenAction", "<< /S /JavaScript /JS (app.alert(1)) >>")
        return doc.tobytes(garbage=3, deflate=True, use_objstms=1)
    return doc.tobytes()


def _office(pasta: str, extra: dict[str, bytes] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr(f"{pasta}/document.xml", "<w:t>Resumo de herança e polimorfismo</w:t>")
        for nome, conteudo in (extra or {}).items():
            z.writestr(nome, conteudo)
    return buf.getvalue()


class IAFalsa:
    modelo = "falso"

    def __init__(self, resposta: dict):
        self.resposta = resposta
        self.chamadas = 0

    def json(self, *a, **k):
        self.chamadas += 1
        return self.resposta


OK = {"adequado": True, "categorias": [], "motivo": "Resumo da disciplina.", "confianca": 0.9}
ITEM = {"titulo": "P1 de POO", "descricao": None, "tipo": "prova_antiga", "disciplina": "POO"}


def test_tipo_real_pelos_bytes():
    assert m.detectar_tipo(_pdf("oi")) == "pdf"
    assert m.detectar_tipo(_office("word")) == "docx"
    assert m.detectar_tipo(_office("ppt")) == "pptx"
    assert m.detectar_tipo(b"MZ\x90\x00programa") is None  # executável com nome .pdf continua executável
    assert m.detectar_tipo(b"#!/bin/sh\nrm -rf /") is None
    assert m.detectar_tipo("Anotações da aula".encode()) == "texto"
    zip_comum = io.BytesIO()
    with zipfile.ZipFile(zip_comum, "w") as z:
        z.writestr("virus.exe", b"MZ")
    assert m.detectar_tipo(zip_comum.getvalue()) is None


def test_pdf_com_javascript_vai_para_quarentena():
    ia = IAFalsa(OK)
    r = m.moderar(ITEM, _pdf("Prova", js=True), ia)
    assert not r.publicar and r.categorias == ["codigo_embutido"]
    assert ia.chamadas == 0  # nem chega no modelo


def test_office_com_macro_vai_para_quarentena():
    r = m.moderar(ITEM, _office("word", {"word/vbaProject.bin": b"\x00" * 10}), IAFalsa(OK))
    assert not r.publicar and "macro" in r.motivo


def test_executavel_disfarcado():
    r = m.moderar({**ITEM, "arquivo_nome": "prova.pdf"}, b"MZ\x90\x00" + b"\x00" * 100, IAFalsa(OK))
    assert not r.publicar and r.categorias == ["tipo_proibido"] and r.sha256


def test_dados_pessoais_mascarados():
    texto = "Lista de presença\nJoão 529.982.247-25 (19) 99123-4567\nMaria (11) 98765-4321"
    r = m.moderar(ITEM, texto.encode(), IAFalsa(OK))
    assert not r.publicar and r.categorias == ["dados_pessoais"]
    assert "529" not in (r.trecho or "") and "*" in r.trecho


def test_cpf_invalido_e_email_institucional_passam():
    texto = "Prova do prof. fulano@fatec.sp.gov.br · gabarito 111.111.111-11 · questão 123.456.789-00"
    assert m.dados_pessoais(texto) == ([], None)


def test_material_bom_e_publicado():
    r = m.moderar(ITEM, _pdf("Questao 1: explique heranca em Java."), IAFalsa(OK))
    assert r.publicar and r.origem == "archie" and r.modelo == "falso"


def test_modelo_reprova_ou_duvida():
    r = m.moderar(ITEM, _pdf("texto"), IAFalsa({"adequado": False, "categorias": ["sexual"], "motivo": "Imagem imprópria.", "confianca": 0.95}))
    assert not r.publicar and r.categorias == ["sexual"]
    r = m.moderar(ITEM, _pdf("texto"), IAFalsa({**OK, "confianca": 0.3}))
    assert not r.publicar and "Certeza baixa" in r.motivo


def test_links():
    assert m.problemas_do_link("https://refactoring.guru/pt-br") == []
    assert m.problemas_do_link("https://bit.ly/abc")
    assert m.problemas_do_link("https://192.168.0.1/x")
    assert m.problemas_do_link("https://site.com/instalador.exe")
    r = m.moderar({**ITEM, "link_url": "https://bit.ly/x"}, None, IAFalsa(OK))
    assert not r.publicar and r.categorias == ["malicioso"]


def test_sem_modelo_nao_decide():
    with pytest.raises(IAIndisponivel):
        m.moderar(ITEM, _pdf("ok"), None)


def test_baixar_exige_credenciais():
    with pytest.raises(m.SemArmazenamento):
        m.baixar(None, None, "a/b.pdf")
