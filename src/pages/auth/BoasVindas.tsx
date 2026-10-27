import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, GraduationCap, Plus, X } from 'lucide-react'
import ChipLogo from '@/components/ChipLogo'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso } from '@/components/auth/AuthUI'
import { Cursos, Materias, Semestres } from '@/api/entities'
import { atualizarPerfil, mensagemDeErro } from '@/api/auth'
import { useAuth } from '@/lib/auth'
import { CORES_MATERIA } from '@/lib/cores'
import { cn } from '@/lib/utils'
import type { CorMateria, Curso, Semestre } from '@/types'

// Tela 04 · Primeiro acesso: Curso → Semestre → Matérias. Cada passo salva ao continuar.
const PASSOS = ['Curso', 'Semestre', 'Matérias'] as const
const NUMEROS_SEMESTRE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

type MateriaRascunho = { nome: string; cor: CorMateria }

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

function Rodape({ passo, salvando, aoVoltar, aoPular, rotulo }: {
  passo: number
  salvando: boolean
  aoVoltar: () => void
  aoPular: () => void
  rotulo: ReactNode
}) {
  return (
    <div className="mt-7 flex items-center gap-2">
      {passo > 0 && (
        <Button variant="ghost" onClick={aoVoltar} disabled={salvando}>
          <ArrowLeft strokeWidth={1.75} /> Voltar
        </Button>
      )}
      <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={aoPular} disabled={salvando}>
        Pular por enquanto
      </Button>
      <Button type="submit" className="h-10 px-4 font-semibold" disabled={salvando}>
        {salvando ? 'Salvando…' : rotulo}
      </Button>
    </div>
  )
}

export default function BoasVindas() {
  const { configurado, sessao, recarregarPerfil } = useAuth()
  const navegar = useNavigate()
  const [passo, setPasso] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [nomeCurso, setNomeCurso] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [curso, setCurso] = useState<Curso | null>(null)

  const [numero, setNumero] = useState(1)
  const [nomeSemestre, setNomeSemestre] = useState('1º Semestre')
  const [nomeEditado, setNomeEditado] = useState(false)
  const [semestre, setSemestre] = useState<Semestre | null>(null)

  const [materias, setMaterias] = useState<MateriaRascunho[]>([{ nome: '', cor: 'cobalto' }])

  async function executar(acao: () => Promise<void>) {
    setErro('')
    setSalvando(true)
    try {
      await acao()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  async function concluir() {
    if (configurado && sessao) {
      await atualizarPerfil(sessao.user.id, { onboarding_concluido: true })
      await recarregarPerfil()
    }
    navegar('/', { replace: true })
  }

  function escolherNumero(n: number) {
    setNumero(n)
    if (!nomeEditado) setNomeSemestre(`${n}º Semestre`)
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (passo === 0) {
      executar(async () => {
        const valores = { nome: nomeCurso.trim(), instituicao: instituicao.trim() || undefined }
        setCurso(curso ? await Cursos.update(curso.id, valores) : await Cursos.create(valores))
        setPasso(1)
      })
    } else if (passo === 1) {
      executar(async () => {
        if (!curso) return
        const valores = { curso_id: curso.id, nome: nomeSemestre.trim(), ordem: numero, atual: true }
        setSemestre(semestre ? await Semestres.update(semestre.id, valores) : await Semestres.create(valores))
        setPasso(2)
      })
    } else {
      executar(async () => {
        if (!semestre) return
        for (const m of materias.filter((m) => m.nome.trim())) {
          await Materias.create({ semestre_id: semestre.id, nome: m.nome.trim(), cor: m.cor })
        }
        await concluir()
      })
    }
  }

  function alterarMateria(i: number, valores: Partial<MateriaRascunho>) {
    setMaterias((lista) => lista.map((m, j) => (j === i ? { ...m, ...valores } : m)))
  }

  function adicionarMateria() {
    // Sugere a próxima cor da paleta para variar as matérias.
    setMaterias((lista) => [...lista, { nome: '', cor: CORES_MATERIA[lista.length % CORES_MATERIA.length].cor }])
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
            <p className="mt-1 text-sm text-muted-foreground">Você pode adicionar outros cursos depois.</p>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="curso">Nome do curso</Label>
                <Input
                  id="curso"
                  required
                  autoFocus
                  placeholder="Análise e Desenvolvimento de Sistemas"
                  value={nomeCurso}
                  onChange={(e) => setNomeCurso(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instituicao">Instituição (opcional)</Label>
                <Input
                  id="instituicao"
                  placeholder="Fatec"
                  value={instituicao}
                  onChange={(e) => setInstituicao(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {passo === 1 && (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Qual semestre você está cursando?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ele vai aparecer na barra lateral. Você pode adicionar outros depois.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
              <GraduationCap size={18} strokeWidth={1.75} className="text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{curso?.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {curso?.instituicao ? `${curso.instituicao} · ` : ''}curso criado no passo 1
                </p>
              </div>
              <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setPasso(0)}>
                Editar
              </button>
            </div>
            <div className="mt-6">
              <Label>Semestre atual</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {NUMEROS_SEMESTRE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => escolherNumero(n)}
                    aria-pressed={numero === n}
                    className={cn(
                      'h-9 w-14 rounded-md border text-sm font-medium transition-colors',
                      numero === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                    )}
                  >
                    {n}º
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              <Label htmlFor="semestre">Nome do semestre</Label>
              <Input
                id="semestre"
                required
                value={nomeSemestre}
                onChange={(e) => {
                  setNomeEditado(true)
                  setNomeSemestre(e.target.value)
                }}
              />
              <p className="text-xs text-muted-foreground">Sugerido automaticamente. Pode ser “2026/2”, por exemplo.</p>
            </div>
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Quais matérias você tem neste semestre?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A cor identifica a matéria em todo o app. Dá para mudar depois.
            </p>
            <ul className="mt-6 space-y-3">
              {materias.map((m, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      aria-label={`Nome da matéria ${i + 1}`}
                      placeholder="Ex.: Programação Orientada a Objetos"
                      value={m.nome}
                      onChange={(e) => alterarMateria(i, { nome: e.target.value })}
                    />
                    {materias.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover matéria"
                        onClick={() => setMaterias((lista) => lista.filter((_, j) => j !== i))}
                      >
                        <X strokeWidth={1.75} />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label="Cor da matéria">
                    {CORES_MATERIA.map(({ cor, nome, fundo }) => (
                      <button
                        key={cor}
                        type="button"
                        role="radio"
                        aria-checked={m.cor === cor}
                        title={nome}
                        aria-label={nome}
                        onClick={() => alterarMateria(i, { cor })}
                        className={cn(
                          'size-6 rounded-md ring-offset-2 transition',
                          fundo,
                          m.cor === cor ? 'ring-2 ring-foreground' : 'hover:opacity-80',
                        )}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-3" onClick={adicionarMateria}>
              <Plus strokeWidth={1.75} /> Adicionar matéria
            </Button>
          </>
        )}

        <Rodape
          passo={passo}
          salvando={salvando}
          aoVoltar={() => setPasso((p) => p - 1)}
          aoPular={() => executar(concluir)}
          rotulo={
            passo < 2 ? (
              <>
                Continuar <ArrowRight strokeWidth={1.75} />
              </>
            ) : (
              'Concluir'
            )
          }
        />
      </form>
    </div>
  )
}
