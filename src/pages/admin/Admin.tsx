import { useState, type FormEvent } from 'react'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pause, Play, Plus, Server, Trash2 } from 'lucide-react'
import { apagarFonte, atualizarTurma, definirProfessor, listarContas, listarFontes, mudarPapel, numerosGerais, salvarFonte, todasAsTurmas } from '@/api/admin'
import { listarPropostas } from '@/api/comunidade'
import { Cabecalho, Cartao, Esqueleto, PontoMateria, Vazio } from '@/components/foco/Base'
import { SeloStatus } from '@/components/foco/Selos'
import Votacao from '@/components/comunidade/Votacao'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { ROTULO_PAPEL, tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import type { Fonte, Papel } from '@/types'

// Telas 14–18 · Painel do dono da plataforma.
const abas = {
  visao: 'Visão geral',
  fontes: 'Fontes monitoradas',
  curadoria: 'Curadoria',
  contas: 'Contas e papéis',
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
  const [nova, setNova] = useState({ nome: '', url: '', tipo: 'pagina' as Fonte['tipo'], frequencia_min: 60 })
  const invalidar = () => qc.invalidateQueries({ queryKey: ['fontes'] })
  const salvar = useMutation({ mutationFn: (f: Parameters<typeof salvarFonte>[0]) => salvarFonte(f), onSuccess: invalidar })
  const apagar = useMutation({ mutationFn: (id: string) => apagarFonte(id), onSuccess: invalidar })
  function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (!nova.nome || !nova.url) return
    salvar.mutate(nova, { onSuccess: () => setNova({ nome: '', url: '', tipo: 'pagina', frequencia_min: 60 }) })
  }
  return (
    <Cartao titulo="Fontes monitoradas">
      <p className="px-4 pb-2 text-[13px] text-muted-foreground">Páginas e PDFs públicos que a Yara visita. O coletor respeita o robots.txt e se identifica.</p>
      {fontes.isLoading ? (
        <Esqueleto />
      ) : (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Fonte</th>
              <th className="px-2 py-2 font-medium">Tipo</th>
              <th className="px-2 py-2 font-medium">A cada</th>
              <th className="px-2 py-2 font-medium">Última visita</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fontes.data?.map((f) => (
              <tr key={f.id} className="border-b border-muted">
                <td className="px-4 py-2">
                  <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary">
                    {f.nome} <ExternalLink size={11} />
                  </a>
                </td>
                <td className="px-2 py-2 text-muted-foreground">{f.tipo}</td>
                <td className="px-2 py-2 font-mono text-xs">{f.frequencia_min} min</td>
                <td className="px-2 py-2 text-xs text-muted-foreground">{f.ultima_verificacao ? tempoRelativo(f.ultima_verificacao) : 'aguardando a Yara'}</td>
                <td className="px-2 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', f.status === 'ativa' ? 'bg-success-soft text-success' : f.status === 'erro' ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground')}>{f.status}</span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => salvar.mutate({ ...f, status: f.status === 'ativa' ? 'pausada' : 'ativa' })} className="mr-2 text-muted-foreground hover:text-foreground" aria-label="Pausar ou retomar">
                    {f.status === 'ativa' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => apagar.mutate(f.id)} className="text-muted-foreground hover:text-destructive" aria-label="Apagar">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <form onSubmit={aoCriar} className="flex flex-wrap gap-2 p-4">
        <input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Nome" className="h-9 w-40 rounded-md border border-border px-2.5 text-sm" />
        <input value={nova.url} onChange={(e) => setNova({ ...nova, url: e.target.value })} placeholder="https://www.fatecid.com.br/site/…" className="h-9 min-w-[240px] flex-1 rounded-md border border-border px-2.5 text-sm" />
        <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as Fonte['tipo'] })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          {['pagina', 'pdf', 'imagem', 'rss'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={nova.frequencia_min} onChange={(e) => setNova({ ...nova, frequencia_min: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
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

function Curadoria() {
  const turmas = useQuery({ queryKey: ['admin', 'turmas'], queryFn: todasAsTurmas })
  const ids = (turmas.data ?? []).map((t) => t.id)
  const propostas = useQuery({ queryKey: ['propostas', 'admin', ids], queryFn: () => listarPropostas(ids, true), enabled: ids.length > 0 })
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        O que a Yara não publica sozinha e as confirmações abertas em todas as turmas. Como admin você pode fechar qualquer uma na hora.
      </p>
      {propostas.isLoading && <Esqueleto />}
      {propostas.data?.length === 0 && (
        <Cartao>
          <Vazio>Nada esperando curadoria.</Vazio>
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
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
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
                    <select value={c.papel} onChange={(e) => mudar.mutate({ id: c.id, papel: e.target.value as Papel })} className="h-8 rounded-md border border-border bg-card px-2 text-[13px]">
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
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Disciplina</th>
              <th className="px-2 py-2 font-medium">Período</th>
              <th className="px-2 py-2 font-medium">Vagas</th>
              <th className="px-2 py-2 font-medium">Professor com conta</th>
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
                  <select value={t.professor_id ?? ''} onChange={(e) => prof.mutate({ t: t.id, p: e.target.value })} className="h-8 max-w-[200px] rounded-md border border-border bg-card px-2 text-[13px]">
                    <option value="">Nenhum</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
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
  )
}

function Servidor() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ['App e banco · nuvem', 'Cloudflare Pages + Supabase (São Paulo). Acesso de qualquer lugar.', 'bg-success'],
        ['Worker da Yara · seu PC', 'Python + Ollama. Conecta para fora e puxa tarefas da fila. Entra na Fase 5.', 'bg-warning'],
        ['Coletor de fontes', 'Visita as fontes no intervalo de cada uma e só aciona a IA quando algo muda.', 'bg-warning'],
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
      <Cartao className="md:col-span-3">
        <div className="flex items-start gap-3 p-4 text-[13px] leading-relaxed text-muted-foreground">
          <Server size={18} className="mt-0.5 text-primary" />
          Se o worker da Yara parar, o app continua no ar: as tarefas esperam na fila e rodam quando ele voltar.
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
          {atual === 'turmas' && <Turmas />}
          {atual === 'servidor' && <Servidor />}
        </div>
      </div>
    </div>
  )
}
