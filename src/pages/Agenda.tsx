import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type FullCalendar from '@fullcalendar/react'
import type { DatesSetArg } from '@fullcalendar/core'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inicioDaSemana, nomeDoMes, somarDias, tituloDaSemana } from '@/lib/datas'
import { VISAO_FC, type ItemAgenda } from '@/lib/agenda'
import { atualizarEvento, salvarPreferencias } from '@/api/agenda'
import { tenantAtual } from '@/api/academico'
import PainelCalendarios from '@/components/agenda/PainelCalendarios'
import Calendario from '@/components/agenda/Calendario'
import CartaoEvento from '@/components/agenda/CartaoEvento'
import NovoEvento, { type ModoNovoEvento } from '@/components/agenda/NovoEvento'
import { plural } from '@/lib/texto'
import { useDadosAgenda } from '@/components/agenda/useDadosAgenda'

// Telas 20–26 · Agenda no padrão Outlook com a identidade Foco.

const VISOES = [
  { id: 'dia', nome: 'Dia', tecla: 'd' },
  { id: 'semana-util', nome: 'Semana útil', tecla: 'u' },
  { id: 'semana', nome: 'Semana', tecla: 'w' },
  { id: 'mes', nome: 'Mês', tecla: 'm' },
  { id: 'lista', nome: 'Lista', tecla: 'l' },
] as const
type Visao = (typeof VISOES)[number]['id']

function intervaloInicial(): [Date, Date] {
  const ini = inicioDaSemana(new Date())
  return [ini, somarDias(ini, 7)]
}

export default function Agenda() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const celular = typeof window !== 'undefined' && window.innerWidth < 768
  const visao = (VISOES.find((v) => v.id === params.get('visao'))?.id ?? (celular ? 'dia' : 'semana')) as Visao
  const api = useRef<FullCalendar>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const [[de, ate], setIntervalo] = useState<[Date, Date]>(intervaloInicial)
  const [foco, setFoco] = useState(() => new Date())
  const [titulo, setTitulo] = useState('')
  const [busca, setBusca] = useState('')
  const [cartao, setCartao] = useState<{ item: ItemAgenda; x: number; y: number; lado: 'direita' | 'esquerda' } | null>(null)
  // ?novo=1 (busca global, "Novo evento na agenda") já abre o formulário.
  const [modal, setModal] = useState<ModoNovoEvento | null>(() => (params.get('novo') === '1' ? { modo: 'novo' } : null))

  const { itens, turmas, preferencias } = useDadosAgenda(de, ate)
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual, staleTime: 30 * 60_000 })
  const [ocultasLocal, setOcultasLocal] = useState<string[] | null>(null)
  const ocultas = useMemo(() => ocultasLocal ?? preferencias?.camadas_ocultas ?? [], [ocultasLocal, preferencias])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter(
      (i) =>
        !ocultas.includes(i.camada) &&
        (visao !== 'lista' || (i.tipo !== 'aula' && i.estilo !== 'ocupado')) &&
        (preferencias?.mostrar_sugestoes !== false || i.estilo !== 'sugestao') &&
        (preferencias?.mostrar_propostas !== false || i.tipo !== 'proposta') &&
        (!termo || i.titulo.toLowerCase().includes(termo) || i.turma?.disciplina.nome.toLowerCase().includes(termo)),
    )
  }, [itens, ocultas, preferencias, busca, visao])

  const diasComProva = useMemo(() => itens.filter((i) => i.estilo === 'prova').map((i) => i.inicio), [itens])
  const sugestoes = itens.filter((i) => i.estilo === 'sugestao').length

  function alternarCamada(id: string) {
    const novo = ocultas.includes(id) ? ocultas.filter((x) => x !== id) : [...ocultas, id]
    setOcultasLocal(novo)
    salvarPreferencias({ camadas_ocultas: novo }).catch(() => {})
  }

  function mudarVisao(v: Visao) {
    setCartao(null)
    api.current?.getApi().changeView(VISAO_FC[v])
    setParams(
      (p) => {
        p.set('visao', v)
        return p
      },
      { replace: true },
    )
  }

  const irPara = useCallback((d: Date) => {
    setFoco(d)
    api.current?.getApi().gotoDate(d)
  }, [])

  function aoIntervalo(arg: DatesSetArg) {
    setIntervalo((atual) => (atual[0].getTime() === arg.start.getTime() && atual[1].getTime() === arg.end.getTime() ? atual : [arg.start, arg.end]))
    const atual = arg.view.currentStart
    setFoco((f) => (f >= arg.view.currentStart && f < arg.view.currentEnd ? f : atual))
    const tipo = arg.view.type
    setTitulo(
      tipo === 'timeGridDay'
        ? atual.toLocaleDateString('pt-BR', celular ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' })
        : tipo === 'dayGridMonth'
          ? celular
            ? atual.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            : nomeDoMes(atual).replace(/ (\d{4})$/, ' de $1')
          : tipo === 'lista30'
            ? celular
              ? '30 dias'
              : 'Próximos 30 dias'
            : tituloDaSemana(inicioDaSemana(atual)),
    )
  }

  function abrirCartao(item: ItemAgenda, el: HTMLElement) {
    const caixaR = caixa.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const largura = 372
    const direita = r.right + 10 + largura < caixaR.right
    const x = caixaR.width < largura + 40 ? 8 : direita ? r.right - caixaR.left + 10 : Math.max(8, r.left - caixaR.left - largura - 10)
    const y = Math.min(Math.max(8, r.top - caixaR.top - 20), caixaR.height - 440)
    setCartao({ item, x, y: Math.max(8, y), lado: direita ? 'direita' : 'esquerda' })
  }

  const mover = useMutation({
    mutationFn: ({ item, inicio, fim }: { item: ItemAgenda; inicio: Date; fim: Date | null; desfazer: () => void }) =>
      atualizarEvento(item.evento!.id, { inicio: inicio.toISOString(), fim: fim?.toISOString() ?? null }),
    onError: (_e, v) => v.desfazer(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })

  // Atalhos do Outlook: N novo, T hoje, D/U/W/M/L visões, ← → navegar, / buscar.
  const buscaRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || modal || alvo.closest('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      const cal = api.current?.getApi()
      if (k === 'n') setModal({ modo: 'novo' })
      else if (k === 't') cal?.today()
      else if (k === 'arrowleft') cal?.prev()
      else if (k === 'arrowright') cal?.next()
      else if (k === '/') {
        e.preventDefault()
        buscaRef.current?.focus()
      } else {
        const v = VISOES.find((x) => x.tecla === k)
        if (v) mudarVisao(v.id)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const resumo = useMemo(() => {
    const canceladas = itens.filter((i) => i.estilo === 'cancelado').length
    const propostas = itens.filter((i) => i.tipo === 'proposta').length
    return { canceladas, propostas }
  }, [itens])

  return (
    <div className="flex h-full">
      <div className="hidden lg:flex">
      <PainelCalendarios
        foco={foco}
        onEscolherDia={irPara}
        onNovoEvento={() => setModal({ modo: 'novo' })}
        turmas={turmas}
        ocultas={ocultas}
        onAlternar={alternarCamada}
        diasComProva={diasComProva}
        sugestoes={sugestoes}
        rodape={
          (resumo.canceladas > 0 || resumo.propostas > 0 || sugestoes > 0) && (
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3">
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                <Sparkles size={14} strokeWidth={1.9} className="text-primary" /> Archie neste período
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {[
                  resumo.canceladas && <b key="c" className="text-foreground">{plural(resumo.canceladas, 'cancelada')}</b>,
                  resumo.propostas && <b key="p" className="text-foreground">{plural(resumo.propostas, 'data')} esperando a turma</b>,
                  sugestoes && <b key="s" className="text-foreground">{plural(sugestoes, 'sugestão', 'sugestões')} de estudo</b>,
                ]
                  .filter(Boolean)
                  .flatMap((n, i) => (i ? [' · ', n] : [n]))}
              </p>
            </div>
          )
        }
      />
      </div>

      <section ref={caixa} className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center gap-2 overflow-x-auto border-b border-border pr-3 pl-3 md:pr-4 md:pl-[18px]">
          <button onClick={() => api.current?.getApi().today()} className="h-8 rounded-md border border-border px-3.5 text-[13px] font-semibold hover:bg-muted" title="Hoje (T)">
            Hoje
          </button>
          <button onClick={() => api.current?.getApi().prev()} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Anterior">
            <ChevronLeft size={17} strokeWidth={2} />
          </button>
          <button onClick={() => api.current?.getApi().next()} className="-ml-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Próximo">
            <ChevronRight size={17} strokeWidth={2} />
          </button>
          <h1 className="ml-1.5 flex min-w-0 flex-1 items-center gap-1.5 truncate text-[15px] md:flex-none md:text-[17px] font-semibold tracking-tight first-letter:uppercase">
            <span className="truncate">{titulo}</span>
            <ChevronDown size={15} strokeWidth={2} className="shrink-0 text-muted-foreground" />
          </h1>
          <span className="hidden flex-1 md:block" />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-[12.5px] font-medium">
            {VISOES.filter((v) => !celular || v.id === 'dia' || v.id === 'mes' || v.id === 'lista').map((v) => (
              <button
                key={v.id}
                onClick={() => mudarVisao(v.id)}
                title={`${v.nome} (${v.tecla.toUpperCase()})`}
                className={cn('h-[30px] border-r border-border px-[11px] last:border-r-0', v.id === visao ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                {v.nome}
              </button>
            ))}
          </div>
          <button
            onClick={() => setModal({ modo: 'novo' })}
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground lg:hidden"
            aria-label="Novo evento"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => salvarPreferencias({ mostrar_propostas: !(preferencias?.mostrar_propostas ?? true) }).then(() => qc.invalidateQueries({ queryKey: ['agenda-preferencias'] }))}
            className={cn('hidden size-8 place-items-center rounded-md border border-border hover:bg-muted md:grid', preferencias?.mostrar_propostas === false ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
            title={preferencias?.mostrar_propostas === false ? 'Mostrar propostas da turma' : 'Esconder propostas da turma'}
          >
            <Filter size={16} strokeWidth={1.75} />
          </button>
          <label className="hidden h-8 w-[196px] shrink-0 items-center xl:flex gap-2 rounded-md border border-border px-2.5 text-[12.5px] text-muted-foreground focus-within:border-primary">
            <Search size={15} strokeWidth={1.75} />
            <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na agenda" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
            <kbd className="rounded border border-border px-1.5 font-mono text-[10.5px]">/</kbd>
          </label>
        </header>

        <div className="min-h-0 flex-1">
          <Calendario
            apiRef={api}
            visao={visao}
            itens={visiveis}
            horaInicio={preferencias?.hora_inicio ?? 8}
            horaFim={preferencias?.hora_fim ?? 23}
            onIntervalo={aoIntervalo}
            onClicar={abrirCartao}
            onSelecionar={(inicio, fim, diaTodo) => {
              setCartao(null)
              setModal({ modo: 'novo', inicio, fim: diaTodo ? inicio : fim, diaTodo })
            }}
            onMover={(item, inicio, fim, desfazer) => mover.mutate({ item, inicio, fim, desfazer })}
          />
        </div>

        {cartao && (
          <CartaoEvento
            key={cartao.item.id}
            item={cartao.item}
            posicao={cartao}
            onFechar={() => setCartao(null)}
            onEditar={(item) => {
              setCartao(null)
              setModal({ modo: 'editar', item })
            }}
            onPropor={(item) => {
              setCartao(null)
              setModal({ modo: 'propor', item })
            }}
          />
        )}
      </section>

      {modal && <NovoEvento config={modal} turmas={turmas} itens={itens} fimDoPeriodo={tenant.data?.fim_periodo} onFechar={() => setModal(null)} />}
    </div>
  )
}
