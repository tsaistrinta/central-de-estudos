import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Sparkles, X } from 'lucide-react'
import { atualizarEvento, criarEvento } from '@/api/agenda'
import { criarProposta } from '@/api/comunidade'
import { mensagemDeErro } from '@/api/auth'
import { Aviso } from '@/components/auth/AuthUI'
import { Input, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { entenderFrase } from '@/lib/frase'
import { TIPOS_EVENTO, type TipoEvento } from '@/lib/eventos'
import { MINUTOS_LEMBRETE, type ItemAgenda } from '@/lib/agenda'
import { fundoDaCor } from '@/lib/cores'
import { cn } from '@/lib/utils'
import type { MinhaTurma } from '@/types'

export type ModoNovoEvento =
  | { modo: 'novo'; inicio?: Date; fim?: Date; diaTodo?: boolean }
  | { modo: 'editar'; item: ItemAgenda }
  | { modo: 'propor'; item: ItemAgenda }

const SEMANA_RRULE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const dataISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hora = (d: Date) => d.toTimeString().slice(0, 5)
const juntar = (data: string, h: string) => new Date(`${data}T${h || '00:00'}`)

function proximaHoraCheia() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

type Props = {
  config: ModoNovoEvento
  turmas: MinhaTurma[]
  itens: ItemAgenda[]
  fimDoPeriodo?: string | null
  onFechar: () => void
}

// Tela 23 · Novo evento: formulário completo + "escreva do seu jeito" + horários livres do dia.
export default function NovoEvento({ config, turmas, itens, fimDoPeriodo, onFechar }: Props) {
  const qc = useQueryClient()
  const base = config.modo === 'novo' ? null : config.item
  const ev = base?.evento
  const ini0 = config.modo === 'novo' ? (config.inicio ?? proximaHoraCheia()) : base!.inicio
  const fim0 = config.modo === 'novo' ? (config.fim ?? new Date(ini0.getTime() + 36e5)) : base!.fim

  const [frase, setFrase] = useState('')
  const [titulo, setTitulo] = useState(config.modo === 'editar' ? (ev?.titulo ?? '') : config.modo === 'propor' ? (ev?.titulo ?? base!.titulo) : '')
  const [calendario, setCalendario] = useState<string>(config.modo === 'propor' ? base!.turma!.id : 'pessoal')
  const [tipo, setTipo] = useState<TipoEvento>(ev?.tipo ?? (base?.tipo === 'aula' ? 'aula' : 'outro'))
  const [disciplinaId, setDisciplinaId] = useState<string>(ev?.disciplina_id ?? '')
  const [data, setData] = useState(dataISO(ini0))
  const [hIni, setHIni] = useState(hora(ini0))
  const [hFim, setHFim] = useState(hora(fim0))
  const [diaTodo, setDiaTodo] = useState(config.modo === 'novo' ? !!config.diaTodo : !!base?.diaTodo)
  const [repetir, setRepetir] = useState<'nao' | 'semana' | 'dia'>(ev?.rrule?.includes('DAILY') ? 'dia' : ev?.rrule ? 'semana' : 'nao')
  const [local, setLocal] = useState(ev?.local ?? base?.aula?.sala ?? '')
  const [lembretes, setLembretes] = useState<number[]>(ev?.lembretes ?? [60])
  const [descricao, setDescricao] = useState(ev?.descricao ?? '')
  const [mudanca, setMudanca] = useState<'data' | 'cancelada'>('data')
  const [erro, setErro] = useState('')

  const disciplinas = turmas.map((t) => t.disciplina)
  const entendida = useMemo(() => (frase.trim().length > 3 ? entenderFrase(frase, disciplinas) : null), [frase, disciplinas])

  function usarFrase() {
    if (!entendida) return
    setTitulo(entendida.titulo)
    setTipo(entendida.tipo)
    if (entendida.disciplinaId) setDisciplinaId(entendida.disciplinaId)
    if (entendida.inicio) {
      setData(dataISO(entendida.inicio))
      setDiaTodo(entendida.diaTodo)
      if (!entendida.diaTodo) {
        setHIni(hora(entendida.inicio))
        if (entendida.fim) setHFim(hora(entendida.fim))
      }
    }
    if (entendida.semanal) setRepetir('semana')
    setFrase('')
  }

  // Horários do dia escolhido (07–23 h), para ver conflitos como no assistente do Outlook.
  const dia = new Date(`${data}T00:00`)
  const ocupados = itens.filter((i) => !i.diaTodo && i.inicio.toDateString() === dia.toDateString() && i.id !== base?.id && i.estilo !== 'cancelado')
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getHours() + d.getMinutes() / 60 - 7) / 16) * 100))
  const meuIni = juntar(data, hIni)
  const meuFim = juntar(data, hFim)
  const conflito = !diaTodo && ocupados.find((o) => o.inicio < meuFim && o.fim > meuIni && o.estilo !== 'ocupado')

  const salvar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim() && !(config.modo === 'propor' && mudanca === 'cancelada')) throw new Error('Dê um título ao evento.')
      const inicio = diaTodo ? juntar(data, '00:00') : meuIni
      const fim = diaTodo ? null : meuFim
      if (fim && fim <= inicio) throw new Error('O fim precisa ser depois do início.')
      const ate = (fimDoPeriodo ?? `${new Date().getFullYear()}-12-31`).replace(/-/g, '')
      const rrule = repetir === 'semana' ? `FREQ=WEEKLY;BYDAY=${SEMANA_RRULE[inicio.getDay()]};UNTIL=${ate}` : repetir === 'dia' ? `FREQ=DAILY;UNTIL=${ate}` : null

      if (config.modo === 'propor') {
        const t = base!.turma!
        if (base!.tipo === 'aula') {
          return criarProposta({
            turma_id: t.id,
            tipo: 'novo_evento',
            titulo: `A aula de ${t.disciplina.sigla ?? t.disciplina.nome} de ${dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' })} foi cancelada?`,
            dados: { titulo: `${t.disciplina.sigla ?? t.disciplina.nome} · aula cancelada`, tipo: 'aula', inicio: base!.inicio.toISOString(), fim: base!.fim.toISOString(), cancelado: true },
          })
        }
        if (mudanca === 'cancelada') {
          return criarProposta({ turma_id: t.id, tipo: 'cancelar', alvo_evento_id: ev!.id, titulo: `${ev!.titulo} foi cancelado?`, dados: {} })
        }
        return criarProposta({
          turma_id: t.id,
          tipo: 'mudar_data',
          alvo_evento_id: ev!.id,
          titulo: `${ev!.titulo} mudou para ${inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}${diaTodo ? '' : `, ${hIni}`}?`,
          dados: { titulo: ev!.titulo, inicio: inicio.toISOString(), fim: fim?.toISOString(), local: local || undefined },
        })
      }

      if (calendario !== 'pessoal') {
        return criarProposta({
          turma_id: calendario,
          tipo: 'novo_evento',
          titulo: `${titulo.trim()} em ${inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}?`,
          dados: { titulo: titulo.trim(), tipo, inicio: inicio.toISOString(), fim: fim?.toISOString(), local: local || undefined },
        })
      }

      const valores = {
        titulo: titulo.trim(),
        tipo,
        inicio: inicio.toISOString(),
        fim: fim?.toISOString() ?? null,
        dia_todo: diaTodo,
        local: local || null,
        descricao: descricao || null,
        lembretes,
        disciplina_id: disciplinaId || null,
        rrule,
      }
      if (config.modo === 'editar' && ev) return atualizarEvento(ev.id, valores)
      return criarEvento(valores)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] })
      qc.invalidateQueries({ queryKey: ['propostas'] })
      onFechar()
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  })

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    salvar.mutate()
  }

  const vaiParaTurma = config.modo === 'propor' || calendario !== 'pessoal'
  const tituloModal = config.modo === 'editar' ? 'Editar evento' : config.modo === 'propor' ? 'Propor mudança à turma' : 'Novo evento'
  const ehAula = config.modo === 'propor' && base?.tipo === 'aula'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-foreground/45" onClick={onFechar} />
      <form
        onSubmit={aoEnviar}
        className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[620px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-[var(--sombra-pop)]"
      >
        <div className="flex items-center justify-between px-5 pt-[18px] pb-1">
          <b className="text-base">{tituloModal}</b>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-3.5">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}

          {config.modo !== 'propor' && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-accent/40 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles size={14} strokeWidth={1.9} /> Escreva do seu jeito
              </span>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={frase}
                  onChange={(e) => setFrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      usarFrase()
                    }
                  }}
                  placeholder="estudar estatística sábado 10h por 2h"
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-accent"
                />
                <Button type="button" size="sm" className="h-9" onClick={usarFrase} disabled={!entendida}>
                  Usar
                </Button>
              </div>
              {entendida && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{entendida.titulo}</span>
                  {entendida.tipo !== 'outro' && <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{TIPOS_EVENTO[entendida.tipo].nome}</span>}
                  {entendida.pedacos.map((p) => (
                    <span key={p} className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {config.modo === 'propor' && (
            <div className="rounded-md bg-background px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
              A turma vota e a mudança vale quando <b className="text-foreground">25% da turma</b> confirmar (e 80% dos votos forem sim). O professor também pode confirmar na hora.
            </div>
          )}

          {config.modo === 'propor' && !ehAula && (
            <div className="flex gap-2">
              {(['data', 'cancelada'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMudanca(m)}
                  className={cn('h-9 rounded-md border px-3.5 text-[13px] font-medium', mudanca === m ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted')}
                >
                  {m === 'data' ? 'Mudou a data ou o horário' : 'Foi cancelado'}
                </button>
              ))}
            </div>
          )}
          {ehAula && <p className="text-sm">Avisar a turma que esta aula foi cancelada? Ela some da agenda de todos quando a turma confirmar.</p>}

          {config.modo !== 'propor' && (
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Adicione um título"
              className="h-11 border-b border-border bg-transparent px-0.5 text-[17px] font-semibold outline-none focus:border-primary"
            />
          )}

          {!ehAula && !(config.modo === 'propor' && mudanca === 'cancelada') && (
            <>
              {config.modo !== 'propor' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cal">Calendário</Label>
                    <select id="cal" value={calendario} onChange={(e) => setCalendario(e.target.value)} disabled={config.modo === 'editar'} className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm">
                      <option value="pessoal">Pessoal (só você vê)</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          Turma · {t.disciplina.sigla ?? t.disciplina.nome} (a turma confirma)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo">Tipo</Label>
                    <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)} className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm">
                      {Object.entries(TIPOS_EVENTO).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-[1.3fr_.8fr_.8fr_auto] items-end gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ini">Início</Label>
                  <Input id="ini" type="time" step={900} value={hIni} onChange={(e) => setHIni(e.target.value)} disabled={diaTodo} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fim">Fim</Label>
                  <Input id="fim" type="time" step={900} value={hFim} onChange={(e) => setHFim(e.target.value)} disabled={diaTodo} />
                </div>
                <label className="flex h-9 items-center gap-2 text-[12.5px]">
                  <input type="checkbox" className="size-4 accent-primary" checked={diaTodo} onChange={(e) => setDiaTodo(e.target.checked)} />
                  Dia todo
                </label>
              </div>

              {!diaTodo && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11.5px]">
                    <span className="font-semibold">Seus horários neste dia</span>
                    <span className="font-mono text-muted-foreground">07h · 11h · 15h · 19h · 23h</span>
                  </div>
                  <div className="relative h-[26px] overflow-hidden rounded-[5px] border border-border bg-background">
                    {ocupados.map((o) => (
                      <i
                        key={o.id}
                        title={o.titulo}
                        className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#dfe2e8_0_4px,#eceef2_4px_8px)]"
                        style={{ left: `${pos(o.inicio)}%`, width: `${pos(o.fim) - pos(o.inicio)}%` }}
                      />
                    ))}
                    <i
                      className={cn('absolute inset-y-0 rounded-[3px] border-[1.5px]', conflito ? 'border-warning bg-warning-soft' : 'border-success bg-success-soft')}
                      style={{ left: `${pos(meuIni)}%`, width: `${Math.max(0.8, pos(meuFim) - pos(meuIni))}%` }}
                    />
                  </div>
                  <span className={cn('flex items-center gap-1.5 text-[11.5px]', conflito ? 'text-warning' : 'text-success')}>
                    {conflito ? (
                      <>Bate com {conflito.titulo} ({hora(conflito.inicio)}–{hora(conflito.fim)})</>
                    ) : (
                      <>
                        <Check size={12} strokeWidth={2.4} /> Livre neste horário
                      </>
                    )}
                  </span>
                </div>
              )}

              {config.modo !== 'propor' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rep">Repetir</Label>
                    <select id="rep" value={repetir} onChange={(e) => setRepetir(e.target.value as typeof repetir)} disabled={calendario !== 'pessoal'} className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm">
                      <option value="nao">Não repete</option>
                      <option value="semana">Toda semana, até o fim do semestre</option>
                      <option value="dia">Todo dia, até o fim do semestre</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="local">Local</Label>
                    <Input id="local" value={local} placeholder="Biblioteca da Fatec" onChange={(e) => setLocal(e.target.value)} />
                  </div>
                </div>
              )}

              {config.modo !== 'propor' && calendario === 'pessoal' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Matéria (opcional)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {turmas.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setDisciplinaId(disciplinaId === t.disciplina_id ? '' : t.disciplina_id)}
                          className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium',
                            disciplinaId === t.disciplina_id ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
                          )}
                        >
                          <i className={cn('size-2 rounded-[3px]', fundoDaCor(t.disciplina.cor))} />
                          {t.disciplina.sigla ?? t.disciplina.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lembrete</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 15, 60, 1440].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLembretes((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]))}
                          className={cn('h-[26px] rounded-full border px-2.5 text-[12px] font-medium', lembretes.includes(m) ? 'border-foreground bg-foreground text-card' : 'border-border text-muted-foreground hover:bg-muted')}
                        >
                          {MINUTOS_LEMBRETE[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desc">Descrição</Label>
                    <textarea id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3.5">
          {vaiParaTurma && <span className="text-[12px] text-muted-foreground">Vai para a aba Confirmações da turma.</span>}
          <span className="flex-1" />
          <Button variant="outline" onClick={onFechar}>
            Descartar
          </Button>
          <Button type="submit" disabled={salvar.isPending}>
            {vaiParaTurma ? <Plus /> : <Check />}
            {salvar.isPending ? 'Salvando…' : vaiParaTurma ? 'Enviar para a turma' : 'Salvar'}
          </Button>
        </div>
      </form>
    </>
  )
}
