"""Moderação do acervo público: todo envio passa por aqui antes de aparecer para a turma.

Ordem das verificações (a primeira que reprova manda para a quarentena):
  1. tipo real do arquivo pelos primeiros bytes (não pela extensão) e tamanho;
  2. código embutido: macro VBA em Office, JavaScript/ações em PDF, zip-bomba;
  3. antivírus (ClamAV), se estiver instalado no PC;
  4. dados pessoais de terceiros no texto (CPF válido, telefones, e-mails pessoais);
  5. o modelo local olha título, descrição, texto e imagem e diz se é material acadêmico adequado.

Nada sai do PC: o arquivo é baixado do armazenamento, verificado na memória e descartado.
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
import shutil
import subprocess
import zipfile
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import httpx

from archie.ia import IAIndisponivel, Ollama

log = logging.getLogger("archie.moderacao")

LIMITE_BYTES = 25 * 1024 * 1024
CONF_MINIMA = 0.6

SISTEMA_MODERACAO = (
    "Você é o Archie, moderador do acervo acadêmico da Central de Estudos da Fatec Indaiatuba. Alunos compartilham "
    "provas antigas, resumos, listas, slides e trabalhos das disciplinas para as próximas turmas. Sua tarefa é decidir "
    "se o envio pode ficar público para os alunos da disciplina. Reprove quando houver: conteúdo sexual ou nudez; "
    "violência gráfica; ódio, assédio ou ofensa a pessoas; incentivo a crimes, drogas, armas ou fraude (inclusive "
    "venda de trabalhos prontos ou cola de prova em andamento); golpe, phishing ou link malicioso; conteúdo sem relação "
    "com a vida acadêmica. Material de estudo comum (enunciados, resoluções, código-fonte, resumos, slides) é adequado. "
    "Não invente: julgue só o que está escrito ou visível. Responda só o JSON pedido, em português do Brasil."
)

ESQUEMA = {
    "type": "object",
    "properties": {
        "adequado": {"type": "boolean"},
        "categorias": {
            "type": "array",
            "items": {"type": "string", "enum": ["sexual", "violencia", "odio", "ilicito", "malicioso", "fora_do_ambito"]},
        },
        "motivo": {"type": "string"},
        "confianca": {"type": "number"},
    },
    "required": ["adequado", "categorias", "motivo", "confianca"],
}

ENCURTADORES = {"bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "ow.ly", "rebrand.ly", "shorturl.at", "encurtador.com.br"}
EXTENSOES_PERIGOSAS = re.compile(r"\.(exe|msi|bat|cmd|ps1|vbs|js|jar|apk|scr|com|dll|sh|iso|dmg)(\?|$)", re.I)
DOMINIOS_INSTITUCIONAIS = ("cps.sp.gov.br", "fatec.sp.gov.br", "fatecid.com.br", "sp.gov.br")


class SemArmazenamento(RuntimeError):
    """O worker não tem como baixar o arquivo (faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."""


@dataclass
class Resultado:
    publicar: bool
    motivo: str
    categorias: list[str] = field(default_factory=list)
    confianca: float = 1.0
    origem: str = "verificacao"  # verificacao (regras) | archie (modelo)
    tipo_detectado: str | None = None
    sha256: str | None = None
    trecho: str | None = None
    verificacoes: list[str] = field(default_factory=list)
    modelo: str | None = None

    def como_json(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if v not in (None, [], "") and k != "publicar"}
        d["confianca"] = round(self.confianca, 2)
        return d


# ------------------------------------------------------------------ 1. tipo real
def detectar_tipo(dados: bytes) -> str | None:
    """Tipo pelo conteúdo. None = não permitido no acervo."""
    if dados.startswith(b"%PDF-"):
        return "pdf"
    if dados.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if dados.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return "webp"
    if dados.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(dados)) as z:
                nomes = set(z.namelist())
        except zipfile.BadZipFile:
            return None
        if "[Content_Types].xml" in nomes:
            if any(n.startswith("word/") for n in nomes):
                return "docx"
            if any(n.startswith("ppt/") for n in nomes):
                return "pptx"
            if any(n.startswith("xl/") for n in nomes):
                return "xlsx"
        return None  # zip comum não entra (pode esconder qualquer coisa)
    if dados.startswith((b"MZ", b"\x7fELF", b"#!", b"\xca\xfe\xba\xbe")):
        return None
    try:
        texto = dados[:65536].decode("utf-8")
    except UnicodeDecodeError:
        return None
    return "texto" if "\x00" not in texto else None


# ------------------------------------------------------------------ 2. código embutido
PDF_PERIGOSO = re.compile(r"/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData)\b")


def _chaves_perigosas_pdf(dados: bytes) -> set[str]:
    """Procura nos objetos do PDF já descomprimidos (os maliciosos escondem /JS dentro de object streams)."""
    import pymupdf

    achados = set(PDF_PERIGOSO.findall(dados.decode("latin-1")))
    with pymupdf.open(stream=dados, filetype="pdf") as doc:
        if doc.embfile_count():
            achados.add("EmbeddedFile")
        for x in range(1, doc.xref_length()):
            try:
                achados.update(PDF_PERIGOSO.findall(doc.xref_object(x, compressed=False)))
            except Exception:  # objeto quebrado: segue com os outros
                continue
    return achados


def problemas_estruturais(tipo: str, dados: bytes) -> list[str]:
    problemas: list[str] = []
    if tipo == "pdf":
        achados = _chaves_perigosas_pdf(dados)
        if achados:
            problemas.append("PDF com código ou arquivo embutido (" + ", ".join(sorted(achados)) + ")")
    if tipo in {"docx", "pptx", "xlsx"}:
        with zipfile.ZipFile(io.BytesIO(dados)) as z:
            infos = z.infolist()
            nomes = [i.filename.lower() for i in infos]
            if any(n.endswith("vbaproject.bin") for n in nomes):
                problemas.append("documento Office com macro (VBA)")
            if any("activex" in n or n.endswith(".bin") and "embeddings" in n for n in nomes):
                problemas.append("documento Office com objeto embutido (ActiveX/OLE)")
            descomprimido = sum(i.file_size for i in infos)
            if descomprimido > 300 * 1024 * 1024 or (len(dados) and descomprimido / len(dados) > 200):
                problemas.append("arquivo compactado suspeito (zip-bomba)")
    return problemas


# ------------------------------------------------------------------ 3. antivírus
def antivirus(dados: bytes) -> tuple[bool | None, str | None]:
    """(True, assinatura) se o ClamAV achar algo; (False, None) se limpo; (None, None) se não houver ClamAV."""
    exe = shutil.which("clamdscan") or shutil.which("clamscan")
    if not exe:
        return None, None
    try:
        r = subprocess.run([exe, "--no-summary", "-"], input=dados, capture_output=True, timeout=300)
    except (OSError, subprocess.TimeoutExpired) as e:
        log.warning("antivírus não rodou: %s", e)
        return None, None
    if r.returncode == 1:
        achado = r.stdout.decode(errors="replace").strip().split(":")[-1].replace("FOUND", "").strip()
        return True, achado or "assinatura desconhecida"
    return (False, None) if r.returncode == 0 else (None, None)


# ------------------------------------------------------------------ 4. texto e dados pessoais
def extrair_texto(tipo: str, dados: bytes, limite: int = 12000) -> str:
    if tipo == "texto":
        return dados.decode("utf-8", errors="replace")[:limite]
    if tipo == "pdf":
        import pymupdf

        with pymupdf.open(stream=dados, filetype="pdf") as doc:
            partes = []
            for i, pag in enumerate(doc):
                if i >= 20 or sum(map(len, partes)) > limite:
                    break
                partes.append(pag.get_text())
        return "\n".join(partes)[:limite]
    if tipo in {"docx", "pptx", "xlsx"}:
        prefixo = {"docx": "word/", "pptx": "ppt/slides/", "xlsx": "xl/sharedstrings"}[tipo]
        textos = []
        with zipfile.ZipFile(io.BytesIO(dados)) as z:
            for nome in sorted(z.namelist()):
                if nome.lower().startswith(prefixo) and nome.endswith(".xml"):
                    xml = z.read(nome).decode("utf-8", errors="replace")
                    textos.append(re.sub(r"<[^>]+>", " ", xml))
        return re.sub(r"\s+", " ", " ".join(textos))[:limite]
    return ""


def imagens_para_ver(tipo: str, dados: bytes, texto: str) -> list[bytes]:
    """Imagem para o modelo olhar: a própria imagem, ou a 1ª página de um PDF quase sem texto (escaneado)."""
    if tipo in {"png", "jpeg", "webp"}:
        return [dados]
    if tipo == "pdf" and len(texto.strip()) < 200:
        import pymupdf

        with pymupdf.open(stream=dados, filetype="pdf") as doc:
            if doc.page_count:
                return [doc[0].get_pixmap(dpi=90).tobytes("png")]
    return []


def _cpf_valido(numeros: str) -> bool:
    if len(numeros) != 11 or numeros == numeros[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(numeros[i]) * (n + 1 - i) for i in range(n))
        if (soma * 10 % 11) % 10 != int(numeros[n]):
            return False
    return True


CPF = re.compile(r"(?<!\d)(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})(?!\d)")
TELEFONE = re.compile(r"(?<!\d)\(?(\d{2})\)?\s?(9\d{4})[-\s]?(\d{4})(?!\d)")
EMAIL = re.compile(r"[\w.+-]+@([\w-]+\.)+[a-z]{2,}", re.I)


def mascarar(t: str) -> str:
    return re.sub(r"\d", "*", t)


def dados_pessoais(texto: str) -> tuple[list[str], str | None]:
    """Motivos e um trecho mascarado, se o texto tiver dados pessoais de terceiros."""
    cpfs = [m.group(0) for m in CPF.finditer(texto) if _cpf_valido("".join(m.groups()))]
    fones = [m.group(0) for m in TELEFONE.finditer(texto)]
    emails = [m.group(0) for m in EMAIL.finditer(texto) if not m.group(0).lower().endswith(DOMINIOS_INSTITUCIONAIS)]
    motivos = []
    if cpfs:
        motivos.append(f"{len(cpfs)} CPF")
    if len(fones) >= 2:
        motivos.append(f"{len(fones)} telefones celulares")
    if len(emails) >= 3:
        motivos.append(f"{len(emails)} e-mails pessoais")
    if not motivos:
        return [], None
    exemplos = (cpfs[:1] + fones[:1] + emails[:1])
    trecho = " · ".join(mascarar(e) if "@" not in e else "*" * 4 + e[e.index("@"):] for e in exemplos)
    return motivos, trecho


# ------------------------------------------------------------------ links
def problemas_do_link(url: str) -> list[str]:
    partes = urlsplit(url)
    host = (partes.hostname or "").lower()
    problemas = []
    if partes.scheme != "https":
        problemas.append("link sem https")
    if re.fullmatch(r"[\d.]+", host) or host.startswith("["):
        problemas.append("link para endereço IP")
    if host in ENCURTADORES:
        problemas.append("link encurtado (não dá para saber o destino)")
    if EXTENSOES_PERIGOSAS.search(partes.path):
        problemas.append("link para programa ou script")
    if partes.username or partes.password:
        problemas.append("link com usuário/senha embutidos")
    return problemas


# ------------------------------------------------------------------ 5. modelo
def julgar_com_modelo(ia: Ollama, item: dict, texto: str, imagens: list[bytes]) -> dict:
    prompt = (
        f"Disciplina: {item.get('disciplina') or 'não informada'}\n"
        f"Tipo declarado: {item.get('tipo')}\n"
        f"Título: {item.get('titulo')}\n"
        f"Descrição: {item.get('descricao') or '—'}\n"
        f"Link: {item.get('link_url') or '—'}\n"
        f"Nome do arquivo: {item.get('arquivo_nome') or '—'}\n\n"
        "Conteúdo (trecho):\n" + (texto[:6000] if texto else "(sem texto; veja a imagem, se houver)") + "\n\n"
        "Este envio pode ficar público no acervo da disciplina? Responda com adequado, categorias (vazio se adequado), "
        "motivo em uma frase e confianca entre 0 e 1."
    )
    r = ia.json(prompt, ESQUEMA, imagens=imagens or None, visao=bool(imagens), sistema=SISTEMA_MODERACAO, contexto=8192)
    return {
        "adequado": bool(r.get("adequado")),
        "categorias": [c for c in r.get("categorias") or [] if c in ESQUEMA["properties"]["categorias"]["items"]["enum"]],
        "motivo": str(r.get("motivo") or "")[:300],
        "confianca": max(0.0, min(1.0, float(r.get("confianca") or 0))),
    }


# ------------------------------------------------------------------ decisão
def moderar(item: dict, dados: bytes | None, ia: Ollama | None) -> Resultado:
    """Junta todas as verificações. dados=None para link."""
    verificacoes: list[str] = []
    texto = ""
    imagens: list[bytes] = []
    res = Resultado(publicar=False, motivo="")

    if dados is not None:
        res.sha256 = hashlib.sha256(dados).hexdigest()
        verificacoes.append("tamanho e tipo real")
        if len(dados) > LIMITE_BYTES:
            return _reter(res, "O arquivo passa de 25 MB.", ["tipo_proibido"], verificacoes)
        tipo = detectar_tipo(dados)
        res.tipo_detectado = (tipo or "não permitido").upper()
        if tipo is None:
            return _reter(res, "Tipo de arquivo não permitido no acervo (só PDF, imagem, Office sem macro e texto).",
                          ["tipo_proibido"], verificacoes)
        verificacoes.append("código embutido")
        estrutura = problemas_estruturais(tipo, dados)
        if estrutura:
            return _reter(res, "Arquivo com conteúdo executável: " + "; ".join(estrutura) + ".", ["codigo_embutido"],
                          verificacoes)
        infectado, assinatura = antivirus(dados)
        if infectado is not None:
            verificacoes.append("antivírus (ClamAV)")
        if infectado:
            return _reter(res, f"O antivírus encontrou {assinatura}.", ["virus"], verificacoes)
        try:
            texto = extrair_texto(tipo, dados)
        except Exception as e:  # PDF corrompido etc.
            return _reter(res, f"Não consegui ler o arquivo ({type(e).__name__}).", ["ilegivel"], verificacoes)
        imagens = imagens_para_ver(tipo, dados, texto)
    else:
        verificacoes.append("endereço do link")
        problemas = problemas_do_link(item.get("link_url") or "")
        if problemas:
            return _reter(res, "Link suspeito: " + "; ".join(problemas) + ".", ["malicioso"], verificacoes)

    verificacoes.append("dados pessoais")
    pessoais, trecho = dados_pessoais(" ".join(filter(None, [item.get("titulo"), item.get("descricao"), texto])))
    if pessoais:
        res.trecho = trecho
        return _reter(res, "Tem dados pessoais de terceiros (" + ", ".join(pessoais) + ").", ["dados_pessoais"],
                      verificacoes)

    if ia is None:
        raise IAIndisponivel("modelo local indisponível para a moderação")
    verificacoes.append("conteúdo (modelo local" + (" com imagem)" if imagens else ")"))
    j = julgar_com_modelo(ia, item, texto, imagens)
    res.verificacoes = verificacoes
    res.origem = "archie"
    res.modelo = ia.modelo
    res.confianca = j["confianca"]
    res.categorias = j["categorias"]
    if j["adequado"] and not j["categorias"] and j["confianca"] >= CONF_MINIMA:
        res.publicar = True
        res.motivo = j["motivo"] or "Material acadêmico adequado."
        return res
    res.motivo = j["motivo"] or "O Archie não teve certeza de que o conteúdo é adequado."
    if not res.categorias and j["adequado"]:
        res.motivo = f"Certeza baixa ({round(j['confianca'] * 100)}%): {res.motivo}"
    if trecho_curto := texto.strip()[:160]:
        res.trecho = mascarar_dados(trecho_curto)
    return res


def mascarar_dados(t: str) -> str:
    t = EMAIL.sub("****@****", t)
    return re.sub(r"\d{3,}", lambda m: "*" * len(m.group(0)), t)


def _reter(res: Resultado, motivo: str, categorias: list[str], verificacoes: list[str]) -> Resultado:
    res.publicar = False
    res.motivo = motivo
    res.categorias = categorias
    res.confianca = 1.0
    res.origem = "verificacao"
    res.verificacoes = verificacoes
    return res


# ------------------------------------------------------------------ armazenamento e tarefa da fila
def baixar(supabase_url: str | None, chave_servico: str | None, chave: str, http: httpx.Client | None = None) -> bytes:
    """Baixa o arquivo do bucket privado "materiais" do Supabase Storage (só leitura, na memória)."""
    if not supabase_url or not chave_servico:
        raise SemArmazenamento("defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do worker")
    cliente = http or httpx.Client(timeout=120)
    caminho = "/".join(_q(p) for p in chave.split("/"))
    r = cliente.get(f"{supabase_url.rstrip('/')}/storage/v1/object/materiais/{caminho}",
                    headers={"Authorization": f"Bearer {chave_servico}", "apikey": chave_servico})
    r.raise_for_status()
    if len(r.content) > LIMITE_BYTES + 1024:
        raise ValueError("arquivo maior que o limite")
    return r.content


def _q(parte: str) -> str:
    from urllib.parse import quote

    return quote(parte, safe="")


def atender(archie, corpo: dict) -> None:
    """Tarefa {"tipo": "moderar_acervo", "item_id": ...} da fila archie_jobs."""
    item = archie.banco.item_acervo(str(corpo.get("item_id")))
    if not item or item["status"] != "em_analise":
        return
    dados = None
    if item.get("arquivo_chave"):
        dados = baixar(archie.cfg.supabase_url, archie.cfg.supabase_chave_servico, item["arquivo_chave"])
    res = moderar(item, dados, archie.ia)
    archie.banco.moderar_acervo(item["id"], res.publicar, res.como_json())
    archie.processadas += 1
    log.info("acervo %s: %s (%s)", item["id"], "publicado" if res.publicar else "quarentena", res.motivo)
