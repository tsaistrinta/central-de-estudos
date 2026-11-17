import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Hash, Pin, Plus, Send, Sparkles, Users } from 'lucide-react'
import { entrarNaTurma, membrosDaTurma, minhasTurmas, pessoas as buscarPessoas, tenantAtual, turmasOferecidas } from '@/api/academico'
import { criarProposta, enviarMensagem, listarDuvidas, listarMensagens, listarPropostas, marcarResolvida, ouvirTurma, perguntar, reacoesDe, responder } from '@/api/comunidade'
import { listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, PontoMateria, Vazio } from '@/components/foco/Base'
import { SeloStatus, SeloYara } from '@/components/foco/Selos'
import { Avatar } from '@/components/comunidade/Avatares'
import Reacoes from '@/components/comunidade/Reacoes'
import Votacao from '@/components/comunidade/Votacao'
import ItemMaterial from '@/components/espaco/ItemMaterial'
import NovoMaterial from '@/components/espaco/NovoMaterial'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { entenderFrase } from '@/lib/frase'
import { meuIdSincrono } from '@/lib/identidade'
import { ROTULO_PAPEL, tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import type { MinhaTurma, Pessoa, Proposta } from '@/types'

// Telas 08–10 e 19 · Turma: conversa, mural, materiais, dúvidas, confirmações (validação coletiva) e membros.

const ABAS = [
  { id: 'conversa', nome: 'Conversa' },
  { id: 'mural', nome: 'Mural' },
  { id: 'materiais', nome: 'Materiais' },
  { id: 'duvidas', nome: 'Dúvidas' },
  { id: 'confirmacoes', nome: 'Confirmações' },
  { id: 'membros', nome: 'Membros' },
] as const
type Aba = (typeof ABAS)[number]['id']
const CANAIS = ['geral', 'trabalhos', 'monitoria']

function PapelPill({ p }: { p?: Pessoa }) {
  if (!p || p.papel === 'aluno' || p.papel === 'admin') return null
  return <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold', p.papel === 'professor' ? 'bg-muted text-foreground' : 'bg-accent text-accent-foreground')}>{ROTULO_PAPEL[p.papel]}</span>
}

function Mensagens({ turma, canal, pessoas, podeEscrever }: { turma: MinhaTurma; canal: string; pessoas: Map<string, Pessoa>; podeEscrever: boolean }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const msgs = useQuery({ queryKey: ['mensagens', turma.id, canal], queryFn: () => listarMensagens(turma.id, canal) })
  const ids = (msgs.data ?? []).map((m) => m.id)
  const reacoes = useQuery({ queryKey: ['reacoes', turma.id, canal, ids], queryFn: () => reacoesDe(ids), enabled: ids.length > 0 })
  const enviar = useMutation({
    mutationFn: () => enviarMensagem(turma.id, canal, texto.trim()),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['mensagens', turma.id, canal] })
    },
  })
  const propor = useMutation({
    mutationFn: (p: Parameters<typeof criarProposta>[0]) => criarProposta(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['propostas'] }),
  })
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [msgs.data?.length])

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (texto.trim()) enviar.mutate()
  }

  return (
    <div className="flex min-h-[460px] flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {msgs.isLoading && <Esqueleto />}
        {!msgs.isLoading && !msgs.data?.length && <p className="py-10 text-center text-sm text-muted-foreground">{canal === 'avisos' ? 'Nenhum aviso do professor ainda.' : 'Comece a conversa da turma.'}</p>}
        {msgs.data?.map((m) => {
          const autor = pessoas.get(m.autor_id)
          const entendida = /prova|p1|p2|entrega|trabalho|aula/i.test(m.texto) ? entenderFrase(m.texto, [turma.disciplina]) : null
          const sugereData = entendida?.inicio && (entendida.tipo === 'prova' || entendida.tipo === 'entrega' || entendida.tipo === 'trabalho')
          if (entendida) {
            const nomeCurto = m.texto.match(/\b(p\d|prova|lista \d+|trabalho|entrega|semin[aá]rio)\b/i)?.[0] ?? entendida.tipo
            entendida.titulo = `${nomeCurto.charAt(0).toUpperCase()}${nomeCurto.slice(1).replace(/^P(\d)/i, 'P$1')} · ${turma.disciplina.sigla ?? turma.disciplina.nome}`
          }
          return (
            <div key={m.id} className="flex gap-3">
              <Avatar id={m.autor_id} pessoa={autor} tamanho={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[13.5px]">{autor?.nome ?? 'Alguém da turma'}</b>
                  <PapelPill p={autor} />
                  <span className="text-xs text-muted-foreground">{tempoRelativo(m.criado_em)}</span>
                  {m.fixada && <Pin size={12} className="text-primary" />}
                </div>
                <p className="mt-0.5 text-[14px] leading-relaxed whitespace-pre-wrap">{m.texto}</p>
                {sugereData && (
                  <div className="mt-2 flex max-w-[560px] flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]">
                    <SeloYara rotulo="Só você vê" />
                    <span>
                      Parece uma data: <b>{entendida!.titulo}</b> · {entendida!.inicio!.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {!entendida!.diaTodo && `, ${entendida!.inicio!.toTimeString().slice(0, 5)}`}
                    </span>
                    <button
                      disabled={propor.isPending || propor.isSuccess}
                      onClick={() =>
                        propor.mutate({
                          turma_id: turma.id,
                          tipo: 'novo_evento',
                          titulo: `${entendida!.titulo} em ${entendida!.inicio!.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}?`,
                          trecho_origem: `“${m.texto}”`,
                          dados: { titulo: entendida!.titulo, tipo: entendida!.tipo, inicio: entendida!.inicio!.toISOString(), fim: entendida!.fim?.toISOString() },
                        })
                      }
                      className="font-semibold text-primary hover:underline disabled:text-success disabled:no-underline"
                    >
                      {propor.isSuccess ? 'Confirmação criada' : 'Pedir confirmação à turma'}
                    </button>
                  </div>
                )}
                <div className="mt-1.5">
                  <Reacoes alvo={{ alvo_tipo: 'mensagem', alvo_id: m.id }} reacoes={reacoes.data ?? []} pessoas={pessoas} turmaId={turma.id} chave={['reacoes', turma.id, canal]} />
                </div>
              </div>
            </div>
          )
        })}
        <div ref={fim} />
      </div>
      {podeEscrever ? (
        <form onSubmit={aoEnviar} className="flex gap-2 border-t border-border p-3">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={canal === 'avisos' ? 'Escreva um aviso para a turma' : `Mensagem em #${canal}`} className="h-11 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-primary" />
          <button type="submit" disabled={!texto.trim() || enviar.isPending} className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50" aria-label="Enviar">
            <Send size={16} />
          </button>
        </form>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Só o professor publica no mural. Comente na conversa.</p>
      )}
    </div>
  )
}

function Duvidas({ turma, pessoas }: { turma: MinhaTurma; pessoas: Map<string, Pessoa> }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [respostaDe, setRespostaDe] = useState<Record<string, string>>({})
  const duvidas = useQuery({ queryKey: ['duvidas', turma.id], queryFn: () => listarDuvidas(turma.id) })
  const ids = (duvidas.data ?? []).flatMap((d) => [d.id, ...d.respostas.map((r) => r.id)])
  const reacoes = useQuery({ queryKey: ['reacoes', turma.id, 'duvidas', ids], queryFn: () => reacoesDe(ids), enabled: ids.length > 0 })
  const invalidar = () => qc.invalidateQueries({ queryKey: ['duvidas', turma.id] })
  const mPerguntar = useMutation({ mutationFn: () => perguntar(turma.id, texto.trim()), onSuccess: () => (setTexto(''), invalidar()) })
  const mResponder = useMutation({ mutationFn: ({ id, t }: { id: string; t: string }) => responder(id, t), onSuccess: (_r, v) => (setRespostaDe((s) => ({ ...s, [v.id]: '' })), invalidar()) })
  const mResolver = useMutation({ mutationFn: ({ id, r }: { id: string; r: boolean }) => marcarResolvida(id, r), onSettled: invalidar })
  const eu = meuIdSincrono()

  return (
    <div className="space-y-4 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (texto.trim()) mPerguntar.mutate()
        }}
        className="flex gap-2"
      >
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pergunte para a turma e para o professor…" className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:border-primary" />
        <Button type="submit" className="h-10" disabled={!texto.trim()}>
          Perguntar
        </Button>
      </form>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles size={12} className="text-primary" /> Na Fase 6 a Yara responde primeiro, citando os materiais da turma.
      </p>
      {duvidas.isLoading && <Esqueleto />}
      {duvidas.data?.length === 0 && <Vazio>Nenhuma dúvida ainda.</Vazio>}
      {duvidas.data?.map((d) => (
        <div key={d.id} className="rounded-lg border border-border">
          <div className="flex gap-3 p-3.5">
            <Avatar id={d.autor_id} pessoa={pessoas.get(d.autor_id)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <b className="text-[13px] text-foreground">{pessoas.get(d.autor_id)?.nome}</b> {tempoRelativo(d.criado_em)}
                {d.resolvida && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    <CheckCircle2 size={11} /> Resolvida
                  </span>
                )}
              </div>
              <p className="mt-1 text-[14px] font-medium">{d.texto}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <Reacoes alvo={{ alvo_tipo: 'duvida', alvo_id: d.id }} reacoes={reacoes.data ?? []} pessoas={pessoas} turmaId={turma.id} chave={['reacoes', turma.id, 'duvidas']} />
                {d.autor_id === eu && (
                  <button onClick={() => mResolver.mutate({ id: d.id, r: !d.resolvida })} className="text-[12px] font-medium text-primary hover:underline">
                    {d.resolvida ? 'Reabrir' : 'Marcar como resolvida'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {d.respostas.map((r) => (
            <div key={r.id} className="flex gap-3 border-t border-muted bg-background/60 px-3.5 py-3">
              <Avatar id={r.autor_id ?? 'yara'} pessoa={r.autor_id ? pessoas.get(r.autor_id) : { id: 'yara', nome: 'Yara', papel: 'aluno' }} tamanho={26} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <b className="text-[13px] text-foreground">{r.autor_id ? pessoas.get(r.autor_id)?.nome : 'Yara'}</b>
                  <PapelPill p={r.autor_id ? pessoas.get(r.autor_id) : undefined} />
                  {tempoRelativo(r.criado_em)}
                  {r.confirmada_por && <SeloStatus status="oficial" rotulo={`Confirmada por ${pessoas.get(r.confirmada_por)?.nome ?? 'professor'}`} />}
                </div>
                <p className="mt-0.5 text-[13.5px] leading-relaxed">{r.texto}</p>
                {r.fontes.length > 0 && <p className="mt-1 text-xs text-primary">Fonte: {r.fontes.map((f) => f.titulo).join(' · ')}</p>}
                <div className="mt-1.5">
                  <Reacoes alvo={{ alvo_tipo: 'resposta', alvo_id: r.id }} reacoes={reacoes.data ?? []} pessoas={pessoas} turmaId={turma.id} chave={['reacoes', turma.id, 'duvidas']} />
                </div>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const t = respostaDe[d.id]?.trim()
              if (t) mResponder.mutate({ id: d.id, t })
            }}
            className="flex gap-2 border-t border-muted px-3.5 py-2.5"
          >
            <input value={respostaDe[d.id] ?? ''} onChange={(e) => setRespostaDe((s) => ({ ...s, [d.id]: e.target.value }))} placeholder="Responder…" className="h-8 min-w-0 flex-1 rounded-md border border-border px-2.5 text-[13px] outline-none focus:border-primary" />
            <Button type="submit" size="sm" variant="outline">
              Responder
            </Button>
          </form>
        </div>
      ))}
    </div>
  )
}

function Confirmacoes({ turma, pessoas, souProfessor }: { turma: MinhaTurma; pessoas: Map<string, Pessoa>; souProfessor: boolean }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('19:00')
  const propostas = useQuery({ queryKey: ['propostas', 'turma', turma.id], queryFn: () => listarPropostas([turma.id]) })
  const criar = useMutation({
    mutationFn: () => {
      const inicio = data ? new Date(`${data}T${hora || '00:00'}`) : null
      const e = entenderFrase(titulo, [turma.disciplina])
      return criarProposta({
        turma_id: turma.id,
        tipo: inicio ? 'novo_evento' : 'outro',
        titulo: titulo.trim().endsWith('?') ? titulo.trim() : `${titulo.trim()}?`,
        dados: inicio ? { titulo: titulo.trim().replace(/\?$/, ''), tipo: e.tipo, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 100 * 6e4).toISOString() } : {},
      })
    },
    onSuccess: () => {
      setTitulo('')
      setData('')
      setAberto(false)
      qc.invalidateQueries({ queryKey: ['propostas'] })
    },
  })
  const abertas = (propostas.data ?? []).filter((p) => p.status === 'nao_confirmado')
  const fechadas = (propostas.data ?? []).filter((p) => p.status !== 'nao_confirmado')

  const CartaoProposta = ({ p }: { p: Proposta }) => (
    <div className="rounded-lg border border-border">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeloStatus status={p.status} />
          {p.origem === 'yara' && <SeloYara rotulo="Proposto pela Yara" />}
          <span className="text-xs text-muted-foreground">
            {tempoRelativo(p.criado_em)}
            {p.criado_por && pessoas.get(p.criado_por) ? ` · por ${pessoas.get(p.criado_por)!.nome}` : ''}
          </span>
        </div>
        <p className="text-[16px] font-semibold">{p.titulo}</p>
        {p.dados.inicio && (
          <p className="text-[13px] text-muted-foreground">
            {new Date(p.dados.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {new Date(p.dados.inicio).toTimeString().slice(0, 5)}
            {p.dados.local ? ` · ${p.dados.local}` : ''}
          </p>
        )}
        {p.trecho_origem && <div className="rounded-md border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">Trecho que originou: {p.trecho_origem}</div>}
        <Votacao proposta={p} turma={turma} souProfessor={souProfessor} />
      </div>
    </div>
  )

  return (
    <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        {propostas.isLoading && <Esqueleto />}
        {abertas.map((p) => (
          <CartaoProposta key={p.id} p={p} />
        ))}
        {!propostas.isLoading && abertas.length === 0 && <Vazio>Nenhuma confirmação aberta.</Vazio>}
        {fechadas.length > 0 && <p className="pt-2 font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">Encerradas</p>}
        {fechadas.map((p) => (
          <CartaoProposta key={p.id} p={p} />
        ))}
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-4">
          <b className="text-[13px]">Como a turma confirma</b>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Confirma com <b className="text-foreground">sim de pelo menos 25% da turma</b> (mínimo 5) e 80% dos votos. Descarta se a maioria disser não ou depois de 72 h sem quórum. O professor ou uma fonte oficial fecham na hora.
          </p>
        </div>
        {aberto ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (titulo.trim()) criar.mutate()
            }}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <b className="text-[13px]">Propor à turma</b>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="A P2 vai ser dia 26?" className="h-9 w-full rounded-md border border-border px-2.5 text-sm outline-none focus:border-primary" />
            <div className="flex gap-2">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border px-2 text-sm" />
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-9 w-24 rounded-md border border-border px-2 text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">Com data, vira um evento na agenda de todos quando confirmar.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!titulo.trim() || criar.isPending}>
                Enviar
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setAberto(true)}>
            <Plus /> Propor mudança
          </Button>
        )}
      </div>
    </div>
  )
}

function Membros({ turma, pessoas }: { turma: MinhaTurma; pessoas: Map<string, Pessoa> }) {
  const membros = useQuery({ queryKey: ['membros', turma.id], queryFn: () => membrosDaTurma(turma.id) })
  const lista = (membros.data ?? []).slice().sort((a, b) => (a.papel_turma === 'professor' ? -1 : b.papel_turma === 'professor' ? 1 : (pessoas.get(a.usuario_id)?.nome ?? '').localeCompare(pessoas.get(b.usuario_id)?.nome ?? '')))
  return (
    <div className="p-4">
      <p className="mb-3 text-[13px] text-muted-foreground">
        {lista.filter((m) => m.papel_turma !== 'professor').length} alunos na Central · {turma.tamanho_real ?? '?'} vagas na turma
      </p>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {lista.map((m) => {
          const p = pessoas.get(m.usuario_id)
          return (
            <li key={m.usuario_id} className="flex items-center gap-2.5 border-b border-muted py-2">
              <Avatar id={m.usuario_id} pessoa={p} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p?.nome ?? 'Aluno'}</span>
              <span className="text-xs text-muted-foreground">{ROTULO_PAPEL[m.papel_turma === 'aluno' ? (p?.papel === 'admin' ? 'aluno' : (p?.papel ?? 'aluno')) : m.papel_turma]}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EntrarEmTurma({ turmas }: { turmas: MinhaTurma[] }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const oferecidas = useQuery({ queryKey: ['turmas-oferecidas', perfil?.curso_id], queryFn: () => turmasOferecidas(perfil!.curso_id!), enabled: !!perfil?.curso_id })
  const entrar = useMutation({ mutationFn: (id: string) => entrarNaTurma(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['minhas-turmas'] }) })
  const disponiveis = (oferecidas.data ?? []).filter((t) => !turmas.some((m) => m.id === t.id))
  return (
    <Cartao titulo="Entrar em outra turma">
      {disponiveis.length === 0 ? (
        <Vazio>Você já está em todas as turmas oferecidas do seu curso.</Vazio>
      ) : (
        <ul className="px-4 pb-3">
          {disponiveis.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 border-b border-muted py-2 text-[13px] last:border-0">
              <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} />
              <span className="min-w-0 flex-1 truncate">
                {t.disciplina.nome} <span className="text-muted-foreground">· {t.disciplina.semestre_matriz}º · {t.turno}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => entrar.mutate(t.id)}>
                Entrar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}

export default function Turma() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'conversa') as Aba
  const [canal, setCanal] = useState('geral')
  const [novoMaterial, setNovoMaterial] = useState(false)
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const pessoas = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas, staleTime: 5 * 60_000 })
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual, staleTime: 30 * 60_000 })
  const turma = turmas.data?.find((t) => t.id === id)
  const materiais = useQuery({ queryKey: ['materiais', 'turma', id], queryFn: () => listarMateriais({ turmaId: id }), enabled: !!turma && aba === 'materiais' })
  const abertas = useQuery({ queryKey: ['propostas', 'turma', id], queryFn: () => listarPropostas([id!]), enabled: !!turma })
  const eu = meuIdSincrono()
  const souProfessor = !!turma && (turma.professor_id === eu || turma.papel_turma === 'professor')
  const mapa = useMemo(() => pessoas.data ?? new Map<string, Pessoa>(), [pessoas.data])

  useEffect(() => {
    if (!id) return
    return ouvirTurma(id, (tabela) => {
      if (tabela === 'mensagens') qc.invalidateQueries({ queryKey: ['mensagens', id] })
      if (tabela === 'propostas' || tabela === 'votos') {
        qc.invalidateQueries({ queryKey: ['propostas'] })
        qc.invalidateQueries({ queryKey: ['votos'] })
      }
      if (tabela === 'reacoes') qc.invalidateQueries({ queryKey: ['reacoes', id] })
      if (tabela === 'respostas') qc.invalidateQueries({ queryKey: ['duvidas', id] })
    })
  }, [id, qc])

  if (turmas.isLoading) return <Esqueleto linhas={6} />
  if (!id) {
    if (turmas.data?.length) return <Navigate to={`/turmas/${turmas.data[0].id}${params.get('aba') ? `?aba=${params.get('aba')}` : ''}`} replace />
    return (
      <div className="space-y-4">
        <Cabecalho titulo="Minha turma" descricao="Você ainda não está em nenhuma turma." />
        <EntrarEmTurma turmas={[]} />
      </div>
    )
  }
  if (!turma) return <Vazio>Você não está nesta turma.</Vazio>

  const nAbertas = (abertas.data ?? []).filter((p) => p.status === 'nao_confirmado').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {turmas.data!.map((t) => (
          <Link key={t.id} to={`/turmas/${t.id}?aba=${aba}`} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium', t.id === id ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-muted')}>
            <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} /> {t.disciplina.sigla ?? t.disciplina.nome}
          </Link>
        ))}
      </div>
      <Cabecalho
        migalha={
          <>
            Comunidade <ChevronRight size={13} /> <b className="font-medium text-foreground">{turma.disciplina.sigla} · {tenant.data?.periodo_atual}</b>
          </>
        }
        titulo={`${turma.disciplina.nome}`}
        descricao={`${turma.professor_nome ?? 'Professor a confirmar'} · ${turma.tamanho_real ?? '—'} vagas · ${turma.turno === 'noite' ? 'Noite' : turma.turno === 'manha' ? 'Manhã' : 'Tarde'}`}
        acoes={
          <Link to={`/materias/${turma.disciplina_id}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted">
            <Users size={16} strokeWidth={1.75} /> Meus materiais
          </Link>
        }
      />
      <div className="flex gap-5 overflow-x-auto border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setParams({ aba: a.id }, { replace: true })}
            className={cn('-mb-px shrink-0 border-b-2 pb-2.5 text-[13.5px] font-medium', a.id === aba ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {a.nome}
            {a.id === 'confirmacoes' && nAbertas > 0 && <sup className="ml-0.5 font-mono text-[10px] text-primary">{nAbertas}</sup>}
          </button>
        ))}
      </div>

      {aba === 'conversa' && (
        <div className="grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <Cartao className="p-2">
            <p className="px-2.5 pt-1 pb-2 font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">Canais</p>
            {CANAIS.map((c) => (
              <button key={c} onClick={() => setCanal(c)} className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13.5px]', canal === c ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <Hash size={13} /> {c}
              </button>
            ))}
          </Cartao>
          <Cartao>
            <Mensagens key={canal} turma={turma} canal={canal} pessoas={mapa} podeEscrever />
          </Cartao>
        </div>
      )}
      {aba === 'mural' && (
        <Cartao>
          <Mensagens turma={turma} canal="avisos" pessoas={mapa} podeEscrever={souProfessor} />
        </Cartao>
      )}
      {aba === 'materiais' && (
        <Cartao
          titulo="Materiais da turma"
          acao={
            <Button size="sm" onClick={() => setNovoMaterial(true)}>
              <Plus /> Compartilhar
            </Button>
          }
        >
          {materiais.isLoading ? <Esqueleto /> : !materiais.data?.length ? <Vazio>Nenhum material compartilhado ainda.</Vazio> : <ul>{materiais.data.map((m) => <ItemMaterial key={m.id} m={m} />)}</ul>}
        </Cartao>
      )}
      {aba === 'duvidas' && (
        <Cartao>
          <Duvidas turma={turma} pessoas={mapa} />
        </Cartao>
      )}
      {aba === 'confirmacoes' && (
        <Cartao>
          <Confirmacoes turma={turma} pessoas={mapa} souProfessor={souProfessor} />
        </Cartao>
      )}
      {aba === 'membros' && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Cartao>
            <Membros turma={turma} pessoas={mapa} />
          </Cartao>
          <EntrarEmTurma turmas={turmas.data ?? []} />
        </div>
      )}
      {novoMaterial && <NovoMaterial turmas={[turma]} disciplinaId={turma.disciplina_id} compartilharPadrao onFechar={() => setNovoMaterial(false)} />}
    </div>
  )
}
