import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, FolderOpen, MapPin, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useAgora } from '@/lib/useAgora'
import { EtiquetaEvento, LinkFonte, SeloStatus, SeloArchie } from '@/components/foco/Selos'
import { Cartao, Esqueleto, PontoMateria, Vazio } from '@/components/foco/Base'
import { useDadosAgenda } from '@/components/agenda/useDadosAgenda'
import { listarPropostas, votosDe } from '@/api/comunidade'
import { listarRevisao, listarTarefas } from '@/api/espaco'
import { meuIdSincrono } from '@/lib/identidade'
import { inicioDoDia, somarDias } from '@/lib/datas'
import { cn } from '@/lib/utils'

// Tela 03 · Hoje: o resumo do dia montado com o que a Central já sabe.

function saudacao(hora: number) {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
const hhmm = (d: Date) => d.toTimeString().slice(0, 5)

export default function Hoje() {
  const { perfil } = useAuth()
  const agora = useAgora()
  const hoje = useMemo(() => inicioDoDia(agora), [agora])
  const daqui30 = useMemo(() => somarDias(hoje, 30), [hoje])
  const { itens, turmas, carregando } = useDadosAgenda(hoje, daqui30)
  const ids = turmas.map((t) => t.id)
  const propostas = useQuery({ queryKey: ['propostas', 'abertas', ids], queryFn: () => listarPropostas(ids, true), enabled: turmas.length > 0 })
  const votos = useQuery({ queryKey: ['votos', 'meus', propostas.data?.map((p) => p.id)], queryFn: () => votosDe(propostas.data!.map((p) => p.id)), enabled: !!propostas.data?.length })
  const tarefas = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const revisao = useQuery({ queryKey: ['revisao'], queryFn: listarRevisao })

  const amanha = somarDias(hoje, 1)
  const deHoje = itens.filter((i) => !i.diaTodo && i.inicio >= hoje && i.inicio < amanha && i.estilo !== 'ocupado').sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  const importantes = itens
    .filter((i) => (i.estilo === 'prova' || i.estilo === 'entrega' || i.tipo === 'proposta') && i.fim >= agora)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .slice(0, 5)
  const mudancas = itens.filter((i) => i.evento && (i.evento.origem === 'archie' || i.evento.status === 'confirmado_turma' || i.estilo === 'cancelado') && i.inicio < somarDias(hoje, 8))
  const eu = meuIdSincrono()
  const semVoto = (propostas.data ?? []).filter((p) => !(votos.data ?? []).some((v) => v.proposta_id === p.id && v.usuario_id === eu))
  const fimSemana = somarDias(hoje, 7).toISOString().slice(0, 10)
  const tarefasSemana = (tarefas.data ?? []).filter((t) => t.coluna !== 'feito' && (!t.prazo || t.prazo <= fimSemana)).slice(0, 5)
  const paraRevisar = (revisao.data ?? []).filter((r) => r.proxima_em <= hoje.toISOString().slice(0, 10)).length
  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">
            {saudacao(agora.getHours())}
            {primeiroNome && `, ${primeiroNome}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to="/arquivos" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted">
            <FolderOpen size={16} strokeWidth={1.75} /> Meus arquivos
          </Link>
          <Link to="/agenda" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            <CalendarDays size={16} strokeWidth={1.75} /> Abrir agenda
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={1.9} className="text-primary" />
          <h2 className="text-[15px] font-semibold">Resumo do dia</h2>
          <SeloArchie />
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Hoje você tem <b className="text-foreground">{deHoje.filter((i) => i.tipo === 'aula').length} aula(s)</b>
          {importantes.length > 0 && (
            <>
              . A próxima avaliação é <b className="text-foreground">{importantes[0].titulo.replace(/\?$/, '')}</b>,{' '}
              {importantes[0].inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' })}
            </>
          )}
          {semVoto.length > 0 && (
            <>
              . <b className="text-foreground">{semVoto.length} confirmação(ões)</b> esperam o seu voto
            </>
          )}
          {paraRevisar > 0 && (
            <>
              {' '}e <b className="text-foreground">{paraRevisar} item(ns)</b> de revisão vencem hoje
            </>
          )}
          .
        </p>
        {mudancas.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {mudancas.slice(0, 3).map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-[13px]">
                <PontoMateria cor={m.cor} />
                <span className={cn(m.estilo === 'cancelado' && 'line-through')}>{m.titulo}</span>
                <span className="text-muted-foreground">· {m.inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                {m.evento && <SeloStatus status={m.evento.status} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Cartao titulo="Hoje" acao={{ to: '/agenda?visao=dia', label: 'Ver o dia' }}>
          {carregando ? (
            <Esqueleto />
          ) : deHoje.length === 0 ? (
            <Vazio>Nada marcado para hoje.</Vazio>
          ) : (
            <ul className="px-4 pb-3">
              {deHoje.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-muted py-2.5 last:border-0">
                  <span className="w-[86px] font-mono text-xs text-muted-foreground">
                    {hhmm(i.inicio)}–{hhmm(i.fim)}
                  </span>
                  <span className="h-8 w-1 rounded-full" style={{ background: i.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium', i.estilo === 'cancelado' && 'line-through opacity-60')}>{i.tipo === 'aula' ? i.turma?.disciplina.nome : i.titulo}</span>
                    {i.subtitulo && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={11} /> {i.subtitulo}
                      </span>
                    )}
                  </span>
                  {i.tipo === 'aula' ? (
                    <LinkFonte url={i.turma?.horario_fonte_url} pagina={i.turma?.horario_pagina} rotulo="Grade" className="hidden sm:inline-flex" />
                  ) : (
                    i.evento?.escopo !== 'pessoal' && <LinkFonte url={i.evento?.documento_url} className="hidden sm:inline-flex" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Próximas provas e entregas" acao={{ to: '/agenda?visao=lista', label: 'Ver lista' }}>
          {carregando ? (
            <Esqueleto />
          ) : importantes.length === 0 ? (
            <Vazio>Nenhuma prova ou entrega nos próximos 30 dias.</Vazio>
          ) : (
            <ul className="px-4 pb-3">
              {importantes.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-muted py-2.5 last:border-0">
                  <span className="w-[74px] font-mono text-xs text-muted-foreground">{i.inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                  {i.estilo === 'prova' && <EtiquetaEvento tipo="prova" />}
                  {i.estilo === 'entrega' && <EtiquetaEvento tipo="entrega" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.titulo}</span>
                  {i.tipo === 'proposta' && <SeloStatus status="nao_confirmado" />}
                  {i.evento?.status && i.evento.escopo !== 'pessoal' && <SeloStatus status={i.evento.status} />}
                  <LinkFonte url={i.evento?.documento_url} rotulo="Fonte" className="hidden md:inline-flex" />
                  <span className="text-[11.5px] text-muted-foreground">em {Math.max(0, Math.ceil((i.inicio.getTime() - agora.getTime()) / 864e5))} d</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Esperando o seu voto" acao={{ to: '/turma?aba=confirmacoes', label: 'Ver confirmações' }}>
          {semVoto.length === 0 ? (
            <Vazio>Nenhuma confirmação pendente. Quando alguém da turma propuser uma mudança, ela aparece aqui.</Vazio>
          ) : (
            <ul className="px-4 pb-3">
              {semVoto.map((p) => {
                const t = turmas.find((x) => x.id === p.turma_id)
                return (
                  <li key={p.id} className="flex items-center gap-3 border-b border-muted py-2.5 last:border-0">
                    {t && <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} />}
                    <span className="min-w-0 flex-1 truncate text-sm">{p.titulo}</span>
                    <Link to={`/turmas/${p.turma_id}?aba=confirmacoes`} className="text-[13px] font-semibold text-primary hover:underline">
                      Votar
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Tarefas da semana" acao={{ to: '/tarefas', label: 'Ver tarefas' }}>
          {tarefasSemana.length === 0 ? (
            <Vazio>Nada para esta semana.</Vazio>
          ) : (
            <ul className="px-4 pb-3">
              {tarefasSemana.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-muted py-2.5 last:border-0">
                  <span className={cn('size-2 rounded-full', t.coluna === 'fazendo' ? 'bg-warning' : 'bg-border')} />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.titulo}</span>
                  {t.prazo && <span className="font-mono text-xs text-muted-foreground">{t.prazo.slice(8, 10)}/{t.prazo.slice(5, 7)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  )
}
