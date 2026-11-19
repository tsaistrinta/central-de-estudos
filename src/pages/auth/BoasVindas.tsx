import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, GraduationCap, Sparkles } from 'lucide-react'
import ChipLogo from '@/components/ChipLogo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Aviso } from '@/components/auth/AuthUI'
import { concluirOnboarding, listarCursos, turmasOferecidas } from '@/api/academico'
import { mensagemDeErro } from '@/api/auth'
import { useAuth } from '@/lib/auth'
import { fundoDaCor } from '@/lib/cores'
import { cn } from '@/lib/utils'
import type { Turno } from '@/types'

// Tela 02 · Primeiro acesso: curso → semestre e turno → turmas. A agenda já vem pronta com os horários.
const PASSOS = ['Curso', 'Semestre', 'Turmas'] as const
const TURNOS: { id: Turno; nome: string }[] = [
  { id: 'manha', nome: 'Manhã' },
  { id: 'tarde', nome: 'Tarde' },
  { id: 'noite', nome: 'Noite' },
]

function Stepper({ passo }: { passo: number }) {
  return (
    <ol className="flex items-center justify-center gap-3">
      {PASSOS.map((nome, i) => {
        const feito = i < passo
        const atual = i === passo
        return (
          <li key={nome} className="flex items-center gap-3">
            {i > 0 && <span className={cn('h-0.5 w-14', i <= passo ? 'bg-primary' : 'bg-border')} />}
            <span className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'grid size-[26px] place-items-center rounded-full text-xs font-semibold',
                  feito || atual ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground',
                )}
              >
                {feito ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={atual || feito ? 'font-medium' : 'text-muted-foreground'}>{nome}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function BoasVindas() {
  const { recarregarPerfil } = useAuth()
  const navegar = useNavigate()
  const [passo, setPasso] = useState(0)
  const [cursoId, setCursoId] = useState('')
  const [semestre, setSemestre] = useState(0)
  const [turno, setTurno] = useState<Turno>('noite')
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set())
  const [mostrarOutras, setMostrarOutras] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const cursos = useQuery({ queryKey: ['cursos'], queryFn: listarCursos })
  const curso = cursos.data?.find((c) => c.id === cursoId) ?? (cursos.data?.length === 1 ? cursos.data[0] : undefined)
  const turmas = useQuery({
    queryKey: ['turmas-oferecidas', curso?.id, turno],
    queryFn: () => turmasOferecidas(curso!.id, turno),
    enabled: !!curso && passo === 2,
  })

  const { doSemestre, outras } = useMemo(() => {
    const lista = (turmas.data ?? []).slice().sort((a, b) => a.disciplina.nome.localeCompare(b.disciplina.nome))
    return {
      doSemestre: lista.filter((t) => t.disciplina.semestre_matriz === semestre),
      outras: lista.filter((t) => t.disciplina.semestre_matriz !== semestre),
    }
  }, [turmas.data, semestre])

  // Ao chegar nas turmas, já marca todas do semestre.
  const [preparado, setPreparado] = useState('')
  const chave = `${curso?.id}-${semestre}-${turno}-${turmas.dataUpdatedAt}`
  if (passo === 2 && turmas.data && preparado !== chave) {
    setPreparado(chave)
    setEscolhidas(new Set(doSemestre.map((t) => t.id)))
  }

  function alternar(id: string) {
    setEscolhidas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (passo === 0) {
      if (!curso) return setErro('Escolha o seu curso.')
      setCursoId(curso.id)
      return setPasso(1)
    }
    if (passo === 1) {
      if (!semestre) return setErro('Escolha o semestre que você está cursando.')
      return setPasso(2)
    }
    setSalvando(true)
    try {
      await concluirOnboarding(curso!.id, semestre, turno, [...escolhidas])
      await recarregarPerfil()
      navegar(escolhidas.size ? '/materias' : '/agenda', { replace: true })
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setSalvando(false)
    }
  }

  const ItemTurma = ({ t }: { t: (typeof doSemestre)[number] }) => {
    const on = escolhidas.has(t.id)
    return (
      <button
        type="button"
        onClick={() => alternar(t.id)}
        aria-pressed={on}
        className={cn(
          'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
          on ? 'border-primary bg-accent/40' : 'border-border hover:bg-muted',
        )}
      >
        <span className={cn('size-2 shrink-0 rounded-[3px]', fundoDaCor(t.disciplina.cor))} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{t.disciplina.nome}</span>
          <span className="block text-xs text-muted-foreground">
            {t.professor_nome ?? 'Professor a confirmar'} · {t.disciplina.semestre_matriz}º semestre
          </span>
        </span>
        <span
          className={cn(
            'grid size-[18px] place-items-center rounded-[4px] border-[1.5px]',
            on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
          )}
        >
          {on && <Check size={11} strokeWidth={3} />}
        </span>
      </button>
    )
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="flex items-center justify-center gap-2">
        <ChipLogo className="size-7" />
        <span className="text-[17px] font-semibold tracking-tight">Central de Estudos</span>
      </div>
      <div className="mt-9">
        <Stepper passo={passo} />
      </div>

      <form onSubmit={aoEnviar} className="mx-auto mt-12 max-w-[640px] rounded-lg border border-border bg-card p-8">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Passo {passo + 1} de {PASSOS.length}
        </p>
        {erro && (
          <div className="mt-4">
            <Aviso tipo="erro">{erro}</Aviso>
          </div>
        )}

        {passo === 0 && (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Qual curso você faz?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cursos da sua unidade com turmas neste semestre.</p>
            <div className="mt-6 space-y-2">
              {cursos.isLoading && <div className="h-14 animate-pulse rounded-md bg-muted" />}
              {cursos.data?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCursoId(c.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left',
                    curso?.id === c.id ? 'border-primary bg-accent/40' : 'border-border hover:bg-muted',
                  )}
                >
                  <GraduationCap size={18} strokeWidth={1.75} className="text-primary" />
                  <span className="flex-1 text-sm font-semibold">{c.nome}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.sigla}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {passo === 1 && (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Em que semestre e turno você está?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Com isso a Central encontra suas turmas e os horários das aulas.</p>
            <div className="mt-6">
              <Label>Semestre</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: curso?.semestres ?? 6 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSemestre(n)}
                    aria-pressed={semestre === n}
                    className={cn(
                      'h-9 w-14 rounded-md border text-sm font-medium transition-colors',
                      semestre === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                    )}
                  >
                    {n}º
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Label>Turno</Label>
              <div className="mt-2 flex gap-2">
                {TURNOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTurno(t.id)}
                    aria-pressed={turno === t.id}
                    className={cn(
                      'h-9 rounded-md border px-4 text-sm font-medium',
                      turno === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                    )}
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Quais disciplinas você está fazendo?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Marcamos as do {semestre}º semestre. Tire as que você não faz e inclua dependências ou adiantadas.
            </p>
            <div className="mt-6 space-y-2">
              {turmas.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}
              {doSemestre.map((t) => (
                <ItemTurma key={t.id} t={t} />
              ))}
              {!turmas.isLoading && doSemestre.length === 0 && (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Ainda não há turmas do {semestre}º semestre nesse turno. O Archie cadastra quando ler a grade do site; você pode
                  concluir agora e entrar nas turmas depois.
                </p>
              )}
            </div>
            {outras.length > 0 && (
              <div className="mt-5">
                <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => setMostrarOutras((v) => !v)}>
                  {mostrarOutras ? 'Esconder outras disciplinas' : `Incluir disciplinas de outros semestres (${outras.length})`}
                </button>
                {mostrarOutras && (
                  <div className="mt-3 space-y-2">
                    {outras.map((t) => (
                      <ItemTurma key={t.id} t={t} />
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex items-start gap-2.5 rounded-md bg-background px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              <Sparkles size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-primary" />
              Cada disciplina marcada vira um pedido para entrar na turma: o professor ou o administrador aprova. Se o professor já passou o
              código da turma, use “Adicionar matéria” em Minhas matérias para entrar na hora. Horários e salas vêm da grade do site.
            </div>
          </>
        )}

        <div className="mt-7 flex items-center gap-2">
          {passo > 0 && (
            <Button variant="ghost" onClick={() => setPasso(passo - 1)} disabled={salvando}>
              <ArrowLeft strokeWidth={1.75} /> Voltar
            </Button>
          )}
          <Button type="submit" className="ml-auto h-10 px-4 font-semibold" disabled={salvando}>
            {salvando ? 'Salvando…' : passo === 2 ? (
              <>
                {escolhidas.size ? 'Pedir para entrar' : 'Abrir minha agenda'} <ArrowRight strokeWidth={1.75} />
              </>
            ) : (
              <>
                Continuar <ArrowRight strokeWidth={1.75} />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
