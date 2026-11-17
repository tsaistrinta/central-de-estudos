"""Configuração por variáveis de ambiente (ou um arquivo .env ao lado do worker)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path


def carregar_env(caminho: Path) -> None:
    """Lê KEY=valor de um .env sem sobrescrever o que já está no ambiente."""
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def _bool(nome: str, padrao: bool) -> bool:
    v = os.environ.get(nome)
    return padrao if v is None else v.strip().lower() in {"1", "true", "sim", "yes", "on"}


@dataclass
class Config:
    database_url: str | None
    ollama_url: str
    modelo: str  # texto + imagem
    modelo_embed: str
    user_agent: str
    worker: str
    intervalo_s: int  # de quanto em quanto tempo olha a fila e as fontes vencidas
    pausa_host_s: float  # espera mínima entre dois pedidos ao mesmo site
    conf_alta: float  # a partir daqui publica sozinho como oficial
    conf_media: float  # a partir daqui publica como provável + curadoria
    auto_estrutura: bool  # criar disciplinas/turmas novas sem passar pelo admin
    conhecimento: bool  # guardar trechos com embedding para a busca (RAG)
    fuso: str
    max_bytes: int

    @classmethod
    def do_ambiente(cls) -> "Config":
        carregar_env(Path.cwd() / ".env")
        carregar_env(Path(__file__).resolve().parent.parent / ".env")
        e = os.environ.get
        return cls(
            database_url=e("DATABASE_URL"),
            ollama_url=e("OLLAMA_URL", "http://localhost:11434").rstrip("/"),
            modelo=e("ARCHIE_MODELO", "qwen3.5:9b"),
            modelo_embed=e("ARCHIE_MODELO_EMBED", "qwen3-embedding:0.6b"),
            user_agent=e("ARCHIE_USER_AGENT",
                         "CentralDeEstudos-Archie/0.1 (+https://github.com/tsaistrinta/central-de-estudos)"),
            worker=e("ARCHIE_WORKER", socket.gethostname()),
            intervalo_s=int(e("ARCHIE_INTERVALO_S", "60")),
            pausa_host_s=float(e("ARCHIE_PAUSA_HOST_S", "5")),
            conf_alta=float(e("ARCHIE_CONF_ALTA", "0.85")),
            conf_media=float(e("ARCHIE_CONF_MEDIA", "0.6")),
            auto_estrutura=_bool("ARCHIE_AUTO_ESTRUTURA", False),
            conhecimento=_bool("ARCHIE_CONHECIMENTO", True),
            fuso=e("ARCHIE_FUSO", "America/Sao_Paulo"),
            max_bytes=int(e("ARCHIE_MAX_MB", "25")) * 1024 * 1024,
        )
