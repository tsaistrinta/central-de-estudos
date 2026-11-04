import { useState } from 'react'
import { Check, ChevronDown, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import MiniCalendario from './MiniCalendario'

// Painel esquerdo da agenda (tela 20): novo evento, minicalendário e camadas que ligam/desligam.
// As camadas reais (turmas, Fatec) vêm do banco na Fase 3; as cores seguem a paleta Foco.

export type Camada = { id: string; nome: string; cor: string; oficial?: boolean }

const MEUS: Camada[] = [
  { id: 'pessoal', nome: 'Pessoal', cor: 'var(--subject-verde)' },
  { id: 'trabalho', nome: 'Trabalho', cor: 'var(--faint)' },
  { id: 'yara', nome: 'Sugestões da Yara', cor: 'var(--primary)' },
]
const FATEC: Camada[] = [
  { id: 'academico', nome: 'Calendário acadêmico', cor: 'var(--subject-azul)', oficial: true },
  { id: 'curso', nome: 'Meu curso', cor: 'var(--muted-foreground)' },
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

type Props = { foco: Date; onEscolherDia: (d: Date) => void; onNovoEvento: () => void }

export default function PainelCalendarios({ foco, onEscolherDia, onNovoEvento }: Props) {
  const [desligadas, setDesligadas] = useState<Set<string>>(new Set())
  const alternar = (id: string) =>
    setDesligadas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card px-3.5 pt-4 pb-3.5">
      <div className="flex h-[38px] shrink-0 overflow-hidden rounded-md bg-primary text-[13.5px] font-semibold text-primary-foreground">
        <button onClick={onNovoEvento} className="flex flex-1 items-center gap-2 px-3.5 hover:bg-primary-hover">
          <Plus size={16} strokeWidth={2.2} /> Novo evento
        </button>
        <button className="grid w-9 place-items-center border-l border-white/30 hover:bg-primary-hover" aria-label="Mais opções">
          <ChevronDown size={15} strokeWidth={2} />
        </button>
      </div>

      <MiniCalendario foco={foco} onEscolher={onEscolherDia} />

      <Grupo titulo="Meus calendários" acao>
        {MEUS.map((c) => (
          <ItemCamada key={c.id} camada={c} ligada={!desligadas.has(c.id)} onAlternar={() => alternar(c.id)} />
        ))}
      </Grupo>

      <Grupo titulo="Minhas turmas">
        <p className="px-1 text-[12.5px] leading-snug text-faint">Cada disciplina vira uma camada com a cor da matéria.</p>
      </Grupo>

      <Grupo titulo="Fatec">
        {FATEC.map((c) => (
          <ItemCamada key={c.id} camada={c} ligada={!desligadas.has(c.id)} onAlternar={() => alternar(c.id)} />
        ))}
      </Grupo>
    </aside>
  )
}
