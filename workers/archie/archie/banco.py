"""Acesso ao Postgres do Supabase (conexão direta do worker; nunca vai para o navegador)."""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from archie import __version__


class Banco:
    def __init__(self, url: str):
        self.url = url
        self.con = psycopg.connect(url, row_factory=dict_row, autocommit=True, prepare_threshold=None)
        self._tipo_embedding: str | None = None

    def fechar(self) -> None:
        self.con.close()

    @contextmanager
    def transacao(self) -> Iterator[None]:
        with self.con.transaction():
            yield

    def _todos(self, sql: str, *args: Any) -> list[dict]:
        with self.con.cursor() as cur:
            cur.execute(sql, args)
            return cur.fetchall() if cur.description else []

    def _um(self, sql: str, *args: Any) -> dict | None:
        linhas = self._todos(sql, *args)
        return linhas[0] if linhas else None

    # ---------------- fontes e capturas ----------------
    def fontes_vencidas(self) -> list[dict]:
        return self._todos("""
            select * from fontes
            where status <> 'pausada'
              and (ultima_verificacao is null
                   or ultima_verificacao + make_interval(mins => frequencia_min) <= now())
            order by ultima_verificacao nulls first""")

    def fonte(self, chave: str) -> dict | None:
        return self._um("select * from fontes where id::text = %s or nome ilike %s order by nome limit 1",
                        chave, f"%{chave}%")

    def marcar_visita(self, fonte_id: str, hash_pagina: str | None = None, erro: str | None = None) -> None:
        self._todos("""
            update fontes set ultima_verificacao = now(),
                              ultimo_hash = coalesce(%s, ultimo_hash),
                              ultimo_erro = %s,
                              status = case when status = 'pausada' then status
                                            when %s::text is null then 'ativa' else 'erro' end
            where id = %s""", hash_pagina, erro, erro, fonte_id)

    def ultimo_hash_documento(self, fonte_id: str, url: str) -> str | None:
        r = self._um("""select hash from capturas where fonte_id = %s and conteudo_url = %s and erro is null
                        order by capturado_em desc limit 1""", fonte_id, url)
        return r["hash"] if r else None

    def registrar_captura(self, fonte_id: str, hash_: str, url: str, titulo: str | None = None, itens: int = 0,
                          erro: str | None = None, mudou: bool = True) -> int:
        return self._um("""insert into capturas (fonte_id, hash, conteudo_url, titulo, itens, erro, mudou)
                           values (%s, %s, %s, %s, %s, %s, %s) returning id""",
                        fonte_id, hash_, url, titulo, itens, erro, mudou)["id"]

    # ---------------- estrutura acadêmica ----------------
    def tenant(self, tenant_id: str) -> dict:
        return self._um("select * from tenants where id = %s", tenant_id)

    def cursos(self, tenant_id: str) -> list[dict]:
        return self._todos("select * from cursos where tenant_id = %s", tenant_id)

    def disciplinas(self, curso_id: str) -> list[dict]:
        return self._todos("select * from disciplinas where curso_id = %s", curso_id)

    def turmas_com_aulas(self, curso_id: str, periodo: str, turno: str) -> list[dict]:
        return self._todos("""
            select t.*, d.nome as disciplina_nome, d.sigla as disciplina_sigla, d.semestre_matriz,
                   coalesce((select jsonb_agg(jsonb_build_object(
                       'dia_semana', a.dia_semana, 'inicio', to_char(a.inicio, 'HH24:MI'),
                       'fim', to_char(a.fim, 'HH24:MI'), 'sala', a.sala) order by a.dia_semana, a.inicio)
                     from aulas_horario a where a.turma_id = t.id), '[]') as aulas
            from turmas t join disciplinas d on d.id = t.disciplina_id
            where d.curso_id = %s and t.periodo_letivo = %s and t.turno = %s""", curso_id, periodo, turno)

    # ---------------- eventos ----------------
    def eventos_oficiais(self, tenant_id: str, de: datetime, ate: datetime) -> list[dict]:
        """Eventos da unidade/curso no intervalo (os que o Archie pode comparar com o documento)."""
        return self._todos("""
            select id, escopo, escopo_id, titulo, tipo, inicio, fim, dia_todo, origem, status, cancelado, fonte_id,
                   documento_url
            from eventos
            where tenant_id = %s and escopo in ('unidade', 'curso') and inicio >= %s and inicio <= %s
            order by inicio""", tenant_id, de, ate)

    # ---------------- curadoria ----------------
    def assinatura_existe(self, assinatura: str) -> bool:
        """Já criei este mesmo item antes (pendente, aplicado ou recusado pelo admin)?"""
        return self._um("select 1 as x from curadoria where dados ->> 'assinatura' = %s limit 1", assinatura) is not None

    def pendente_do_item(self, item_id: str, tipo: str) -> bool:
        return self._um("""select 1 as x from curadoria where item_id = %s and item_tipo = %s and decisao is null
                           limit 1""", item_id, tipo) is not None

    def criar_curadoria(self, tenant_id: str, tipo: str, dados: dict, resumo: str, confianca: float,
                        fonte_id: str | None, captura_id: int | None, item_id: str | None = None,
                        motivo: str | None = None) -> str:
        return self._um("""
            insert into curadoria (tenant_id, item_tipo, item_id, dados, motivo, resumo, confianca, fonte_id, captura_id)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
                        tenant_id, tipo, item_id, Jsonb(dados), motivo, resumo, round(confianca, 2), fonte_id,
                        captura_id)["id"]

    def aplicar_curadoria(self, curadoria_id: str) -> str | None:
        r = self._um("select public.aplicar_curadoria(%s) as id", curadoria_id)
        return r["id"] if r else None

    # ---------------- conhecimento (RAG) ----------------
    def _tipo_do_embedding(self) -> str:
        if self._tipo_embedding is None:
            r = self._um("""select format_type(atttypid, atttypmod) as t from pg_attribute
                            where attrelid = 'public.conhecimento_trechos'::regclass and attname = 'embedding'""")
            self._tipo_embedding = r["t"] if r else "real[]"
        return self._tipo_embedding

    def trocar_trechos(self, tenant_id: str, fonte_id: str, captura_id: int, url: str,
                       trechos: list[str], embeddings: list[list[float]] | None, metadados: dict) -> int:
        self._todos("delete from conhecimento_trechos where fonte_id = %s and metadados ->> 'url' = %s", fonte_id, url)
        vetor = "vector" in self._tipo_do_embedding()
        for i, t in enumerate(trechos):
            emb = embeddings[i] if embeddings else None
            valor = (json.dumps(emb) if vetor else emb) if emb else None
            self._todos(f"""insert into conhecimento_trechos (tenant_id, fonte_id, captura_id, texto, embedding, metadados)
                            values (%s, %s, %s, %s, %s{'::extensions.vector' if vetor else ''}, %s)""",
                        tenant_id, fonte_id, captura_id, t, valor, Jsonb({**metadados, "url": url, "parte": i}))
        return len(trechos)

    # ---------------- acervo (moderação) ----------------
    def item_acervo(self, item_id: str) -> dict | None:
        return self._um("""select i.id::text as id, i.status, i.tipo, i.titulo, i.descricao, i.link_url, i.arquivo_chave,
                                  i.arquivo_nome, i.arquivo_mime, d.nome as disciplina
                           from acervo_itens i join disciplinas d on d.id = i.disciplina_id where i.id = %s""", item_id)

    def moderar_acervo(self, item_id: str, publicar: bool, moderacao: dict) -> None:
        self._todos("select public.archie_moderar(%s, %s, %s)", item_id, publicar, Jsonb(moderacao))

    def acervo_em_analise(self, limite: int = 20) -> list[dict]:
        """Envios que ficaram sem tarefa na fila (ex.: worker desligado por dias e a tarefa expirou)."""
        return self._todos("""select id::text as id from acervo_itens where status = 'em_analise'
                              and criado_em < now() - interval '30 minutes' order by criado_em limit %s""", limite)

    # ---------------- fila e sinal de vida ----------------
    def ler_fila(self, segundos: int = 900) -> dict | None:
        return self._um("select msg_id, read_ct, message from pgmq.read('archie_jobs', %s, 1)", segundos)

    def apagar_da_fila(self, msg_id: int) -> None:
        self._todos("select pgmq.delete('archie_jobs', %s::bigint)", msg_id)

    def sinal(self, worker: str, tarefa: str | None, modelos: dict, iniciado_em: datetime,
              processadas: int = 0, erros: int = 0, ultimo_erro: str | None = None) -> None:
        self._todos("""
            insert into archie_status (worker, versao, modelos, iniciado_em, ultimo_sinal, tarefa_atual,
                                     processadas, erros, ultimo_erro, tenant_id)
            values (%s, %s, %s, %s, now(), %s, %s, %s, %s, (select id from tenants order by criado_em limit 1))
            on conflict (worker) do update set versao = excluded.versao, modelos = excluded.modelos,
              iniciado_em = excluded.iniciado_em, ultimo_sinal = now(), tarefa_atual = excluded.tarefa_atual,
              processadas = excluded.processadas, erros = excluded.erros,
              ultimo_erro = coalesce(excluded.ultimo_erro, archie_status.ultimo_erro)""",
                    worker, __version__, Jsonb(modelos), iniciado_em, tarefa, processadas, erros, ultimo_erro)
