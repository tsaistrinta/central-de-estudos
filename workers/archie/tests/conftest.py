import os
from pathlib import Path

import pymupdf
import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def pdf_de_posicoes(nome: str, largura: float = 841.92, altura: float = 595.32) -> bytes:
    """Recria um PDF com os textos nas mesmas posições do original (tsv: x, y, texto)."""
    doc = pymupdf.open()
    pagina = doc.new_page(width=largura, height=altura)
    for linha in (FIXTURES / nome).read_text(encoding="utf-8").splitlines():
        if not linha.strip() or linha.startswith("#"):
            continue
        x, y, texto = linha.split("\t")
        vertical = texto.endswith(("FEIRA", "FERIA", "SÁBADO"))
        pagina.insert_text((float(x), float(y)), texto, fontsize=5, fontname="helv", rotate=90 if vertical else 0)
    return doc.tobytes()


@pytest.fixture
def pdf_grade_ads() -> bytes:
    return pdf_de_posicoes("grade_ads_noturno_2026_2.tsv")


@pytest.fixture
def banco_url():
    url = os.environ.get("ARCHIE_TESTE_DB")
    if not url:
        pytest.skip("defina ARCHIE_TESTE_DB (veja tests/sql/montar_banco.sh)")
    return url
