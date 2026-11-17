"""Decide o que fazer com o que o Archie leu: publicar sozinho, publicar como provável ou pedir curadoria.

Regras (iguais às da documentação do projeto):
- confiança ≥ alta (0,85) → publica como Oficial, com a fonte;
- confiança ≥ média (0,6) → publica como Provável e abre um item na curadoria;
- abaixo disso → não publica; só o item na curadoria.
- Evento manual, do professor ou da turma nunca é alterado; a versão pessoal do aluno (evento_override) também não.
- Sumiu do documento → nunca cancela sozinho: vai para a curadoria.
- O mesmo item (mesma assinatura) não é proposto de novo, nem se o admin já recusou.
"""

from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from archie.config import Config
from archie.extratores.eventos import EventoLido
from archie.extratores.grade import AulaGrade, Grade
from archie.texto import bonito, compacto, hash_de, mesmo_nome, normalizar, palavras, sigla_de, similaridade

log = logging.getLogger(__name__)
DA_ARCHIE = ("archie", "importado")


@dataclass
class Resultado:
    publicados: int = 0
    provaveis: int = 0
    mudancas: int = 0
    pendentes: int = 0
    ignorados: int = 0
    iguais: int = 0
    notas: list[str] = field(default_factory=list)

    def resumo(self) -> str:
        partes = [f"{n} {t}" for n, t in [(self.publicados, "publicados"), (self.mudancas, "atualizados"),
                                           (self.provaveis, "prováveis"), (self.pendentes, "para revisar"),
                                           (self.iguais, "sem mudança")] if n]
        return ", ".join(partes) or "nada novo"

    @property
    def itens(self) -> int:
        return self.publicados + self.provaveis + self.mudancas + self.pendentes + self.iguais


def _assinatura(*partes) -> str:
    return hash_de(json.dumps(partes, sort_keys=True, default=str))[:32]


def _ddmm(d: date) -> str:
    return d.strftime("%d/%m")


class Publicador:
    def __init__(self, banco, cfg: Config, fonte: dict, captura_id: int | None):
        self.banco = banco
        self.cfg = cfg
        self.fonte = fonte
        self.tenant_id = str(fonte["tenant_id"])
        self.captura_id = captura_id
        self.fuso = ZoneInfo(cfg.fuso)
        self.r = Resultado()

    # ------------------------------------------------------------------ util
    def _curadoria(self, tipo: str, dados: dict, resumo: str, confianca: float, aplicar: bool,
                   item_id: str | None = None, motivo: str | None = None) -> str | None:
        """Cria o item; aplica na hora se for o caso. Devolve o id aplicado (ou None)."""
        if self.banco.assinatura_existe(dados["assinatura"]):
            return None
        cid = self.banco.criar_curadoria(self.tenant_id, tipo, dados, resumo, confianca, str(self.fonte["id"]),
                                         self.captura_id, item_id=item_id, motivo=motivo)
        if aplicar:
            alvo = self.banco.aplicar_curadoria(cid)
            return str(alvo) if alvo else None
        return None

    def _quando(self, d: date, hora: str | None, fim_do_dia: bool = False) -> datetime:
        if hora:
            h, m = hora.split(":")
            t = time(int(h), int(m))
        else:
            t = time(23, 59) if fim_do_dia else time(0, 0)
        return datetime.combine(d, t, self.fuso)

    def _dia_local(self, ts: datetime) -> date:
        return ts.astimezone(self.fuso).date()

    # ------------------------------------------------------------------ cursos
    def escopos(self, e: EventoLido, cursos: list[dict]) -> list[tuple[str, str | None]]:
        """[] = evento de outro curso (não interessa a este tenant)."""
        if not e.cursos:
            return [("unidade", None)]
        achados = []
        for nome in e.cursos:
            for c in cursos:
                n, nc = normalizar(nome), normalizar(c["nome"])
                if compacto(nome) == compacto(c["sigla"]) or n == nc or (len(n) > 4 and (n in nc or nc in n)) \
                        or mesmo_nome(nome, c["nome"], c["sigla"]):
                    achados.append(("curso", str(c["id"])))
        return sorted(set(achados))

    # ------------------------------------------------------------------ eventos
    def eventos(self, lidos: list[EventoLido], cursos: list[dict], cobertura: tuple[date, date] | None) -> Resultado:
        alvos: list[tuple[EventoLido, str, str | None]] = []
        for e in lidos:
            escopos = self.escopos(e, cursos)
            if not escopos:
                self.r.ignorados += 1
                continue
            alvos += [(e, esc, esc_id) for esc, esc_id in escopos]
        if not alvos:
            return self.r

        datas = [e.inicio for e, _, _ in alvos]
        janela_ini = self._quando(min(datas) - timedelta(days=60), None)
        janela_fim = self._quando(max(datas) + timedelta(days=60), None, fim_do_dia=True)
        existentes = [x for x in self.banco.eventos_oficiais(self.tenant_id, janela_ini, janela_fim)
                      if not x["cancelado"]]
        usados: set[str] = set()
        mesmo_escopo = lambda x, esc, esc_id: (x["escopo"] == esc and  # noqa: E731
                                               (str(x["escopo_id"]) if x["escopo_id"] else None) == esc_id)

        # 1ª passada: mesmo dia e título parecido = é o mesmo evento (melhores pares primeiro).
        pares = []
        for n, (e, esc, esc_id) in enumerate(alvos):
            for x in existentes:
                if mesmo_escopo(x, esc, esc_id) and self._dia_local(x["inicio"]) == e.inicio:
                    sim = similaridade(e.titulo, x["titulo"])
                    if sim >= 0.6 or (sim >= 0.45 and x["tipo"] == e.tipo):
                        pares.append((-sim, n, x))
        resolvidos: set[int] = set()
        for _, n, x in sorted(pares, key=lambda p: (p[0], p[1])):
            if n in resolvidos or str(x["id"]) in usados:
                continue
            resolvidos.add(n)
            usados.add(str(x["id"]))
            e = alvos[n][0]
            fim_velho = x["fim"]
            if x["origem"] in DA_ARCHIE and e.fim and (fim_velho is None or self._dia_local(fim_velho) != e.fim):
                fim_novo = self._quando(e.fim, e.hora_fim, fim_do_dia=True)
                self._mudanca(x, e, {"fim": fim_novo.isoformat()}, f"termina em {_ddmm(e.fim)}")
            else:
                self.r.iguais += 1

        # 2ª passada: mesmo título, outra data (até 45 dias) = a data mudou. Desempate: mesmo tipo, data mais perto.
        pares = []
        for n, (e, esc, esc_id) in enumerate(alvos):
            if n in resolvidos:
                continue
            for x in existentes:
                if (str(x["id"]) in usados or x["origem"] not in DA_ARCHIE or not mesmo_escopo(x, esc, esc_id)):
                    continue
                dias = abs((self._dia_local(x["inicio"]) - e.inicio).days)
                sim = similaridade(e.titulo, x["titulo"])
                if dias <= 45 and sim >= 0.85:
                    pares.append((-sim, x["tipo"] != e.tipo, dias, n, x))
        for _, _, _, n, x in sorted(pares, key=lambda p: p[:4]):
            if n in resolvidos or str(x["id"]) in usados:
                continue
            resolvidos.add(n)
            usados.add(str(x["id"]))
            e = alvos[n][0]
            campos = {"inicio": self._quando(e.inicio, e.hora_inicio).isoformat(),
                      "fim": self._quando(e.fim, e.hora_fim, True).isoformat() if e.fim else None,
                      "dia_todo": e.dia_todo}
            quando = _ddmm(e.inicio) + (f" a {_ddmm(e.fim)}" if e.fim else "")
            self._mudanca(x, e, campos, f"agora em {quando}")

        # O resto é novo.
        for n, (e, esc, esc_id) in enumerate(alvos):
            if n not in resolvidos:
                self._novo(e, esc, esc_id)

        # O que era deste documento e não aparece mais.
        if cobertura:
            de, ate = cobertura
            for x in existentes:
                if (str(x["id"]) in usados or x["origem"] not in DA_ARCHIE
                        or str(x.get("fonte_id") or "") != str(self.fonte["id"])
                        or not de <= self._dia_local(x["inicio"]) <= ate):
                    continue
                if self.banco.pendente_do_item(str(x["id"]), "evento_sumiu"):
                    continue
                dados = {"assinatura": _assinatura("evento_sumiu", str(x["id"]), self.captura_id)}
                if self._curadoria("evento_sumiu", dados, f"Não aparece mais: {x['titulo']} · "
                                   f"{_ddmm(self._dia_local(x['inicio']))}", 0.5, aplicar=False,
                                   item_id=str(x["id"]), motivo="não está na nova versão do documento") is None:
                    self.r.pendentes += 1
        return self.r

    def _mudanca(self, x: dict, e: EventoLido, campos: dict, como: str) -> None:
        dados = {"campos": campos, "documento_url": e.documento_url, "trecho": e.trecho,
                 "assinatura": _assinatura("evento_mudanca", str(x["id"]), campos)}
        resumo = f"{x['titulo']}: {como}"
        auto = e.confianca >= self.cfg.conf_alta and x["origem"] in DA_ARCHIE
        if self.banco.assinatura_existe(dados["assinatura"]):
            return
        self._curadoria("evento_mudanca", dados, resumo, e.confianca, aplicar=auto, item_id=str(x["id"]),
                        motivo=None if auto else "confiança abaixo do limite")
        if auto:
            self.r.mudancas += 1
        else:
            self.r.pendentes += 1

    def _novo(self, e: EventoLido, esc: str, esc_id: str | None) -> None:
        inicio = self._quando(e.inicio, e.hora_inicio)
        fim = self._quando(e.fim, e.hora_fim, True) if e.fim else (
            self._quando(e.inicio, e.hora_fim) if e.hora_fim else None)
        evento = {"escopo": esc, "escopo_id": esc_id, "titulo": e.titulo, "tipo": e.tipo,
                  "inicio": inicio.isoformat(), "fim": fim.isoformat() if fim else None, "dia_todo": e.dia_todo,
                  "documento_url": e.documento_url, "descricao": e.trecho}
        base = {"trecho": e.trecho,
                "assinatura": _assinatura("evento_novo", esc, esc_id, normalizar(e.titulo), e.inicio, e.fim)}
        quando = _ddmm(e.inicio) + (f" a {_ddmm(e.fim)}" if e.fim else "")
        resumo = f"{e.titulo} · {quando}"
        if self.banco.assinatura_existe(base["assinatura"]):
            return
        if e.confianca >= self.cfg.conf_alta:
            self._curadoria("evento_novo", {**base, "evento": {**evento, "status": "oficial"}}, resumo, e.confianca,
                            aplicar=True)
            self.r.publicados += 1
        elif e.confianca >= self.cfg.conf_media:
            evento_id = self._curadoria("evento_novo", {**base, "evento": {**evento, "status": "provavel"}}, resumo,
                                        e.confianca, aplicar=True)
            if evento_id:
                self._curadoria("evento_provavel", {"assinatura": _assinatura("evento_provavel", evento_id)}, resumo,
                                e.confianca, aplicar=False, item_id=evento_id, motivo="publicado como provável")
            self.r.provaveis += 1
        else:
            self._curadoria("evento_novo", {**base, "evento": {**evento, "status": "oficial"}}, resumo, e.confianca,
                            aplicar=False, motivo="confiança baixa")
            self.r.pendentes += 1

    # ------------------------------------------------------------------ grade
    def grade(self, g: Grade, cursos: list[dict], periodo_atual: str) -> Resultado:
        curso = next((c for c in cursos if g.curso and (normalizar(c["nome"]) in normalizar(g.curso)
                                                        or normalizar(g.curso) in normalizar(c["nome"]))), None)
        if not curso:
            self.r.notas.append(f"curso fora deste tenant: {g.curso}")
            return self.r
        if g.periodo != periodo_atual:
            self.r.notas.append(f"grade de {g.periodo}; o período atual é {periodo_atual} (fica para a virada)")
            return self.r
        if not g.turno:
            self.r.notas.append("turno não encontrado no PDF")
            return self.r

        disciplinas = self.banco.disciplinas(str(curso["id"]))
        turmas = self.banco.turmas_com_aulas(str(curso["id"]), g.periodo, g.turno)
        grupos: dict[tuple[int, str], list[AulaGrade]] = defaultdict(list)
        for a in g.aulas:
            grupos[(a.semestre, normalizar(a.disciplina))].append(a)

        for (sem, _), aulas in sorted(grupos.items()):
            nome_pdf = aulas[0].disciplina
            professor = Counter(a.professor for a in aulas if a.professor).most_common(1)
            professor = professor[0][0] if professor else None
            novas = [{"dia_semana": a.dia_semana, "inicio": a.inicio, "fim": a.fim, "sala": a.sala}
                     for a in sorted(aulas, key=lambda a: (a.dia_semana, a.inicio))]
            disc = next((d for d in disciplinas if d["semestre_matriz"] == sem
                         and mesmo_nome(nome_pdf, d["nome"], d["sigla"])), None) or \
                next((d for d in disciplinas if mesmo_nome(nome_pdf, d["nome"], d["sigla"])), None)
            turma = next((t for t in turmas if disc and t["disciplina_id"] == disc["id"]), None)

            if turma:
                velhas = [{k: a[k] for k in ("dia_semana", "inicio", "fim", "sala")} for a in turma["aulas"]]
                mesmo_prof = _mesmo_professor(professor, turma["professor_nome"])
                if velhas == novas and (mesmo_prof or not professor):
                    self.r.iguais += 1
                    continue
                dados = {"aulas": novas, "professor_nome": professor or turma["professor_nome"],
                         "disciplina_nome": disc["nome"], "nome_no_pdf": nome_pdf,
                         "antes": {"aulas": velhas, "professor_nome": turma["professor_nome"]},
                         "assinatura": _assinatura("grade_turma", str(turma["id"]), novas, professor)}
                resumo = f"Horário de {disc['nome']}: " + "; ".join(_aula_txt(a) for a in novas)
                auto = g.confianca >= self.cfg.conf_alta
                if self.banco.assinatura_existe(dados["assinatura"]):
                    continue
                self._curadoria("grade_turma", dados, resumo, g.confianca, aplicar=auto, item_id=str(turma["id"]),
                                motivo=None if auto else "leitura da grade com confiança baixa")
                if auto:
                    self.r.mudancas += 1
                else:
                    self.r.pendentes += 1
                continue

            # Turma nova: a disciplina pode já existir (só falta a turma do período) ou ser nova de verdade.
            nome_bonito = bonito(nome_pdf)
            disciplina = {"id": str(disc["id"])} if disc else {
                "curso_id": str(curso["id"]), "nome": nome_bonito, "semestre_matriz": sem,
                "sigla": nome_pdf.rstrip(".") if ("." in nome_pdf or len(nome_pdf) <= 6) else sigla_de(nome_pdf).upper()[:6]}
            dados = {"disciplina": disciplina,
                     "turma": {"periodo_letivo": g.periodo, "turno": g.turno, "professor_nome": professor},
                     "aulas": novas, "nome_no_pdf": nome_pdf,
                     "assinatura": _assinatura("disciplina_nova", str(curso["id"]), sem, normalizar(nome_pdf),
                                               g.periodo, g.turno)}
            resumo = (f"{'Turma nova' if disc else 'Disciplina nova'}: {disc['nome'] if disc else nome_bonito} "
                      f"({sem}º sem.) · " + "; ".join(_aula_txt(a) for a in novas))
            auto = g.confianca >= self.cfg.conf_alta and (disc is not None or self.cfg.auto_estrutura)
            if self.banco.assinatura_existe(dados["assinatura"]):
                continue
            self._curadoria("disciplina_nova", dados, resumo, g.confianca, aplicar=auto,
                            motivo=None if auto else "estrutura nova: confira o nome antes de aprovar")
            if auto:
                self.r.publicados += 1
            else:
                self.r.pendentes += 1
        return self.r


DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]


def _aula_txt(a: dict) -> str:
    return f"{DIAS_CURTOS[a['dia_semana']]} {a['inicio']}–{a['fim']}" + (f" ({a['sala']})" if a.get("sala") else "")


def _mesmo_professor(a: str | None, b: str | None) -> bool:
    """'Sérgio Furgeri' x 'Prof. Furgeri' = mesmo; ignora 'Prof./Profa.' e acentos."""
    pa = {p for p in palavras(a) if p not in {"prof", "profa", "professor", "professora"}}
    pb = {p for p in palavras(b) if p not in {"prof", "profa", "professor", "professora"}}
    if not pa or not pb:
        return not pa and not pb
    return pa <= pb or pb <= pa
