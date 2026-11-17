"""Avisos em imagem (banners e "comunicado importante" da página inicial): a IA lê a imagem."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from archie.extratores.eventos import EventoLido, validar_eventos

ESQUEMA = {
    "type": "object",
    "properties": {
        "para_alunos": {"type": "boolean", "description": "o aviso interessa aos alunos da faculdade?"},
        "titulo": {"type": "string"},
        "resumo": {"type": "string", "description": "o que o aviso diz, em até 3 frases"},
        "eventos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string"},
                    "tipo": {"type": "string", "enum": ["prova", "entrega", "apresentacao", "aula", "reuniao",
                                                         "data_especial", "outro"]},
                    "inicio": {"type": "string", "description": "AAAA-MM-DD"},
                    "fim": {"type": ["string", "null"]},
                    "hora_inicio": {"type": ["string", "null"], "description": "HH:MM ou null"},
                    "hora_fim": {"type": ["string", "null"]},
                    "sem_aula": {"type": "boolean"},
                    "cursos": {"type": "array", "items": {"type": "string"}},
                    "trecho": {"type": "string"},
                    "confianca": {"type": "number"},
                },
                "required": ["titulo", "tipo", "inicio", "fim", "hora_inicio", "hora_fim", "sem_aula", "cursos",
                             "trecho", "confianca"],
            },
        },
        "confianca": {"type": "number"},
    },
    "required": ["para_alunos", "titulo", "resumo", "eventos", "confianca"],
}

PROMPT = """Esta imagem está publicada na página inicial do site da {unidade}. Hoje é {hoje}.
1. Diga se é um aviso que interessa aos alunos (aulas, provas, prazos, eventos, secretaria, vestibular).
   Propaganda de empresa, vaga de emprego e foto decorativa não contam.
2. Resuma o aviso em português simples.
3. Liste as datas que aparecem (com ano; se a imagem não diz o ano, use o mais próximo de hoje).
   Feriado ou dia sem aula: sem_aula true. Horário só quando estiver escrito.
Não invente nada que não esteja na imagem."""


@dataclass
class Aviso:
    url: str
    para_alunos: bool
    titulo: str
    resumo: str
    eventos: list[EventoLido] = field(default_factory=list)
    confianca: float = 0.0
    problemas: list[str] = field(default_factory=list)


def ler(imagem: bytes, url: str, ia, unidade: str, hoje: date) -> Aviso:
    resp = ia.json(PROMPT.format(unidade=unidade, hoje=hoje.strftime("%d/%m/%Y")), ESQUEMA, imagens=[imagem],
                   visao=True)
    # Imagem nunca publica sozinha como oficial: no máximo "provável", e o admin confere.
    eventos, problemas = validar_eventos(resp.get("eventos", []), ano=hoje.year, documento_url=url,
                                         teto_confianca=0.8)
    return Aviso(url=url, para_alunos=bool(resp.get("para_alunos")), titulo=str(resp.get("titulo") or "")[:140],
                 resumo=str(resp.get("resumo") or ""), eventos=eventos if resp.get("para_alunos") else [],
                 confianca=min(float(resp.get("confianca") or 0.5), 0.8), problemas=problemas)
