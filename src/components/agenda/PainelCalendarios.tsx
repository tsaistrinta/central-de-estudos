import { Check, ChevronDown, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import MiniCalendario from './MiniCalendario'
import { CAMADAS_FIXAS, corDaMateria } from '@/lib/agenda'
import type { MinhaTurma } from '@/types'

// Painel esquerdo da agenda (tela 20): novo evento, minicalendário e camadas que ligam/desligam.
// Cada disciplina é uma camada com a cor da matéria; o que fica desligado é salvo nas preferências.

export type Camada = { id: string; nome: string; cor: string; oficial?: boolean; contador?: number }

const MEUS: Camada[] = (['pessoal', 'trabalho', 'archie'] as const).map((id) => ({ id, ...CAMADAS_FIXAS[id] }))
const FATEC: Camada[] = [
  { id: 'academico', ...CAMADAS_FIXAS.academico, oficial: true },
  { id: 'curso', ...CAMADAS_FIXAS.curso },
]

function ItemCamada({ camada, ligada, onAlternar }: { camada: Camada; ligada: boolean; onAlternar: () => void }) {
  return (
    <button onClick={onAlternar} className="flex h-[27px] items-center gap-2.5 rounded-[5px] px-1 text-left text-[13px] hover:bg-muted">
      <span
        className="grid size-[15px] shrink-0 place-items-center rounded-[4px] border-[1.5px] text-white"
        style={{ borderColor: camada.cor, background: ligada ? camada.cor : 'transparent' }}
      >
        {ligada && <Check size={10} strokeWidth={3.2} />}
      </span>
      <span className={cn('flex-1 truncate', !ligada && 'text-muted-foreground')}>{camada.nome}</span>
      {camada.oficial && <ShieldCheck size={12} strokeWidth={2} className="text-primary" />}
      {!!camada.contador && <span className="font-mono text-[11px] text-muted-foreground">{camada.contador}</span>}
    </button>
  )
}

function Grupo({ titulo, acao, children }: { titulo: string; acao?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{titulo}</span>
        {acao && <Plus size={13} strokeWidth={2} className="text-muted-foreground" />}
      </div>
      {children}
    </div>
  )
}

type Props = {
  foco: Date
  onEscolherDia: (d: Date) => void
  onNovoEvento: () => void
  turmas: MinhaTurma[]
  ocultas: string[]
  onAlternar: (id: string) => void
  diasComProva: Date[]
  sugestoes: number
  rodape?: React.ReactNode
}

export default function PainelCalendarios({ foco, onEscolherDia, onNovoEvento, turmas, ocultas, onAlternar, diasComProva, sugestoes, rodape }: Props) {
  const ligada = (id: string) => !ocultas.includes(id)
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card px-3.5 pt-4 pb-3.5">
      <div className="flex h-[38px] shrink-0 overflow-hidden rounded-md bg-primary text-[13.5px] font-semibold text-primary-foreground">
        <button onClick={onNovoEvento} className="flex flex-1 items-center gap-2 px-3.5 hover:bg-primary-hover" title="Novo evento (N)">
          <Plus size={16} strokeWidth={2.2} /> Novo evento
        </button>
        <button onClick={onNovoEvento} className="grid w-9 place-items-center border-l border-white/30 hover:bg-primary-hover" aria-label="Mais opções">
          <ChevronDown size={15} strokeWidth={2} />
        </button>
      </div>

      <MiniCalendario key={foco.getFullYear() * 12 + foco.getMonth()} foco={foco} onEscolher={onEscolherDia} diasComProva={diasComProva} />

      <Grupo titulo="Meus calendários" acao>
        {MEUS.map((c) => (
          <ItemCamada key={c.id} camada={c.id === 'archie' ? { ...c, contador: sugestoes } : c} ligada={ligada(c.id)} onAlternar={() => onAlternar(c.id)} />
        ))}
      </Grupo>

      <Grupo titulo="Minhas turmas">
        {turmas.length === 0 && <p className="px-1 text-[12.5px] leading-snug text-faint">Entre numa turma para ver aulas e provas aqui.</p>}
        {turmas.map((t) => (
          <ItemCamada
            key={t.id}
            camada={{ id: `turma:${t.id}`, nome: t.disciplina.nome, cor: corDaMateria(t.disciplina.cor) }}
            ligada={ligada(`turma:${t.id}`)}
            onAlternar={() => onAlternar(`turma:${t.id}`)}
          />
        ))}
      </Grupo>

      <Grupo titulo="Fatec">
        {FATEC.map((c) => (
          <ItemCamada key={c.id} camada={c} ligada={ligada(c.id)} onAlternar={() => onAlternar(c.id)} />
        ))}
      </Grupo>
      {rodape}
    </aside>
  )
}
