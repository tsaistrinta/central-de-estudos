import { useState, type FormEvent } from 'react'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Pause, Play, Plus, RefreshCw, Server, Sparkles, Trash2, X } from 'lucide-react'
import { apagarFonte, atualizarTurma, decidirCuradoria, definirProfessor, listarContas, listarCuradoria, listarFontes, mudarPapel, numerosGerais, pedirColeta, salvarFonte, statusArchie, todasAsTurmas, ultimasCapturas } from '@/api/admin'
import { listarPropostas } from '@/api/comunidade'
import { Cabecalho, Cartao, Esqueleto, PontoMateria, Vazio } from '@/components/foco/Base'
import { Pilula, SeloStatus, SeloArchie } from '@/components/foco/Selos'
import Votacao from '@/components/comunidade/Votacao'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { ROTULO_PAPEL, tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import { DIAS_CURTOS, EFEITO_APROVAR, ROTULO_CURADORIA, ROTULO_EXTRATOR, workerNoAr } from '@/lib/archie'
import type { ConferenciaArchie, ExtratorFonte, Fonte, ItemCuradoria, Papel } from '@/types'
import { CodigoDaTurmaCelula, PedidosDeEntrada, Quarentena } from './Moderacao'

// Telas 14–18 · Painel do dono da plataforma.
const abas = {
  visao: 'Visão geral',
  fontes: 'Fontes monitoradas',
  curadoria: 'Curadoria',
  contas: 'Contas e papéis',
  entradas: 'Pedidos de entrada',
  quarentena: 'Quarentena do acervo',
  turmas: 'Turmas',
  servidor: 'Servidor e IA',
} as const
type Aba = keyof typeof abas

function Visao() {
  const n = useQuery({ queryKey: ['admin', 'numeros'], queryFn: numerosGerais })
  const itens = [
    ['Contas', n.data?.contas],
    ['Turmas', n.data?.turmas],
    ['Eventos na agenda', n.data?.eventos],
    ['Confirmações abertas', n.data?.propostasAbertas],
    ['Fontes vigiadas', n.data?.fontes],
    ['Para revisar (Archie)', n.data?.paraRevisar],
  ] as const
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          <p className="mt-1 font-mono text-3xl font-semibold">{valor ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

function Fontes() {
  const qc = useQueryClient()
  const fontes = useQuery({ queryKey: ['fontes'], queryFn: listarFontes })
  const capturas = useQuery({ queryKey: ['admin', 'capturas'], queryFn: ultimasCapturas })
  const vazia = { nome: '', url: '', tipo: 'pagina' as Fonte['tipo'], extrator: 'geral' as ExtratorFonte, frequencia_min: 120 }
  const [nova, setNova] = useState(vazia)
  const [pedidas, setPedidas] = useState<string[]>([])
  const invalidar = () => qc.invalidateQueries({ queryKey: ['fontes'] })
  const salvar = useMutation({ mutationFn: (f: Parameters<typeof salvarFonte>[0]) => salvarFonte(f), onSuccess: invalidar })
  const apagar = useMutation({ mutationFn: (id: string) => apagarFonte(id), onSuccess: invalidar })
  const verificar = useMutation({
    mutationFn: (id: string) => pedirColeta(id),
    onMutate: (id) => setPedidas((p) => [...p, id]),
    onSettled: () => {
      invalidar()
      qc.invalidateQueries({ queryKey: ['admin', 'capturas'] })
    },
  })
  function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (!nova.nome || !nova.url) return
    salvar.mutate(nova, { onSuccess: () => setNova(vazia) })
  }
  return (
    <Cartao titulo="Fontes monitoradas">
      <p className="px-4 pb-2 text-[13px] text-muted-foreground">
        Páginas e PDFs públicos que o Archie visita no intervalo de cada uma. O coletor se identifica, respeita o robots.txt e só chama a IA quando algo mudou.
      </p>
      {fontes.isLoading ? (
        <Esqueleto />
      ) : (
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Fonte</th>
              <th className="px-2 py-2 font-medium">Lê como</th>
              <th className="px-2 py-2 font-medium">A cada</th>
              <th className="px-2 py-2 font-medium">Última visita</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fontes.data?.map((f) => {
              const cap = capturas.data?.find((c) => c.fonte_id === f.id)
              const pedida = pedidas.includes(f.id)
              return (
                <tr key={f.id} className="border-b border-muted align-top">
                  <td className="px-4 py-2">
                    <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary">
                      {f.nome} <ExternalLink size={11} />
                    </a>
                    {cap && (
                      <span className="block max-w-[320px] truncate text-xs text-muted-foreground" title={cap.titulo ?? ''}>
                        Última leitura: {cap.titulo ?? 'página'}{cap.itens ? ` · ${cap.itens} itens` : ''} · {tempoRelativo(cap.capturado_em)}
                      </span>
                    )}
                    {f.status === 'erro' && f.ultimo_erro && <span className="mt-0.5 block max-w-[420px] text-xs text-destructive">{f.ultimo_erro}</span>}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground" title={ROTULO_EXTRATOR[f.extrator]?.ajuda}>
                    {ROTULO_EXTRATOR[f.extrator]?.nome ?? f.extrator}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">{f.frequencia_min} min</td>
                  <td className="px-2 py-2 text-xs whitespace-nowrap text-muted-foreground">{f.ultima_verificacao ? tempoRelativo(f.ultima_verificacao) : 'aguardando o Archie'}</td>
                  <td className="px-2 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', f.status === 'ativa' ? 'bg-success-soft text-success' : f.status === 'erro' ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground')}>{f.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => verificar.mutate(f.id)}
                      disabled={pedida && verificar.isPending}
                      className="mr-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                      title="O Archie visita esta fonte na próxima rodada (até 1 min com o worker no ar)"
                    >
                      <RefreshCw size={13} className={cn(pedida && verificar.isPending && 'animate-spin')} />
                      {pedida && !verificar.isPending ? 'Pedido' : 'Verificar agora'}
                    </button>
                    <button onClick={() => salvar.mutate({ ...f, status: f.status === 'pausada' ? 'ativa' : 'pausada' })} className="mr-2 text-muted-foreground hover:text-foreground" aria-label="Pausar ou retomar">
                      {f.status === 'pausada' ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button onClick={() => apagar.mutate(f.id)} className="text-muted-foreground hover:text-destructive" aria-label="Apagar">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
      <form onSubmit={aoCriar} className="flex flex-wrap gap-2 p-4">
        <input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Nome" className="h-9 w-40 rounded-md border border-border px-2.5 text-sm" />
        <input value={nova.url} onChange={(e) => setNova({ ...nova, url: e.target.value })} placeholder="https://www.fatecid.com.br/site/…" className="h-9 min-w-[240px] flex-1 rounded-md border border-border px-2.5 text-sm" />
        <select value={nova.extrator} onChange={(e) => setNova({ ...nova, extrator: e.target.value as ExtratorFonte })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" aria-label="Como o Archie lê">
          {Object.entries(ROTULO_EXTRATOR).map(([k, v]) => (
            <option key={k} value={k}>
              {v.nome}
            </option>
          ))}
        </select>
        <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as Fonte['tipo'] })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" aria-label="Tipo">
          {['pagina', 'pdf', 'imagem', 'rss'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={nova.frequencia_min} onChange={(e) => setNova({ ...nova, frequencia_min: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" aria-label="Intervalo">
          {[30, 60, 120, 360, 720].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
        <Button type="submit">
          <Plus /> Adicionar
        </Button>
      </form>
    </Cartao>
  )
}

function Aulas({ aulas }: { aulas?: { dia_semana: number; inicio: string; fim: string; sala?: string | null }[] }) {
  if (!aulas?.length) return <span className="text-muted-foreground">sem aulas</span>
  return (
    <span>
      {aulas.map((a, i) => (
        <span key={i} className="mr-2 inline-block whitespace-nowrap">
          <b className="font-medium">{DIAS_CURTOS[a.dia_semana]}</b> {a.inicio}–{a.fim}
          {a.sala && <span className="text-muted-foreground"> · {a.sala}</span>}
        </span>
      ))}
    </span>
  )
}

function DuplaLeitura({ c }: { c?: ConferenciaArchie | null }) {
  if (!c) return null
  const confere = !!c.confere
  return (
    <div className={`rounded-md border p-2.5 text-[13px] ${confere ? 'border-success/30 bg-success-soft' : 'border-warning/30 bg-warning-soft'}`}>
      <p className={`flex items-center gap-1.5 font-medium ${confere ? 'text-success' : 'text-warning'}`}>
        {confere ? <Check size={14} /> : <X size={14} />}
        {confere ? 'As duas leituras batem' : 'As leituras não batem'}
        {c.detalhe && <span className="font-normal text-muted-foreground">· {c.detalhe}</span>}
      </p>
      {(c.posicao || c.imagem) && (
        <div className="mt-1.5 grid gap-1">
          <div><span className="inline-block w-40 text-xs text-muted-foreground">Leitura do texto (sem IA)</span>{c.posicao ?? '—'}</div>
          <div><span className="inline-block w-40 text-xs text-muted-foreground">Leitura da imagem (IA)</span>{c.imagem ?? '—'}</div>
        </div>
      )}
    </div>
  )
}

function ItemArchie({ item, onDecidir, ocupado }: { item: ItemCuradoria; onDecidir?: (aprovar: boolean) => void; ocupado?: boolean }) {
  const documento = item.dados.documento_url ?? item.dados.evento?.documento_url
  const pagina = item.dados.pagina ?? item.dados.conferencia?.pagina
  const fonte = documento && pagina && /\.pdf($|\?)/i.test(documento) ? `${documento}#page=${pagina}` : documento
  const confianca = item.confianca != null ? Math.round(Number(item.confianca) * 100) : null
  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeloArchie rotulo={ROTULO_CURADORIA[item.item_tipo]} />
        {confianca != null && <Pilula className={confianca >= 85 ? 'bg-success-soft text-success' : confianca >= 60 ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground'}>{confianca}% de certeza</Pilula>}
        {item.decisao && (
          <Pilula className={item.decisao === 'aprovado' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}>
            {item.decisao === 'rejeitado' ? 'Recusado' : item.decidido_por ? 'Aprovado por você' : 'Aplicado pelo Archie'}
          </Pilula>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{tempoRelativo(item.decidido_em ?? item.criado_em)}</span>
      </div>
      <p className="font-semibold leading-snug">{item.resumo}</p>
      {item.item_tipo === 'grade_turma' && item.dados.antes && (
        <div className="grid gap-1 rounded-md bg-background p-2.5 text-[13px]">
          <div><span className="inline-block w-14 text-xs text-muted-foreground">Antes</span><Aulas aulas={item.dados.antes.aulas} /> {item.dados.antes.professor_nome && <span className="text-muted-foreground">({item.dados.antes.professor_nome})</span>}</div>
          <div><span className="inline-block w-14 text-xs text-muted-foreground">Agora</span><Aulas aulas={item.dados.aulas} /> {item.dados.professor_nome && <span className="text-muted-foreground">({item.dados.professor_nome})</span>}</div>
        </div>
      )}
      {item.dados.trecho && <p className="rounded-md bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground">“{item.dados.trecho}”</p>}
      <DuplaLeitura c={item.dados.conferencia} />
      {item.dados.ja_existe_em && (
        <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-[13px] text-warning">
          Já existe “{item.dados.ja_existe_em.nome}” no {item.dados.ja_existe_em.semestre}º semestre. O documento mostra no {item.dados.semestre}º. Aprovar cria outra disciplina; se o cadastro antigo estiver errado, corrija o semestre em Turmas.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.motivo && <span>{item.motivo}</span>}
        {fonte && (
          <a href={fonte} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
            ver a fonte{pagina ? ` (pág. ${pagina})` : ''} <ExternalLink size={11} />
          </a>
        )}
      </div>
      {onDecidir && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onDecidir(true)} disabled={ocupado}>
            <Check /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecidir(false)} disabled={ocupado}>
            <X /> Recusar
          </Button>
          <span className="text-xs text-muted-foreground">Aprovar {EFEITO_APROVAR[item.item_tipo]}.</span>
        </div>
      )}
    </div>
  )
}

function CuradoriaArchie() {
  const qc = useQueryClient()
  const pendentes = useQuery({ queryKey: ['admin', 'curadoria', 'pendentes'], queryFn: () => listarCuradoria('pendentes') })
  const historico = useQuery({ queryKey: ['admin', 'curadoria', 'historico'], queryFn: () => listarCuradoria('historico') })
  const [verHistorico, setVerHistorico] = useState(false)
  const decidir = useMutation({
    mutationFn: ({ ids, aprovar }: { ids: string[]; aprovar: boolean }) => decidirCuradoria(ids, aprovar),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
  const lista = pendentes.data ?? []
  const novas = lista.filter((c) => c.item_tipo === 'disciplina_nova')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-primary" /> Do Archie · {lista.length} para revisar
        </h2>
        {novas.length > 1 && (
          <Button size="sm" variant="outline" className="ml-auto" disabled={decidir.isPending} onClick={() => decidir.mutate({ ids: novas.map((c) => c.id), aprovar: true })}>
            <Check /> Aprovar as {novas.length} disciplinas da grade
          </Button>
        )}
      </div>
      {pendentes.isLoading && <Esqueleto />}
      {pendentes.data && lista.length === 0 && (
        <Cartao>
          <Vazio>Nada esperando você. O que o Archie leu com certeza alta já está publicado com o selo e o link da fonte.</Vazio>
        </Cartao>
      )}
      {lista.map((c) => (
        <Cartao key={c.id}>
          <ItemArchie item={c} ocupado={decidir.isPending} onDecidir={(aprovar) => decidir.mutate({ ids: [c.id], aprovar })} />
        </Cartao>
      ))}
      <button onClick={() => setVerHistorico((v) => !v)} className="text-[13px] font-medium text-primary hover:underline">
        {verHistorico ? 'Esconder o histórico' : `Ver o que já foi decidido (${historico.data?.length ?? 0})`}
      </button>
      {verHistorico && (
        <Cartao>
          <div className="divide-y divide-muted">
            {historico.data?.map((c) => (
              <ItemArchie key={c.id} item={c} />
            ))}
          </div>
        </Cartao>
      )}
    </div>
  )
}

function Curadoria() {
  const turmas = useQuery({ queryKey: ['admin', 'turmas'], queryFn: todasAsTurmas })
  const ids = (turmas.data ?? []).map((t) => t.id)
  const propostas = useQuery({ queryKey: ['propostas', 'admin', ids], queryFn: () => listarPropostas(ids, true), enabled: ids.length > 0 })
  return (
    <div className="space-y-6">
      <CuradoriaArchie />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Confirmações abertas nas turmas</h2>
        <p className="text-[13px] text-muted-foreground">Como admin você pode fechar qualquer uma na hora.</p>
        {propostas.isLoading && <Esqueleto />}
        {propostas.data?.length === 0 && (
          <Cartao>
            <Vazio>Nenhuma confirmação aberta.</Vazio>
          </Cartao>
        )}
        {propostas.data?.map((p) => {
          const t = turmas.data!.find((x) => x.id === p.turma_id)!
          return (
            <Cartao key={p.id}>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} />
                  <span className="text-xs text-muted-foreground">{t.disciplina.nome}</span>
                  <SeloStatus status={p.status} />
                </div>
                <p className="font-semibold">{p.titulo}</p>
                <Votacao proposta={p} turma={t} souProfessor />
              </div>
            </Cartao>
          )
        })}
      </div>
    </div>
  )
}

function Contas() {
  const qc = useQueryClient()
  const contas = useQuery({ queryKey: ['admin', 'contas'], queryFn: listarContas })
  const mudar = useMutation({ mutationFn: ({ id, papel }: { id: string; papel: Papel }) => mudarPapel(id, papel), onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'contas'] }) })
  const pedidos = (contas.data ?? []).filter((c) => c.quer_ser_professor && c.papel !== 'professor')
  return (
    <div className="space-y-4">
      {pedidos.length > 0 && (
        <Cartao titulo={`Pedidos de professor · ${pedidos.length}`}>
          <ul className="px-4 pb-3">
            {pedidos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-muted py-2 text-[13px] last:border-0">
                <span className="min-w-0 flex-1">
                  <b>{c.nome}</b> <span className="text-muted-foreground">· {c.email}</span>
                </span>
                <Button size="sm" onClick={() => mudar.mutate({ id: c.id, papel: 'professor' })}>
                  Aprovar professor
                </Button>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      <Cartao titulo="Todas as contas">
        <p className="px-4 pb-2 text-[13px] text-muted-foreground">Só e-mails dos domínios permitidos criam conta, confirmados por código.</p>
        {contas.isLoading ? (
          <Esqueleto />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">E-mail</th>
                <th className="px-2 py-2 font-medium">Papel</th>
              </tr>
            </thead>
            <tbody>
              {contas.data?.map((c) => (
                <tr key={c.id} className="border-b border-muted">
                  <td className="px-4 py-2 font-medium">{c.nome || '—'}</td>
                  <td className="px-2 py-2 text-muted-foreground">{c.email}</td>
                  <td className="px-2 py-2">
                    <select aria-label={`Papel de ${c.nome}`} value={c.papel} onChange={(e) => mudar.mutate({ id: c.id, papel: e.target.value as Papel })} className="h-8 rounded-md border border-border bg-card px-2 text-[13px]">
                      {Object.entries(ROTULO_PAPEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Cartao>
    </div>
  )
}

function Turmas() {
  const qc = useQueryClient()
  const turmas = useQuery({ queryKey: ['admin', 'turmas'], queryFn: todasAsTurmas })
  const contas = useQuery({ queryKey: ['admin', 'contas'], queryFn: listarContas })
  const professores = (contas.data ?? []).filter((c) => c.papel === 'professor')
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'turmas'] })
    qc.invalidateQueries({ queryKey: ['minhas-turmas'] })
  }
  const prof = useMutation({ mutationFn: ({ t, p }: { t: string; p: string }) => definirProfessor(t, p || null, professores.find((x) => x.id === p)?.nome), onSettled: invalidar })
  const tam = useMutation({ mutationFn: ({ t, n }: { t: string; n: number | null }) => atualizarTurma(t, { tamanho_real: n }), onSettled: invalidar })
  return (
    <Cartao titulo="Turmas do período">
      <p className="px-4 pb-2 text-[13px] text-muted-foreground">O número de vagas é a base da validação coletiva (25%). Vazio = conta quem entrou na turma.</p>
      {turmas.isLoading ? (
        <Esqueleto />
      ) : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Disciplina</th>
              <th className="px-2 py-2 font-medium">Período</th>
              <th className="px-2 py-2 font-medium">Vagas</th>
              <th className="px-2 py-2 font-medium">Professor com conta</th>
              <th className="px-2 py-2 font-medium">Código</th>
            </tr>
          </thead>
          <tbody>
            {turmas.data?.map((t) => (
              <tr key={t.id} className="border-b border-muted">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} /> {t.disciplina.nome}
                  </span>
                  <span className="block text-xs text-muted-foreground">{t.professor_nome ?? 'sem professor no site'}</span>
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  {t.periodo_letivo} · {t.turno}
                </td>
                <td className="px-2 py-2">
                  <input
                    defaultValue={t.tamanho_real ?? ''}
                    onBlur={(e) => tam.mutate({ t: t.id, n: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 w-16 rounded-md border border-border text-center font-mono text-[13px]"
                    aria-label="Vagas"
                  />
                </td>
                <td className="px-2 py-2">
                  <select aria-label={`Professor de ${t.disciplina?.nome ?? 'turma'}`} value={t.professor_id ?? ''} onChange={(e) => prof.mutate({ t: t.id, p: e.target.value })} className="h-8 max-w-[200px] rounded-md border border-border bg-card px-2 text-[13px]">
                    <option value="">Nenhum</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <CodigoDaTurmaCelula turmaId={t.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Cartao>
  )
}

function Servidor() {
  const status = useQuery({ queryKey: ['admin', 'archie-status'], queryFn: statusArchie, refetchInterval: 30_000 })
  const workers = status.data ?? []
  const noAr = workers.some((w) => workerNoAr(w))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['App e banco · nuvem', 'Cloudflare Pages + Supabase (São Paulo). Acesso de qualquer lugar.', 'bg-success'],
          ['Worker do Archie · seu PC', noAr ? 'No ar: puxa tarefas da fila e visita as fontes vencidas.' : 'Fora do ar agora. O app segue funcionando; as tarefas esperam na fila.', noAr ? 'bg-success' : 'bg-warning'],
          ['Coletor de fontes', 'Visita cada fonte no seu intervalo, respeita o robots.txt e só aciona a IA quando algo muda.', noAr ? 'bg-success' : 'bg-warning'],
        ].map(([t, d, c]) => (
          <Cartao key={t}>
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', c)} />
                <b className="text-sm">{t}</b>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          </Cartao>
        ))}
      </div>
      <Cartao titulo="Workers do Archie">
        {status.isLoading ? (
          <Esqueleto />
        ) : workers.length === 0 ? (
          <Vazio>Nenhum worker conectou ainda. Siga docs/archie.md para ligar o Archie no seu PC.</Vazio>
        ) : (
          <ul className="divide-y divide-muted px-4 pb-2">
            {workers.map((w) => (
              <li key={w.worker} className="grid gap-1 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('size-2 rounded-full', workerNoAr(w) ? 'bg-success' : 'bg-muted-foreground')} />
                  <b>{w.worker}</b>
                  <span className="text-xs text-muted-foreground">v{w.versao} · último sinal {tempoRelativo(w.ultimo_sinal)}</span>
                </div>
                <p className="text-muted-foreground">
                  {w.tarefa_atual ? `Agora: ${w.tarefa_atual}. ` : workerNoAr(w) ? 'Esperando a próxima rodada. ' : ''}
                  {w.processadas} leituras e {w.erros} erros desde {w.iniciado_em ? tempoRelativo(w.iniciado_em) : '—'}.
                </p>
                <p className="font-mono text-xs text-muted-foreground">{Object.values(w.modelos ?? {}).join(' · ')}</p>
                {w.ultimo_erro && <p className="text-xs text-destructive">Último erro: {w.ultimo_erro}</p>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao>
        <div className="flex items-start gap-3 p-4 text-[13px] leading-relaxed text-muted-foreground">
          <Server size={18} className="mt-0.5 text-primary" />
          Se o worker do Archie parar, o app continua no ar: as tarefas esperam na fila e rodam quando ele voltar.
        </div>
      </Cartao>
    </div>
  )
}

export default function Admin() {
  const { aba } = useParams()
  const { perfil, configurado } = useAuth()
  if (configurado && perfil && perfil.papel !== 'admin') return <Navigate to="/" replace />
  if (!aba || !(aba in abas)) return <Navigate to="/admin/visao" replace />
  const atual = aba as Aba
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Administração" descricao="Fontes, curadoria, contas, turmas e servidor da plataforma." />
      <div className="flex flex-col gap-5 md:flex-row">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5">
          {Object.entries(abas).map(([chave, label]) => (
            <NavLink key={chave} to={`/admin/${chave}`} className={({ isActive }) => cn('rounded-md px-2.5 py-2 text-sm transition-colors', isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {atual === 'visao' && <Visao />}
          {atual === 'fontes' && <Fontes />}
          {atual === 'curadoria' && <Curadoria />}
          {atual === 'contas' && <Contas />}
          {atual === 'entradas' && <PedidosDeEntrada />}
          {atual === 'quarentena' && <Quarentena />}
          {atual === 'turmas' && <Turmas />}
          {atual === 'servidor' && <Servidor />}
        </div>
      </div>
    </div>
  )
}
