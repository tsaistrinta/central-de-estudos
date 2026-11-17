import httpx
import pytest

from archie.coletor import ColetaRecusada, Coletor, imagens, links_de_documento

HOME = """<html><body><nav><a href="/site/index.php/calendario-academico/">Calendário</a></nav>
<div class="carousel"><img src="/site/wp-content/uploads/2026/10/SITE-4.png"></div>
<img src="http://www.fatecid.com.br/site/wp-content/uploads/2026/06/LOGO_SITE.png">
<img src="/site/wp-content/themes/fatecid/img/01.jpg">
<img src="/site/wp-content/uploads/2026/10/Comunicado-importante-726x1024.png"></body></html>"""

GRADE = """<html><body><div class="menu"><a href="/site/x/regimento.pdf">Regimento</a></div>
<article><p>Clique no curso:</p>
<a href="http://www.fatecid.com.br/site/wp-content/uploads/2026/08/ADS_NOT.pdf">– ANÁLISE E DESENVOLVIMENTO DE SISTEMAS</a>
<a href="http://www.fatecid.com.br/site/wp-content/uploads/2026/08/COMEX.pdf">– COMÉRCIO EXTERIOR</a></article></body></html>"""


def test_imagens_da_home_sem_logo_e_icones():
    assert imagens(HOME, "https://www.fatecid.com.br/site/") == [
        "https://www.fatecid.com.br/site/wp-content/uploads/2026/10/SITE-4.png",
        "https://www.fatecid.com.br/site/wp-content/uploads/2026/10/Comunicado-importante-726x1024.png",
    ]


def test_links_de_pdf_so_do_conteudo():
    links = links_de_documento(GRADE, "https://www.fatecid.com.br/site/index.php/grade-de-horarios-e-salas/")
    assert [l.url.rsplit("/", 1)[-1] for l in links] == ["ADS_NOT.pdf", "COMEX.pdf"]
    assert "ANÁLISE" in links[0].texto


def _coletor(rotas):
    def responder(req: httpx.Request):
        status, tipo, corpo = rotas.get(req.url.path, (404, "text/html", "<h1>Página não encontrada!!!</h1>"))
        return httpx.Response(status, headers={"content-type": tipo}, content=corpo)
    return Coletor("Teste/1.0", pausa_host_s=0, transporte=httpx.MockTransport(responder))


def test_robots_404_em_html_libera():
    c = _coletor({"/site/": (200, "text/html", HOME)})
    assert c.baixar("https://www.fatecid.com.br/site/").status == 200


def test_robots_que_proibe():
    c = _coletor({"/robots.txt": (200, "text/plain", "User-agent: *\nDisallow: /site/\n"),
                  "/site/": (200, "text/html", HOME)})
    with pytest.raises(ColetaRecusada, match="robots"):
        c.baixar("https://www.fatecid.com.br/site/")


def test_site_recusa_com_403():
    c = _coletor({"/site/": (403, "text/html", "proibido")})
    with pytest.raises(ColetaRecusada, match="403"):
        c.baixar("https://www.fatecid.com.br/site/")
