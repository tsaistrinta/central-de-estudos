"""Conversa com o Ollama local: respostas em JSON (com esquema), imagens e embeddings."""

from __future__ import annotations

import base64
import json
import logging

import httpx

log = logging.getLogger(__name__)

SISTEMA = (
    "Você é o Archie, assistente da Central de Estudos da Fatec Indaiatuba (nome em homenagem ao Dr. Archimedes "
    "Lammoglia). Você só trata da vida acadêmica na Fatec: aulas, horários, salas, professores, calendário, provas, "
    "entregas, notas e faltas do próprio aluno, regulamento, secretaria, PTG, estágio, monitoria, editais e o conteúdo "
    "das disciplinas a partir dos materiais da turma. Qualquer outro assunto você recusa em uma frase. "
    "Extrai informações de documentos oficiais com cuidado: não inventa datas, não completa o que não está escrito, "
    "diz quando não sabe e responde só o JSON pedido, em português do Brasil. "
    "LGPD: nunca registre dados pessoais de terceiros (telefones, e-mails, CPF, RA, nomes de alunos) nas respostas; "
    "o nome de professores só quando estiver em documento público da Fatec. Nunca peça a senha do SIGA."
)


class IAIndisponivel(RuntimeError):
    pass


class Ollama:
    def __init__(self, url: str, modelo: str, modelo_embed: str, timeout: float = 600):
        self.url = url
        self.modelo = modelo
        self.modelo_embed = modelo_embed
        self.http = httpx.Client(timeout=timeout)

    def modelos(self) -> list[str]:
        try:
            r = self.http.get(f"{self.url}/api/tags", timeout=10)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise IAIndisponivel(f"Ollama não respondeu em {self.url}: {e}") from e
        return [m["name"] for m in r.json().get("models", [])]

    def json(self, prompt: str, esquema: dict, imagens: list[bytes] | None = None, visao: bool = False,
             sistema: str = SISTEMA, contexto: int = 16384) -> dict:
        """Pede uma resposta que siga o esquema JSON (structured outputs do Ollama)."""
        mensagem: dict = {"role": "user", "content": prompt}
        if imagens:
            mensagem["images"] = [base64.b64encode(i).decode() for i in imagens]
        corpo = {
            "model": self.modelo,
            "messages": [{"role": "system", "content": sistema}, mensagem],
            "format": esquema,
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_ctx": contexto},
        }
        for tentativa in range(2):
            try:
                r = self.http.post(f"{self.url}/api/chat", json=corpo)
                r.raise_for_status()
            except httpx.HTTPError as e:
                raise IAIndisponivel(f"falha ao chamar o modelo {self.modelo}: {e}") from e
            texto = r.json().get("message", {}).get("content", "")
            try:
                return json.loads(texto)
            except json.JSONDecodeError:
                log.warning("resposta fora do JSON (tentativa %s): %.200s", tentativa + 1, texto)
        raise ValueError("o modelo não devolveu JSON válido")

    def embed(self, textos: list[str]) -> list[list[float]]:
        if not textos:
            return []
        try:
            r = self.http.post(f"{self.url}/api/embed", json={"model": self.modelo_embed, "input": textos})
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise IAIndisponivel(f"falha no modelo de embedding {self.modelo_embed}: {e}") from e
        return r.json()["embeddings"]
